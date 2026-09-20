-- Client Portal 1.0A POST. Execute manually ONLY after the new application is
-- deployed and admin internal-account creation (trusted marker) passes smoke.
-- Old /register is intentionally incompatible after this lockdown.
-- Does NOT reclassify/delete existing users. Keep public signup disabled.
begin;
do $migration$
begin
  if to_regprocedure('public.get_application_identity()') is null
    or to_regclass('public.client_profiles') is null
    or not exists (select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.profiles'::regclass and tgname = 'client_portal_identity_guard' and tgenabled = 'O')
  then raise exception 'Client Portal PRE is required before POST.'; end if;
end
$migration$;

create or replace function private.legacy_internal_signup_enabled()
returns boolean language sql stable security invoker set search_path = ''
as 'select false';
revoke all on function private.legacy_internal_signup_enabled() from public, anon, authenticated;
commit;
