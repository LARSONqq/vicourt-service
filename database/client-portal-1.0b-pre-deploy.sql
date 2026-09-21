-- Client Portal 1.0B1 foundation. Manual review/execution as postgres only.
-- Additive PRE -> application deploy -> structural audit + real-session smoke.
-- No POST, backfill, UI, identity/grant changes or internal data publication.
-- Publish is a complete snapshot. First publication uses expected_version=0;
-- subsequent publications must supply the last management version (>=1).
begin;

do $preflight$
begin
  if current_user <> 'postgres' then raise exception 'Run progress PRE as postgres.'; end if;
  if pg_catalog.to_regprocedure('private.is_active_client()') is null
    or pg_catalog.to_regprocedure('private.client_has_object_access(bigint)') is null
    or pg_catalog.to_regprocedure('private.is_active_user()') is null
    or pg_catalog.to_regprocedure('private.has_role(text[])') is null
  then raise exception 'Reviewed Client Portal 1.0A and internal guards are required.'; end if;
end
$preflight$;

create table if not exists public.client_object_progress (
  object_id bigint primary key references public.objects(id) on delete cascade,
  overall_percent smallint not null,
  completed_summary text,
  next_summary text,
  version bigint not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_progress_percent_check check (overall_percent between 0 and 100),
  constraint client_progress_version_check check (version >= 1),
  constraint client_progress_completed_check check (completed_summary is null or
    (completed_summary = pg_catalog.btrim(completed_summary) and pg_catalog.length(completed_summary) between 1 and 2000)),
  constraint client_progress_next_check check (next_summary is null or
    (next_summary = pg_catalog.btrim(next_summary) and pg_catalog.length(next_summary) between 1 and 2000))
);

create table if not exists public.client_object_progress_stages (
  id bigint generated always as identity primary key,
  object_id bigint not null references public.client_object_progress(object_id) on delete cascade,
  title text not null,
  status text not null,
  sort_order integer not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint client_progress_stage_title_check check (
    title = pg_catalog.btrim(title) and pg_catalog.length(title) between 1 and 120),
  constraint client_progress_stage_status_check check (status in ('planned','in_progress','completed')),
  constraint client_progress_stage_order_check check (sort_order >= 0),
  constraint client_progress_stages_order_key unique (object_id, sort_order) deferrable initially deferred
);

alter table public.client_object_progress enable row level security;
alter table public.client_object_progress_stages enable row level security;
-- RPC-only, including management. No policies: RLS defaults to deny.
revoke all on table public.client_object_progress, public.client_object_progress_stages from public, anon, authenticated;
revoke all on sequence public.client_object_progress_stages_id_seq from public, anon, authenticated;

create or replace function public.get_client_object_progress(p_object_id bigint)
returns table(object_id bigint, overall_percent smallint, completed_summary text,
  next_summary text, updated_at timestamptz, stages jsonb)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_client(), false)
    or not coalesce(private.client_has_object_access(p_object_id), false)
  then raise exception 'Object access denied.' using errcode = '42501'; end if;
  -- No row means authorized but never published. Inaccessible/nonexistent IDs
  -- both fail the same grant check above, without exposing object existence.
  return query
  select p.object_id, p.overall_percent, p.completed_summary, p.next_summary, p.updated_at,
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', s.id, 'title', s.title, 'status', s.status, 'sort_order', s.sort_order)
      order by s.sort_order, s.id)
      from (select st.id, st.title, st.status, st.sort_order
        from public.client_object_progress_stages st where st.object_id = p.object_id
        order by st.sort_order, st.id limit 50) s), '[]'::jsonb)
  from public.client_object_progress p where p.object_id = p_object_id;
end
$function$;

