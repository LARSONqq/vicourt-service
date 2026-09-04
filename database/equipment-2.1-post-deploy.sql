begin;

-- Run only after the Equipment 2.1 application is deployed. The old
-- application still creates/deletes service rows directly and therefore needs
-- its existing mutation grants during the rolling deployment window.
do $migration$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipment_service_records'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format(
      'drop policy %I on public.equipment_service_records',
      policy_record.policyname
    );
  end loop;
end
$migration$;

do $migration$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipment_service_records'
      and policyname = 'equipment_service_records_active_select_v2'
  ) then
    create policy equipment_service_records_active_select_v2
    on public.equipment_service_records
    for select
    to authenticated
    using (private.is_active_user());
  end if;
end
$migration$;

revoke insert, update, delete, truncate, references, trigger
  on table public.equipment_service_records
  from public, anon, authenticated;

-- Table-level revokes do not remove column-level privileges. Remove any
-- legacy INSERT/UPDATE column grants before exposing the post-deploy schema.
do $migration$
declare
  privilege_record record;
begin
  for privilege_record in
    select distinct
      privilege_type,
      column_name,
      grantee
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'equipment_service_records'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'REFERENCES')
  loop
    execute format(
      'revoke %s (%I) on table public.equipment_service_records from %s',
      privilege_record.privilege_type,
      privilege_record.column_name,
      case
        when privilege_record.grantee = 'PUBLIC' then 'public'
        else quote_ident(privilege_record.grantee)
      end
    );
  end loop;
end
$migration$;

grant select on table public.equipment_service_records
  to authenticated;

-- current_usage and all usage-schedule fields are written only by the
-- transactional Equipment 2.1 RPCs. Preserve the old application's metadata
-- INSERT/UPDATE surface without granting direct access to those new columns.
revoke insert, update on table public.equipment
  from public, anon, authenticated;

revoke update (
  usage_type,
  current_usage,
  maintenance_interval_usage,
  last_maintenance_usage,
  next_maintenance_usage
) on table public.equipment
  from public, anon, authenticated;

grant insert (
  name,
  category,
  inventory_number,
  status,
  responsible,
  location,
  purchase_date,
  next_service_date,
  notes,
  responsible_employee_id,
  maintenance_interval_days,
  last_maintenance_date
) on table public.equipment
  to authenticated;

grant update (
  name,
  category,
  inventory_number,
  status,
  responsible,
  location,
  purchase_date,
  next_service_date,
  notes,
  responsible_employee_id,
  maintenance_interval_days,
  last_maintenance_date
) on table public.equipment
  to authenticated;

do $migration$
declare
  sequence_name text;
begin
  sequence_name := pg_get_serial_sequence(
    'public.equipment_service_records',
    'id'
  );

  if sequence_name is not null then
    execute format(
      'revoke all on sequence %s from public, anon, authenticated',
      sequence_name
    );
  end if;
end
$migration$;

notify pgrst, 'reload schema';

commit;
