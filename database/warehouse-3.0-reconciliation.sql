-- 0. Warehouse 3.0 global cutover boundary. There must be exactly one row.
select
  ledger_version,
  boundary_movement_id,
  cutover_at
from public.warehouse_ledger_cutovers
where ledger_version = 3;

-- 1. Canonical warehouse balance check.
-- The latest transactionally recorded warehouse_quantity_after is authoritative
-- for the ledger projection. Cutover rows also snapshot a legitimate zero balance;
-- zero is allowed only for opening snapshots, never for operational movement facts.
select
  wi.id as warehouse_item_id,
  wi.name as warehouse_item_name,
  wi.quantity as stored_quantity,
  coalesce(latest.warehouse_quantity_after, 0) as ledger_expected_quantity,
  wi.quantity - coalesce(latest.warehouse_quantity_after, 0) as difference,
  latest.movement_id as latest_ledger_movement_id,
  latest.movement_code as latest_ledger_movement_code,
  case
    when wi.quantity = coalesce(latest.warehouse_quantity_after, 0)
      then 'ok'
    else 'mismatch'
  end as reconciliation_status
from public.warehouse_items wi
left join lateral (
  select
    wm.id as movement_id,
    wm.movement_code,
    wm.warehouse_quantity_after
  from public.warehouse_movements wm
  where wm.item_id = wi.id
    and wm.warehouse_quantity_after is not null
  order by wm.created_at desc, wm.id desc
  limit 1
) latest on true
order by
  case
    when wi.quantity = coalesce(latest.warehouse_quantity_after, 0)
      then 1
    else 0
  end,
  wi.name,
  wi.id;

-- 2. Warehouse flow check from the latest opening snapshot.
-- Rows without an opening anchor are listed as no_opening_anchor instead of
-- pretending that incomplete legacy history is a complete historical ledger.
with latest_opening as (
  select distinct on (wm.item_id)
    wm.item_id,
    wm.id as opening_movement_id,
    wm.quantity as opening_quantity
  from public.warehouse_movements wm
  where wm.item_id is not null
    and wm.movement_code = 'opening_balance'
    and wm.source_type in ('item_creation', 'ledger_cutover')
  order by wm.item_id, wm.created_at desc, wm.id desc
),
flow_after_opening as (
  select
    opening.item_id,
    opening.opening_movement_id,
    opening.opening_quantity,
    coalesce(sum(
      case
        when wm.movement_code in (
          'purchase_receipt',
          'return_from_object',
          'adjustment_in'
        ) then wm.quantity
        when wm.movement_code in (
          'issue_to_object',
          'adjustment_out'
        ) then -wm.quantity
        else 0
      end
    ), 0) as net_change
  from latest_opening opening
  left join public.warehouse_movements wm
    on wm.item_id = opening.item_id
   and wm.id > opening.opening_movement_id
  group by
    opening.item_id,
    opening.opening_movement_id,
    opening.opening_quantity
)
select
  wi.id as warehouse_item_id,
  wi.name as warehouse_item_name,
  wi.quantity as stored_quantity,
  case
    when flow.item_id is null then null
    else flow.opening_quantity + flow.net_change
  end as ledger_expected_quantity,
  case
    when flow.item_id is null then null
    else wi.quantity - (flow.opening_quantity + flow.net_change)
  end as difference,
  case
    when flow.item_id is null then 'no_opening_anchor'
    when wi.quantity = flow.opening_quantity + flow.net_change then 'ok'
    else 'mismatch'
  end as reconciliation_status
from public.warehouse_items wi
left join flow_after_opening flow on flow.item_id = wi.id
order by
  case
    when flow.item_id is null then 0
    when wi.quantity <> flow.opening_quantity + flow.net_change then 1
    else 2
  end,
  wi.name,
  wi.id;

-- 3. Object material balance check, including deleted/fully returned balances.
-- source_id preserves the historical material identity even after SET NULL
-- clears material_id. The latest non-null object_quantity_after is compared
-- with the current balance row (or zero when that row no longer exists).
with material_sources as (
  select distinct source_id as material_id
  from public.warehouse_movements
  where source_id is not null
    and object_id is not null
    and source_type in ('object_material', 'ledger_cutover')
),
latest_state as (
  select
    source.material_id,
    latest.movement_id,
    latest.object_id,
    latest.object_name_snapshot,
    latest.item_name_snapshot,
    latest.object_quantity_after
  from material_sources source
  join lateral (
    select
      wm.id as movement_id,
      wm.object_id,
      wm.object_name_snapshot,
      wm.item_name_snapshot,
      wm.object_quantity_after
    from public.warehouse_movements wm
    where wm.source_id = source.material_id
      and wm.object_id is not null
      and wm.source_type in ('object_material', 'ledger_cutover')
      and wm.object_quantity_after is not null
    order by wm.created_at desc, wm.id desc
    limit 1
  ) latest on true
)
select
  state.material_id,
  state.object_id,
  state.object_name_snapshot,
  coalesce(m.name, state.item_name_snapshot) as material_name,
  coalesce(m.quantity, 0) as stored_quantity,
  state.object_quantity_after as ledger_expected_quantity,
  coalesce(m.quantity, 0) - state.object_quantity_after as difference,
  state.movement_id as latest_ledger_movement_id,
  case
    when coalesce(m.quantity, 0) = state.object_quantity_after then 'ok'
    else 'mismatch'
  end as reconciliation_status
from latest_state state
left join public.materials m on m.id = state.material_id
order by
  case
    when coalesce(m.quantity, 0) = state.object_quantity_after then 1
    else 0
  end,
  state.object_name_snapshot,
  material_name,
  state.material_id;

-- 4. Exact post-cutover object-material cost formula for Reports 3.0.
-- Supply :period_from and :period_to as timestamptz boundaries. The immutable
-- global movement-id checkpoint excludes every fact absorbed by the opening
-- snapshot, including exact Warehouse 3.0 movements committed before POST.
with cutover as (
  select boundary_movement_id
  from public.warehouse_ledger_cutovers
  where ledger_version = 3
)
select
  wm.object_id,
  round(sum(
    case
      when wm.movement_code in ('issue_to_object', 'direct_to_object')
        then wm.total_cost
      when wm.movement_code in ('return_from_object', 'direct_object_reversal')
        then -wm.total_cost
      else 0
    end
  ), 2) as object_material_cost_for_period
from public.warehouse_movements wm
cross join cutover
where wm.object_id is not null
  and wm.id > cutover.boundary_movement_id
  and wm.ledger_version = 3
  and wm.created_at >= :period_from
  and wm.created_at < :period_to
  and wm.movement_code in (
    'issue_to_object',
    'return_from_object',
    'direct_to_object',
    'direct_object_reversal'
  )
group by wm.object_id
order by wm.object_id;
