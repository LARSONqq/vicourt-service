begin;

-- Reports 3.0 reads the immutable Warehouse 3.0 checkpoint without granting
-- authenticated users direct access to the server-internal cutover table.
create or replace function public.get_report_material_ledger_cutover()
returns table (
  ledger_version smallint,
  boundary_movement_id bigint,
  cutover_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для перегляду звітів.'
      using errcode = '42501';
  end if;

  return query
  select
    cutover.ledger_version,
    cutover.boundary_movement_id,
    cutover.cutover_at
  from public.warehouse_ledger_cutovers cutover
  where cutover.ledger_version = 3;
end
$function$;

-- PostgreSQL performs the monetary aggregation. The period result contains
-- only exact facts after the Warehouse 3.0 boundary. The lifetime result uses
-- object opening snapshots as the starting balance and applies only facts
-- committed after that same boundary.
create or replace function public.get_report_object_material_costs(
  p_period_from timestamptz,
  p_period_to timestamptz,
  p_object_id bigint
)
returns table (
  object_id bigint,
  period_exact_cost numeric(20,2),
  lifetime_exact_cost numeric(20,2),
  period_movement_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception 'Недостатньо прав для перегляду звітів.'
      using errcode = '42501';
  end if;

  if p_period_from is null
    or p_period_to is null
    or p_period_from >= p_period_to
  then
    raise exception 'Некоректний період звіту.'
      using errcode = '22007';
  end if;

  if p_object_id is not null and p_object_id <= 0 then
    raise exception 'Некоректний об’єкт звіту.'
      using errcode = '22023';
  end if;

  return query
  with cutover as (
    select
      c.boundary_movement_id
    from public.warehouse_ledger_cutovers c
    where c.ledger_version = 3
  ),
  object_cost_rows as (
    select
      wm.object_id,
      case
        when wm.id > cutover.boundary_movement_id
          and wm.created_at >= p_period_from
          and wm.created_at < p_period_to
          and wm.movement_code in (
            'issue_to_object',
            'direct_to_object'
          )
          then wm.total_cost
        when wm.id > cutover.boundary_movement_id
          and wm.created_at >= p_period_from
          and wm.created_at < p_period_to
          and wm.movement_code in (
            'return_from_object',
            'direct_object_reversal'
          )
          then -wm.total_cost
        else 0::numeric
      end as period_cost,
      (
        wm.id > cutover.boundary_movement_id
        and wm.created_at >= p_period_from
        and wm.created_at < p_period_to
        and wm.movement_code in (
          'issue_to_object',
          'return_from_object',
          'direct_to_object',
          'direct_object_reversal'
        )
      ) as is_period_movement,
      case
        when wm.movement_code = 'object_opening_balance'
          and wm.source_type = 'ledger_cutover'
          then wm.total_cost
        when wm.id > cutover.boundary_movement_id
          and wm.movement_code in (
            'issue_to_object',
            'direct_to_object'
          )
          then wm.total_cost
        when wm.id > cutover.boundary_movement_id
          and wm.movement_code in (
            'return_from_object',
            'direct_object_reversal'
          )
          then -wm.total_cost
        else 0::numeric
      end as lifetime_cost
    from public.warehouse_movements wm
    cross join cutover
    where wm.ledger_version = 3
      and wm.object_id is not null
      and (
        p_object_id is null
        or wm.object_id = p_object_id
      )
      and (
        (
          wm.movement_code = 'object_opening_balance'
          and wm.source_type = 'ledger_cutover'
        )
        or (
          wm.id > cutover.boundary_movement_id
          and wm.movement_code in (
            'issue_to_object',
            'return_from_object',
            'direct_to_object',
            'direct_object_reversal'
          )
        )
      )
  )
  select
    rows.object_id,
    round(sum(rows.period_cost), 2)::numeric(20,2),
    round(sum(rows.lifetime_cost), 2)::numeric(20,2),
    count(*) filter (where rows.is_period_movement)
  from object_cost_rows rows
  group by rows.object_id
  order by rows.object_id;
end
$function$;

revoke all on function public.get_report_material_ledger_cutover()
  from public, anon, authenticated;
grant execute on function public.get_report_material_ledger_cutover()
  to authenticated;

revoke all on function public.get_report_object_material_costs(
  timestamptz,
  timestamptz,
  bigint
) from public, anon, authenticated;
grant execute on function public.get_report_object_material_costs(
  timestamptz,
  timestamptz,
  bigint
) to authenticated;

notify pgrst, 'reload schema';

commit;
