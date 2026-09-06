-- Equipment 3.0 Phase 1: service-cost privacy lockdown.
-- Run only after the application using the operational service projection
-- and management RPCs has been fully deployed.

begin;

-- A table-level SELECT grant overrides any narrower column allowlist. Remove
-- table and legacy column grants, then restore operational fields without
-- financial cost or internal auth-user identifiers.
revoke select on table public.equipment_service_records
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
    and column_info.table_name = 'equipment_service_records';

  if v_columns is null then
    raise exception 'Таблицю public.equipment_service_records не знайдено.';
  end if;

  execute format(
    'revoke select (%s) on table public.equipment_service_records from public, anon, authenticated',
    v_columns
  );
end
$migration$;

grant select (
  id,
  equipment_id,
  service_type,
  service_date,
  performed_by,
  description,
  next_service_date,
  usage_reading,
  usage_type_snapshot,
  usage_log_id,
  created_by_name,
  voided_at,
  void_reason,
  created_at
) on table public.equipment_service_records
to authenticated;

notify pgrst, 'reload schema';

commit;
