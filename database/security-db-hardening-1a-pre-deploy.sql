-- Security / DB Hardening 1A PRE: close direct Warehouse ledger access
-- for workers without changing the existing permissive SELECT policies,
-- table grants, RPCs or application reader architecture.

begin;

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'warehouse_movements'
      and policy.policyname =
        'warehouse_movements_management_select_guard'
  ) then
    execute $policy$
      create policy warehouse_movements_management_select_guard
      on public.warehouse_movements
      as restrictive
      for select
      to authenticated
      using (
        private.is_active_user()
        and private.has_role(
          array['admin', 'object_manager']::text[]
        )
      )
    $policy$;
  end if;
end
$migration$;

commit;
