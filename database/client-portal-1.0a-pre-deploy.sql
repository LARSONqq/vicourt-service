-- Client Portal 1.0A PRE. Execute manually as postgres after review.
-- Temporarily disable public signup in Supabase before this rollout.
-- PRE preserves unmarked legacy /register ONLY until app deploy + POST.
-- Client reads remain disabled until POST, even if an admin creates a client.
-- No existing user is converted, classified, deleted or granted an object.
begin;

do $preflight$
begin
  if current_user <> 'postgres' then raise exception 'Run Client Portal PRE as postgres.'; end if;
  if not exists (select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'auth.users'::regclass and t.tgfoid = 'public.handle_new_user()'::regprocedure
      and t.tgname = 'on_auth_user_created' and t.tgtype = 5 and t.tgenabled = 'O')
  then raise exception 'The reviewed AFTER INSERT signup trigger binding is missing or drifted.'; end if;
  if exists (select 1 from pg_catalog.pg_proc p
    where p.oid in ('private.is_active_user()'::regprocedure, 'private.has_role(text[])'::regprocedure, 'private.is_admin()'::regprocedure)
      and (not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)))
  then raise exception 'Reviewed internal auth helper configuration drifted.'; end if;
end
$preflight$;

create table if not exists public.client_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.client_object_access (
  client_user_id uuid not null references public.client_profiles(user_id) on delete cascade,
  object_id bigint not null references public.objects(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  primary key (client_user_id, object_id)
);
create index if not exists client_object_access_object_idx
  on public.client_object_access(object_id, client_user_id) where revoked_at is null;

-- Re-running PRE after POST must NEVER re-enable legacy signup.
do $migration$
begin
  if to_regprocedure('private.legacy_internal_signup_enabled()') is null then
    execute $definition$
      create function private.legacy_internal_signup_enabled()
      returns boolean language sql stable security invoker set search_path = ''
      as 'select true'
    $definition$;
  end if;
end
$migration$;
revoke all on function private.legacy_internal_signup_enabled() from public, anon, authenticated;

-- Shared auth.users row lock serializes profile inserts across BOTH tables.
-- This is not an app-only check or an unsafe check-then-insert race.
create or replace function private.guard_application_identity()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  identity_id uuid;
  account_type text;
begin
  if tg_table_name = 'profiles' then identity_id := new.id;
  else identity_id := new.user_id;
  end if;
  select u.raw_app_meta_data ->> 'account_type' into account_type
  from auth.users u where u.id = identity_id for update;
  if not found then raise exception 'Identity not found.' using errcode = '23503'; end if;

  if tg_table_name = 'profiles' then
    if exists (select 1 from public.client_profiles c where c.user_id = identity_id)
      or account_type = 'client'
    then raise exception 'Client and internal identities cannot overlap.' using errcode = '23514'; end if;
    if tg_op = 'INSERT' and account_type is distinct from 'internal'
      and not (account_type is null and private.legacy_internal_signup_enabled())
    then raise exception 'Trusted internal classification required.' using errcode = '42501'; end if;
    if tg_op = 'UPDATE' and new.id is distinct from old.id then
      raise exception 'Identity cannot be changed.' using errcode = '23514';
    end if;
  else
    if account_type is distinct from 'client'
      or exists (select 1 from public.profiles p where p.id = identity_id)
    then raise exception 'Trusted client-only classification required.' using errcode = '23514'; end if;
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
      raise exception 'Identity cannot be changed.' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end
$function$;
revoke all on function private.guard_application_identity() from public, anon, authenticated;

drop trigger if exists client_portal_identity_guard on public.profiles;
create trigger client_portal_identity_guard before insert or update on public.profiles
for each row execute function private.guard_application_identity();
drop trigger if exists client_portal_identity_guard on public.client_profiles;
create trigger client_portal_identity_guard before insert or update on public.client_profiles
for each row execute function private.guard_application_identity();

-- Existing auth.users trigger binding and owner remain unchanged.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  account_type text := new.raw_app_meta_data ->> 'account_type';
  display_name text := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Користувач'), 120);
begin
  if account_type = 'client' then
    insert into public.client_profiles(user_id, display_name, is_active)
    values (new.id, display_name, false);
  elsif account_type = 'internal'
    or (account_type is null and private.legacy_internal_signup_enabled())
  then
    insert into public.profiles(id, email, full_name, role)
    values (new.id, new.email, display_name, 'worker');
  end if;
  -- Unknown/unclassified signup creates no identity after POST.
  return new;
end
$function$;
-- Preserve hardened trigger-only execution; don't restore PUBLIC defaults.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function private.is_active_client()
returns boolean language sql stable security definer set search_path = ''
as $function$
  select auth.uid() is not null
    and not private.legacy_internal_signup_enabled()
    and exists (
      select 1 from public.client_profiles c join auth.users u on u.id = c.user_id
      where c.user_id = auth.uid() and c.is_active
        and u.raw_app_meta_data ->> 'account_type' = 'client'
    )
    and not exists (select 1 from public.profiles p where p.id = auth.uid())
$function$;

create or replace function private.client_has_object_access(p_object_id bigint)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select private.is_active_client() and exists (
    select 1 from public.client_object_access a
    where a.client_user_id = auth.uid() and a.object_id = p_object_id and a.revoked_at is null
  )
$function$;
revoke all on function private.is_active_client() from public, anon, authenticated;
grant execute on function private.is_active_client() to authenticated;
revoke all on function private.client_has_object_access(bigint) from public, anon, authenticated;

alter table public.client_profiles enable row level security;
alter table public.client_object_access enable row level security;
revoke all on table public.client_profiles, public.client_object_access from public, anon, authenticated;
grant select (user_id, display_name, is_active) on public.client_profiles to authenticated;
grant select (client_user_id, object_id) on public.client_object_access to authenticated;
drop policy if exists client_profile_self_read on public.client_profiles;
create policy client_profile_self_read on public.client_profiles for select to authenticated
using (user_id = auth.uid() and private.is_active_client());
drop policy if exists client_grant_self_read on public.client_object_access;
create policy client_grant_self_read on public.client_object_access for select to authenticated
using (client_user_id = auth.uid() and revoked_at is null and private.is_active_client());

create or replace function public.get_application_identity()
returns text language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then return 'denied'; end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid()) then
    if exists (select 1 from public.client_profiles c where c.user_id = auth.uid())
      or exists (select 1 from auth.users u where u.id = auth.uid() and u.raw_app_meta_data ->> 'account_type' = 'client')
    then return 'denied'; end if;
    if private.is_active_user() then return 'internal'; end if;
    return 'denied';
  end if;
  if private.is_active_client() then return 'client'; end if;
  return 'denied';
