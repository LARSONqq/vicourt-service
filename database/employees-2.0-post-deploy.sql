-- Employees 2.0 Phase 1: worker privacy lockdown.
-- Run only after the application using the five-column operational employee
-- projection and management RPC has been fully deployed.

begin;

-- A table-level SELECT grant overrides a narrower column allowlist. Remove
-- table and legacy column grants first, then restore only operational fields.
revoke select on table public.employees
  from public, anon, authenticated;

do $migration$
declare
  v_columns text;
begin
  select string_agg(
    quote_ident(column_info.column_name),
    ', '
    order by column_info.ordinal_position
  )
  into v_columns
  from information_schema.columns column_info
  where column_info.table_schema = 'public'
    and column_info.table_name = 'employees';

  if v_columns is null then
    raise exception 'Таблицю public.employees не знайдено.';
  end if;

  execute format(
    'revoke select (%s) on table public.employees from public, anon, authenticated',
    v_columns
  );
end
$migration$;

grant select (
  id,
  first_name,
  last_name,
  position,
  status
) on table public.employees
to authenticated;

notify pgrst, 'reload schema';

commit;
