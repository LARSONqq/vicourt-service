-- Security / DB Hardening 1A: existing application sequence cleanup.
-- Existing table/default privileges, RLS, RPCs and service_role are unchanged.

begin;

-- Anonymous application flows never insert directly into the owning tables.
revoke all privileges
on sequence
  public.employees_id_seq,
  public.equipment_id_seq,
  public.equipment_inventory_number_seq,
  public.materials_id_seq,
  public.object_documents_id_seq,
  public.object_expenses_id_seq,
  public.object_payment_schedule_id_seq,
  public.object_payments_id_seq,
  public.object_photos_id_seq,
  public.object_tasks_id_seq,
  public.objects_id_seq,
  public.task_checklist_items_id_seq,
  public.warehouse_items_id_seq,
  public.warehouse_movements_id_seq,
  public.warehouse_purchases_id_seq,
  public.work_logs_id_seq
from anon;

-- These rows are created only inside repository-confirmed SECURITY DEFINER
-- warehouse/material RPCs, so authenticated needs no direct sequence access.
revoke all privileges
on sequence
  public.materials_id_seq,
  public.warehouse_items_id_seq,
  public.warehouse_movements_id_seq
from authenticated;

-- User-scoped application code inserts directly into these owning tables.
-- nextval() needs USAGE (or UPDATE); keep only the narrower USAGE privilege.
-- equipment intentionally has no table-level INSERT, but its explicit
-- column-level INSERT grant covers createEquipment()'s authenticated payload.
revoke all privileges
on sequence
  public.employees_id_seq,
  public.equipment_id_seq,
  public.object_documents_id_seq,
  public.object_expenses_id_seq,
  public.object_payment_schedule_id_seq,
  public.object_payments_id_seq,
  public.object_photos_id_seq,
  public.object_tasks_id_seq,
  public.objects_id_seq,
  public.task_checklist_items_id_seq,
  public.work_logs_id_seq
from authenticated;

grant usage
on sequence
  public.employees_id_seq,
  public.equipment_id_seq,
  public.object_documents_id_seq,
  public.object_expenses_id_seq,
  public.object_payment_schedule_id_seq,
  public.object_payments_id_seq,
  public.object_photos_id_seq,
  public.object_tasks_id_seq,
  public.objects_id_seq,
  public.task_checklist_items_id_seq,
  public.work_logs_id_seq
to authenticated;

-- authenticated privileges on these SPECIAL sequences are intentionally left
-- unchanged pending production-contract review:
--   public.equipment_inventory_number_seq
--   public.warehouse_purchases_id_seq

commit;