create or replace function public.get_management_client_object_progress(p_object_id bigint)
returns table(object_id bigint, overall_percent smallint, completed_summary text,
  next_summary text, updated_at timestamptz, stages jsonb, version bigint)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_user(), false)
    or not coalesce(private.has_role(array['admin','object_manager']::text[]), false)
  then raise exception 'Progress management denied.' using errcode = '42501'; end if;
  if not exists (select 1 from public.objects o where o.id = p_object_id) then
    raise exception 'Object not found.' using errcode = 'P0002';
  end if;
  return query
  select p.object_id, p.overall_percent, p.completed_summary, p.next_summary, p.updated_at,
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', s.id, 'title', s.title, 'status', s.status, 'sort_order', s.sort_order)
      order by s.sort_order, s.id)
      from (select st.id, st.title, st.status, st.sort_order
        from public.client_object_progress_stages st where st.object_id = p.object_id
        order by st.sort_order, st.id limit 50) s), '[]'::jsonb), p.version
  from public.client_object_progress p where p.object_id = p_object_id;
end
$function$;

create or replace function public.save_client_object_progress(
  p_object_id bigint,
  p_overall_percent smallint,
  p_completed_summary text,
  p_next_summary text,
  p_stages jsonb,
  p_expected_version bigint
)
returns table(object_id bigint, overall_percent smallint, completed_summary text,
  next_summary text, updated_at timestamptz, stages jsonb, version bigint)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_version bigint;
  v_now timestamptz;
  v_stage jsonb;
  v_id bigint;
  v_order integer;
  v_ids bigint[] := array[]::bigint[];
  v_orders integer[] := array[]::integer[];
  v_completed text := nullif(pg_catalog.btrim(p_completed_summary), '');
  v_next text := nullif(pg_catalog.btrim(p_next_summary), '');
