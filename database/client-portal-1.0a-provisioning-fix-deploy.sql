-- Client Portal 1.0A provisioning repair. Manual review/execution only.
-- Apply AFTER the original PRE + POST. Keep public signup OFF.
-- Supabase Admin createUser INSERTs auth.users before UPDATE-ing app_metadata
-- in the SAME transaction. The existing AFTER INSERT trigger cannot yet see
-- account_type. Reuse its reviewed body when trusted classification arrives.
-- No backfill/conversion of existing Auth users, profile writes, new grants,
-- function-body changes, RLS changes or automatic object access in this script.
begin;

do $preflight$
begin
  if current_user <> 'postgres' then raise exception 'Run provisioning repair as postgres.'; end if;
  if to_regprocedure('private.legacy_internal_signup_enabled()') is null
    or to_regclass('public.client_profiles') is null
  then raise exception 'Client Portal PRE and POST are required.'; end if;
  if private.legacy_internal_signup_enabled() then
    raise exception 'Complete Client Portal POST first; do not restore unclassified worker signup.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and t.tgname = 'on_auth_user_created'
      and t.tgfoid = 'public.handle_new_user()'::regprocedure
      and t.tgtype = 5 and t.tgenabled = 'O' and not t.tgisinternal
      and p.prosecdef and p.proowner = 'postgres'::regrole
      and coalesce(p.proconfig @> array['search_path=""'], false)
  ) then raise exception 'Reviewed signup trigger/function contract is required.'; end if;
end
$preflight$;

-- Only a first trusted classification, not ordinary metadata/token updates.
-- Repeated metadata writes with the same account_type do not duplicate profiles.
-- If a future Auth version supplies the marker at INSERT, the original trigger
-- handles it; this WHEN clause then excludes the subsequent unchanged marker.
-- Identity collision guards still reject an attempt to convert an internal
-- identity into a client. Never catch/suppress such an error: Auth must roll back.
create or replace trigger on_auth_user_classified
after update of raw_app_meta_data on auth.users
for each row
when (
  (old.raw_app_meta_data ->> 'account_type') is null
  and (new.raw_app_meta_data ->> 'account_type') in ('internal', 'client')
)
execute function public.handle_new_user();

commit;