end
$function$;

-- DEFINER is required: authenticated is shared, so a client table SELECT
-- policy would expose internal object columns. These RPCs grant no table access.
create or replace function public.get_client_objects(p_page integer default 1)
returns table(id bigint, name text, address text, status text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if not private.is_active_client() then
    raise exception 'Client access denied.' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 or p_page > 100000 then
    raise exception 'Invalid page.' using errcode = '22023';
  end if;
  return query select o.id, o.name::text, o.address::text,
    case when o.status in ('Новий', 'В роботі', 'На постійному обслуговуванні', 'Під періодичним наглядом', 'Призупинено', 'Завершено')
      then o.status::text else 'Об’єкт' end
  from public.client_object_access a join public.objects o on o.id = a.object_id
  where a.client_user_id = auth.uid() and a.revoked_at is null
  order by o.id desc limit 21 offset ((p_page - 1) * 20);
end
$function$;

create or replace function public.get_client_object(p_object_id bigint)
returns table(id bigint, name text, address text, status text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if not private.is_active_client() then
    raise exception 'Client access denied.' using errcode = '42501';
  end if;
  return query select o.id, o.name::text, o.address::text,
    case when o.status in ('Новий', 'В роботі', 'На постійному обслуговуванні', 'Під періодичним наглядом', 'Призупинено', 'Завершено')
      then o.status::text else 'Об’єкт' end
  from public.objects o
  where o.id = p_object_id and private.client_has_object_access(o.id);
end
$function$;

create or replace function public.get_admin_client_profiles(
  p_query text default '',
  p_page integer default 1
)
returns table(user_id uuid, display_name text, is_active boolean)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin required.' using errcode = '42501'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'Invalid page.' using errcode = '22023'; end if;
  return query select c.user_id, c.display_name, c.is_active from public.client_profiles c
  where c.display_name ilike '%' || left(coalesce(p_query, ''), 120) || '%'
  order by c.created_at desc, c.user_id limit 21 offset ((p_page - 1) * 20);
end
$function$;

create or replace function public.get_client_portal_provisioning_state()
returns boolean language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin required.' using errcode = '42501'; end if;
  return not private.legacy_internal_signup_enabled();
end
$function$;

create or replace function public.get_admin_object_clients(p_object_id bigint, p_page integer default 1)
returns table(client_user_id uuid, display_name text, is_active boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin required.' using errcode = '42501'; end if;
  if p_page is null or p_page < 1 or p_page > 100000 then raise exception 'Invalid page.' using errcode = '22023'; end if;
  return query select c.user_id, c.display_name, c.is_active, a.created_at
  from public.client_object_access a join public.client_profiles c on c.user_id = a.client_user_id
  where a.object_id = p_object_id and a.revoked_at is null
  order by a.created_at desc, c.user_id limit 21 offset ((p_page - 1) * 20);
end
$function$;

create or replace function public.set_client_object_access(p_client_user_id uuid, p_object_id bigint, p_granted boolean)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin required.' using errcode = '42501'; end if;
  if p_granted is null then raise exception 'Grant state required.' using errcode = '22023'; end if;
  perform 1 from public.client_profiles c where c.user_id = p_client_user_id for update;
  if not found then raise exception 'Client not found.' using errcode = 'P0002'; end if;
  perform 1 from public.objects o where o.id = p_object_id for key share;
  if not found then raise exception 'Object not found.' using errcode = 'P0002'; end if;
  if p_granted then
    insert into public.client_object_access(client_user_id, object_id, granted_by)
    values (p_client_user_id, p_object_id, auth.uid())
    on conflict (client_user_id, object_id) do update
      set granted_by = auth.uid(), granted_at = now(), revoked_at = null, revoked_by = null
      where public.client_object_access.revoked_at is not null;
  else
    update public.client_object_access set revoked_at = now(), revoked_by = auth.uid()
    where client_user_id = p_client_user_id and object_id = p_object_id and revoked_at is null;
  end if;
end
$function$;

create or replace function public.set_client_active(p_client_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin required.' using errcode = '42501'; end if;
  if p_active is null then raise exception 'Active state required.' using errcode = '22023'; end if;
  if p_active and private.legacy_internal_signup_enabled() then
    raise exception 'Complete Client Portal POST before activation.' using errcode = '55000';
  end if;
  update public.client_profiles set is_active = p_active, updated_by = auth.uid()
  where user_id = p_client_user_id;
  if not found then raise exception 'Client not found.' using errcode = 'P0002'; end if;
end
$function$;

revoke all on function public.get_application_identity(), public.get_client_objects(integer),
  public.get_client_portal_provisioning_state(),
  public.get_client_object(bigint), public.get_admin_client_profiles(text,integer),
  public.get_admin_object_clients(bigint,integer), public.set_client_object_access(uuid,bigint,boolean),
  public.set_client_active(uuid,boolean) from public, anon, authenticated;
grant execute on function public.get_application_identity(), public.get_client_objects(integer),
  public.get_client_portal_provisioning_state(),
  public.get_client_object(bigint), public.get_admin_client_profiles(text,integer),
  public.get_admin_object_clients(bigint,integer), public.set_client_object_access(uuid,bigint,boolean),
  public.set_client_active(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
