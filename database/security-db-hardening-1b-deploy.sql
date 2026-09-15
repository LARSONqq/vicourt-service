-- Security / DB Hardening 1B: remove confirmed redundant/broad RLS policies
-- without changing the effective application access contract.

begin;

-- Fail closed if the retained policy foundation drifted after the reviewed
-- production snapshot. Any exception rolls back the entire migration.
do $migration$
declare
  rls_target_table_count integer;
  retained_task_policy_count integer;
begin
  select count(*)
  into rls_target_table_count
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = relation.relnamespace
  where namespace_row.nspname = 'public'
    and relation.relname in (
      'equipment_service_records',
      'warehouse_movements',
      'object_tasks'
    )
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity;

  if rls_target_table_count <> 3 then
    raise exception
      'Hardening 1B aborted: expected RLS-enabled target tables are missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'equipment_service_records'
      and policy.policyname = 'equipment_service_records_active_select_v2'
      and policy.cmd = 'SELECT'
      and policy.permissive = 'PERMISSIVE'
      and policy.roles = array['authenticated'::name]
      and regexp_replace(
        lower(coalesce(policy.qual::text, '')),
        '[[:space:]]+',
        '',
        'g'
      ) in (
        'private.is_active_user()',
        '(private.is_active_user())'
      )
  ) then
    raise exception
      'Hardening 1B aborted: canonical equipment service SELECT policy drifted';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'warehouse_movements'
      and policy.policyname = 'warehouse_movements_management_select_guard'
      and policy.cmd = 'SELECT'
      and policy.permissive = 'RESTRICTIVE'
      and policy.roles = array['authenticated'::name]
      and regexp_replace(
        lower(coalesce(policy.qual::text, '')),
        '[[:space:]]+',
        '',
        'g'
      ) like '%private.is_active_user()%'
      and regexp_replace(
        lower(coalesce(policy.qual::text, '')),
        '[[:space:]]+',
        '',
        'g'
      ) like '%private.has_role%'
      and policy.qual::text like '%admin%'
      and policy.qual::text like '%object_manager%'
  ) then
    raise exception
      'Hardening 1B aborted: Warehouse management guard drifted';
  end if;

  with expected_policy(policy_name, command, policy_mode) as (
    values
      (
        'Authenticated users can read object tasks'::text,
        'SELECT'::text,
        'PERMISSIVE'::text
      ),
      (
        'Authenticated users can create object tasks',
        'INSERT',
        'PERMISSIVE'
      ),
      (
        'Authenticated users can update object tasks',
        'UPDATE',
        'PERMISSIVE'
      ),
      (
        'Authenticated users can delete object tasks',
        'DELETE',
        'PERMISSIVE'
      ),
      (
        'object_tasks_equipment_maintenance_insert_guard',
        'INSERT',
        'RESTRICTIVE'
      ),
      (
        'object_tasks_equipment_maintenance_update_guard',
        'UPDATE',
        'RESTRICTIVE'
      ),
      (
        'object_tasks_equipment_maintenance_delete_guard',
        'DELETE',
        'RESTRICTIVE'
      )
  )
  select count(*)
  into retained_task_policy_count
  from expected_policy expected
  join pg_catalog.pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = 'object_tasks'
   and policy.policyname = expected.policy_name
   and policy.cmd = expected.command
   and policy.permissive = expected.policy_mode
   and policy.roles = array['authenticated'::name];

  if retained_task_policy_count <> 7 then
    raise exception
      'Hardening 1B aborted: retained object_tasks policy set drifted';
  end if;
end
$migration$;

-- The legacy policy is semantically equivalent to the canonical v2 policy:
-- both are permissive SELECT policies for authenticated users and evaluate
-- private.is_active_user(). Keep the canonical source-backed policy only.
drop policy if exists
  "Authenticated users can read equipment service records"
  on public.equipment_service_records;

-- Converge Warehouse SELECT policies on the source-backed management policy.
-- The restrictive management guard remains in place and is not altered here.
drop policy if exists warehouse_movements_management_select
  on public.warehouse_movements;

create policy warehouse_movements_management_select
on public.warehouse_movements
for select
to authenticated
using (
  private.is_active_user()
  and private.has_role(
    array['admin', 'object_manager']::text[]
  )
);

drop policy if exists
  "Authenticated users can read warehouse movements"
  on public.warehouse_movements;

-- These equipment-specific permissive policies are subsets of the retained
-- general active-user policies. Maintenance restrictive guards remain active.
drop policy if exists object_tasks_equipment_select
  on public.object_tasks;

drop policy if exists object_tasks_equipment_manual_insert
  on public.object_tasks;

drop policy if exists object_tasks_equipment_manual_update
  on public.object_tasks;

drop policy if exists object_tasks_equipment_manual_delete
  on public.object_tasks;

commit;