begin
  if auth.uid() is null or not coalesce(private.is_active_user(), false)
    or not coalesce(private.has_role(array['admin','object_manager']::text[]), false)
  then raise exception 'Progress management denied.' using errcode = '42501'; end if;
  if p_overall_percent is null or p_overall_percent < 0 or p_overall_percent > 100
    or p_expected_version is null or p_expected_version < 0
    or pg_catalog.length(v_completed) > 2000 or pg_catalog.length(v_next) > 2000
  then raise exception 'Invalid progress publication.' using errcode = '22023'; end if;
  -- Separate statements: never rely on WHERE/boolean evaluation order to
  -- protect jsonb_array_length or numeric casts from an invalid JSON type.
  if p_stages is null or pg_catalog.jsonb_typeof(p_stages) <> 'array' then
    raise exception 'Stages must be an array.' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_stages) > 50 then
    raise exception 'At most 50 stages are allowed.' using errcode = '22023';
  end if;
  for v_stage in select j.value from pg_catalog.jsonb_array_elements(p_stages) j loop
    if pg_catalog.jsonb_typeof(v_stage) <> 'object' then
      raise exception 'Invalid stage.' using errcode = '22023';
    end if;
    if exists (select 1 from pg_catalog.jsonb_object_keys(v_stage) k(key)
      where k.key not in ('id','title','status','sort_order'))
      or pg_catalog.jsonb_typeof(v_stage->'title') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_stage->'status') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_stage->'sort_order') is distinct from 'number'
    then raise exception 'Invalid stage fields.' using errcode = '22023'; end if;
    if pg_catalog.length(pg_catalog.btrim(v_stage->>'title')) not between 1 and 120
      or v_stage->>'status' not in ('planned','in_progress','completed')
      or v_stage->>'sort_order' !~ '^[0-9]{1,10}$'
    then raise exception 'Invalid stage title, status or ordering.' using errcode = '22023'; end if;
    if (v_stage->>'sort_order')::bigint > 2147483647 then
      raise exception 'Invalid stage ordering.' using errcode = '22023';
    end if;
    v_order := (v_stage->>'sort_order')::integer;
    if v_order = any(v_orders) then
      raise exception 'Duplicate stage ordering.' using errcode = '22023';
    end if;
    v_orders := pg_catalog.array_append(v_orders, v_order);
    if v_stage->>'id' is not null then
      if pg_catalog.jsonb_typeof(v_stage->'id') <> 'number'
        or v_stage->>'id' !~ '^[1-9][0-9]{0,18}$'
      then raise exception 'Invalid stage ID.' using errcode = '22023'; end if;
      if (v_stage->>'id')::numeric > 9223372036854775807 then
        raise exception 'Invalid stage ID.' using errcode = '22023';
      end if;
      v_id := (v_stage->>'id')::bigint;
      if v_id = any(v_ids) then raise exception 'Duplicate stage ID.' using errcode = '22023'; end if;
      v_ids := pg_catalog.array_append(v_ids, v_id);
    end if;
  end loop;

  -- Serialize both first and subsequent publications per object. Lock only;
  -- do not update the internal object. Concurrent expected_version=0 cannot win twice.
  perform 1 from public.objects o where o.id = p_object_id for update;
  if not found then raise exception 'Object not found.' using errcode = 'P0002'; end if;
  select p.version into v_version from public.client_object_progress p where p.object_id = p_object_id for update;
  if p_expected_version <> coalesce(v_version, 0) then
    raise exception 'Progress version conflict. Reload before publishing.' using errcode = '40001';
  end if;
  if exists (select 1 from pg_catalog.unnest(v_ids) i(id) where not exists (
    select 1 from public.client_object_progress_stages s where s.id = i.id and s.object_id = p_object_id))
  then raise exception 'Stage does not belong to this progress.' using errcode = '22023'; end if;

  v_now := pg_catalog.clock_timestamp();
  if v_version is null then
    insert into public.client_object_progress(object_id, overall_percent, completed_summary, next_summary,
      version, created_at, updated_at, created_by, updated_by)
    values (p_object_id, p_overall_percent, v_completed, v_next, 1, v_now, v_now, auth.uid(), auth.uid());
  else
    update public.client_object_progress p set overall_percent = p_overall_percent,
      completed_summary = v_completed, next_summary = v_next, version = p.version + 1,
      updated_at = v_now, updated_by = auth.uid() where p.object_id = p_object_id;
  end if;
  delete from public.client_object_progress_stages s where s.object_id = p_object_id and not (s.id = any(v_ids));
  for v_stage in select j.value from pg_catalog.jsonb_array_elements(p_stages) j loop
    v_id := (v_stage->>'id')::bigint;
    if v_id is null then
      insert into public.client_object_progress_stages(object_id, title, status, sort_order, created_at, updated_at)
      values (p_object_id, pg_catalog.btrim(v_stage->>'title'), v_stage->>'status',
        (v_stage->>'sort_order')::integer, v_now, v_now);
    else
      update public.client_object_progress_stages s set title = pg_catalog.btrim(v_stage->>'title'),
        status = v_stage->>'status', sort_order = (v_stage->>'sort_order')::integer, updated_at = v_now
      where s.id = v_id and s.object_id = p_object_id;
    end if;
  end loop;
  return query
  select p.object_id, p.overall_percent, p.completed_summary, p.next_summary, p.updated_at,
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', s.id, 'title', s.title, 'status', s.status, 'sort_order', s.sort_order)
      order by s.sort_order, s.id)
      from (select st.id, st.title, st.status, st.sort_order
        from public.client_object_progress_stages st where st.object_id = p.object_id
        order by st.sort_order, st.id limit 50) s), '[]'::jsonb), p.version
  from public.client_object_progress p where p.object_id = p_object_id;
end
$function$;

revoke all on function public.get_client_object_progress(bigint),
  public.get_management_client_object_progress(bigint),
  public.save_client_object_progress(bigint,smallint,text,text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.get_client_object_progress(bigint),
  public.get_management_client_object_progress(bigint),
  public.save_client_object_progress(bigint,smallint,text,text,jsonb,bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
