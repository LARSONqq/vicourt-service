begin;

-- Cutover is intentionally a current-state snapshot. It does not fabricate
-- historical transaction dates for balances that pre-date Warehouse 3.0.
-- Run this exactly once after the Warehouse 3.0 application is deployed. The
-- cutover checkpoint below makes a rerun a no-op for opening snapshots.
-- Safest rollout: pause stock-changing actions before the application deploy,
-- run this migration immediately after deploy, reconcile, then resume them.
-- The locks/checkpoint still classify any in-flight transaction atomically.
lock table
  public.warehouse_items,
  public.materials,
  public.warehouse_movements
in share row exclusive mode;

-- The cutover boundary uses movement ids. Align the backing sequence before
-- creating snapshots so later default-generated ids are guaranteed to be
-- greater even after a historical/manual data import advanced table ids only.
do $cutover_sequence$
declare
  sequence_name text;
begin
  if exists (
    select 1
    from public.warehouse_ledger_cutovers cutover
    where cutover.ledger_version = 3
  ) then
    return;
  end if;

  sequence_name := pg_get_serial_sequence(
    'public.warehouse_movements',
    'id'
  );

  if sequence_name is null then
    raise exception 'warehouse_movements.id sequence was not found.';
  end if;

  execute format(
    'select setval(%L::regclass, greatest((select coalesce(max(id), 0) from public.warehouse_movements), nextval(%L::regclass)), true)',
    sequence_name,
    sequence_name
  );
end
$cutover_sequence$;

insert into public.warehouse_movements (
  item_id,
  material_id,
  object_id,
  movement_type,
  movement_code,
  ledger_version,
  quantity,
  unit_price,
  item_name_snapshot,
  unit_snapshot,
  object_name_snapshot,
  warehouse_quantity_after,
  object_quantity_after,
  source_type,
  source_id,
  note,
  performed_by,
  performed_by_name
)
select
  wi.id,
  null,
  null,
  'Прихід',
  'opening_balance',
  3,
  wi.quantity,
  wi.purchase_price,
  wi.name,
  wi.unit,
  null,
  wi.quantity,
  null,
  'ledger_cutover',
  wi.id,
  'Початковий snapshot залишку на момент переходу на Warehouse 3.0.',
  null,
  'Система'
from public.warehouse_items wi
where wi.quantity >= 0
  and not exists (
    select 1
    from public.warehouse_ledger_cutovers cutover
    where cutover.ledger_version = 3
  )
  and not exists (
    select 1
    from public.warehouse_movements existing
    where existing.movement_code = 'opening_balance'
      and existing.source_type = 'ledger_cutover'
      and existing.source_id = wi.id
  );

insert into public.warehouse_movements (
  item_id,
  material_id,
  object_id,
  movement_type,
  movement_code,
  ledger_version,
  quantity,
  unit_price,
  item_name_snapshot,
  unit_snapshot,
  object_name_snapshot,
  warehouse_quantity_after,
  object_quantity_after,
  source_type,
  source_id,
  note,
  performed_by,
  performed_by_name
)
select
  m.warehouse_item_id,
  m.id,
  m.object_id,
  'Списання',
  'object_opening_balance',
  3,
  m.quantity,
  m.price,
  m.name,
  m.unit,
  o.name,
  null,
  m.quantity,
  'ledger_cutover',
  m.id,
  'Початковий snapshot матеріалу об’єкта на момент переходу на Warehouse 3.0.',
  null,
  'Система'
from public.materials m
join public.objects o on o.id = m.object_id
where m.quantity > 0
  and not exists (
    select 1
    from public.warehouse_ledger_cutovers cutover
    where cutover.ledger_version = 3
  )
  and not exists (
    select 1
    from public.warehouse_movements existing
    where existing.movement_code = 'object_opening_balance'
      and existing.source_type = 'ledger_cutover'
      and existing.source_id = m.id
  );

-- Because warehouse_movements is locked against concurrent writes, every
-- operational movement committed after this checkpoint receives a greater id.
-- Reports/reconciliation must use this boundary, not movement_code alone.
insert into public.warehouse_ledger_cutovers (
  ledger_version,
  boundary_movement_id,
  cutover_at
)
select
  3,
  coalesce(max(wm.id), 0),
  clock_timestamp()
from public.warehouse_movements wm
where not exists (
  select 1
  from public.warehouse_ledger_cutovers cutover
  where cutover.ledger_version = 3
)
on conflict (ledger_version) do nothing;

alter table public.warehouse_movements enable row level security;

do $migration$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'warehouse_movements'
  loop
    execute format(
      'drop policy %I on public.warehouse_movements',
      policy_record.policyname
    );
  end loop;
end
$migration$;

create policy warehouse_movements_management_select
on public.warehouse_movements
for select
to authenticated
using (
  private.is_active_user()
  and (
    private.has_role('admin')
    or private.has_role('object_manager')
  )
);

revoke all on table public.warehouse_movements
  from public, anon, authenticated;
grant select on table public.warehouse_movements
  to authenticated;

-- Current balances may only change through the canonical transactional RPCs.
-- Metadata updates for warehouse items remain available under the existing RLS.
revoke insert, update, delete, truncate, references, trigger
  on table public.warehouse_items
  from public, anon, authenticated;
grant update (
  name,
  category,
  unit,
  min_quantity,
  target_quantity,
  supplier
) on table public.warehouse_items
  to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on table public.materials
  from public, anon, authenticated;

do $migration$
declare
  sequence_name text;
  table_name text;
begin
  foreach table_name in array array[
    'warehouse_movements',
    'warehouse_items',
    'materials'
  ]
  loop
    sequence_name := pg_get_serial_sequence(
      format('public.%I', table_name),
      'id'
    );

    if sequence_name is not null then
      execute format(
        'revoke all on sequence %s from public, anon, authenticated',
        sequence_name
      );
    end if;
  end loop;
end
$migration$;

notify pgrst, 'reload schema';

commit;
