-- Security / DB Hardening 1A Cleanup-A.
-- Remove structural and maintenance privileges that the application runtime
-- does not use. CRUD privileges, RLS, RPCs and service_role are unchanged.

begin;

-- Production A1/A2/A3 confirmed direct anon grants for all four privileges
-- only on these tables.
revoke truncate, trigger, references, maintain
on table
  public.object_expenses,
  public.objects,
  public.profiles
from anon;

-- Production A1/A2/A3 confirmed all four privileges for authenticated on
-- these tables.
revoke truncate, trigger, references, maintain
on table
  public.app_settings,
  public.employees,
  public.equipment,
  public.materials,
  public.object_expenses,
  public.object_photos,
  public.object_tasks,
  public.objects,
  public.profiles,
  public.push_subscriptions,
  public.task_checklist_items,
  public.warehouse_items,
  public.warehouse_purchases,
  public.work_logs
from authenticated;

-- This table has only the confirmed MAINTAIN grant in the Cleanup-A scope.
revoke maintain
on table public.equipment_service_records
from authenticated;

-- TRUNCATE is already absent here; revoke only the confirmed direct grants.
revoke trigger, references, maintain
on table public.warehouse_movements
from authenticated;

commit;
