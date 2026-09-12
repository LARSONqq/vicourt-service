-- Security / DB Hardening 1A POST: replace broad authenticated SELECT on
-- equipment usage history with the operational column allowlist expected by
-- the deployed application. This does not change RLS, mutations or RPCs.

begin;

-- A table-level SELECT makes every column readable and therefore overrides
-- the intended column boundary. PUBLIC is included because privileges granted
-- to PUBLIC are inherited by authenticated and anon sessions.
revoke select on table public.equipment_usage_logs
  from PUBLIC, anon, authenticated;

-- Remove any explicit legacy column grants for the two internal identifiers.
-- Repeating these revokes is safe when no such column grants exist.
revoke select (
  created_by,
  idempotency_key
) on table public.equipment_usage_logs
  from PUBLIC, anon, authenticated;

grant select (
  id,
  equipment_id,
  equipment_name_snapshot,
  inventory_number_snapshot,
  usage_type,
  reading,
  previous_reading,
  delta,
  reading_date,
  entry_type,
  object_id,
  object_name_snapshot,
  employee_id,
  employee_name_snapshot,
  note,
  created_by_name,
  created_at
) on table public.equipment_usage_logs
to authenticated;

commit;
