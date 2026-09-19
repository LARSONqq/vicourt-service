-- Dashboard 3.0B production audit. Strictly read-only.
-- Returns one consolidated PASS/FAIL result set.

begin;
set transaction read only;

with expected_functions as (
  select *
  from (values
    (
      10,
      'warehouse_summary_function',
      pg_catalog.to_regprocedure('public.get_warehouse_stock_summary()')::oid,
      'table(out_of_stock_count bigint, low_stock_count bigint, attention_count bigint)',
      array['auth.uid() is null', 'private.is_active_user()', 'quantity <= 0', 'quantity > 0', 'quantity <= min_quantity']::text[]
    ),
    (
      20,
      'equipment_summary_function',
      pg_catalog.to_regprocedure('public.get_equipment_maintenance_summary(date)')::oid,
      'table(overdue_count bigint, due_now_count bigint, upcoming_7_count bigint, usage_due_count bigint, attention_count bigint)',
      array['auth.uid() is null', 'private.is_active_user()', 'current_usage >= next_maintenance_usage', 'next_service_date < p_business_date', 'next_service_date <= p_business_date + 7']::text[]
    )
  ) value(
    sort_order,
    check_name,
    function_oid,
    expected_result,
    required_definition_fragments
  )
), function_checks as (
  select
    expected.sort_order,
    expected.check_name,
    expected.function_oid is not null
      and not function_row.prosecdef
      and lower(pg_catalog.pg_get_function_result(expected.function_oid)) = expected.expected_result
      and exists (
        select 1
        from unnest(coalesce(function_row.proconfig, array[]::text[])) config_entry
        where replace(config_entry::text, ' ', '') in ('search_path=', 'search_path=""')
      )
      and not exists (
        select 1
        from unnest(expected.required_definition_fragments) fragment
        where position(
          pg_catalog.regexp_replace(lower(fragment), '[[:space:]]+', '', 'g')
          in pg_catalog.regexp_replace(
            lower(pg_catalog.pg_get_functiondef(expected.function_oid)),
            '[[:space:]]+',
            '',
            'g'
          )
        ) = 0
      )
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            function_row.proacl,
            pg_catalog.acldefault('f', function_row.proowner)
          )
        ) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
      and not pg_catalog.has_function_privilege('anon', expected.function_oid, 'EXECUTE')
      and pg_catalog.has_function_privilege('authenticated', expected.function_oid, 'EXECUTE')
      and pg_catalog.has_function_privilege('service_role', expected.function_oid, 'EXECUTE')
      and pg_catalog.pg_get_function_result(expected.function_oid) !~* '(cost|price|amount|finance)'
      as passed,
    concat_ws(
      '; ',
      'signature=' || coalesce(expected.function_oid::regprocedure::text, '(missing)'),
      'security=' || case when function_row.prosecdef then 'DEFINER' else 'INVOKER' end,
      'result=' || coalesce(pg_catalog.pg_get_function_result(expected.function_oid), '(missing)'),
      'PUBLIC=' || coalesce((
        select bool_or(acl.privilege_type = 'EXECUTE')::text
        from pg_catalog.aclexplode(
          coalesce(function_row.proacl, pg_catalog.acldefault('f', function_row.proowner))
        ) acl
        where acl.grantee = 0
      ), 'false'),
      'anon=' || coalesce(pg_catalog.has_function_privilege('anon', expected.function_oid, 'EXECUTE')::text, 'false'),
      'authenticated=' || coalesce(pg_catalog.has_function_privilege('authenticated', expected.function_oid, 'EXECUTE')::text, 'false'),
      'service_role=' || coalesce(pg_catalog.has_function_privilege('service_role', expected.function_oid, 'EXECUTE')::text, 'false')
    ) as details
  from expected_functions expected
  left join pg_catalog.pg_proc function_row
    on function_row.oid = expected.function_oid
), source_access_check as (
  select
    30 as sort_order,
    'worker_safe_invoker_source_access' as check_name,
    (
      select bool_and(pg_catalog.has_column_privilege('authenticated', table_name, column_name, 'SELECT'))
      from (values
        ('public.warehouse_items', 'quantity'),
        ('public.warehouse_items', 'min_quantity'),
        ('public.equipment', 'maintenance_interval_days'),
        ('public.equipment', 'next_service_date'),
        ('public.equipment', 'usage_type'),
        ('public.equipment', 'current_usage'),
        ('public.equipment', 'maintenance_interval_usage'),
        ('public.equipment', 'next_maintenance_usage')
      ) source(table_name, column_name)
    )
    and (
      select bool_and(class_row.relrowsecurity)
      from pg_catalog.pg_class class_row
      where class_row.oid in (
        'public.warehouse_items'::regclass,
        'public.equipment'::regclass
      )
    ) as passed,
    'SECURITY INVOKER; authenticated operational columns available; RLS required on both source tables' as details
), checks as (
  select * from function_checks
  union all
  select * from source_access_check
), output as (
  select sort_order, check_name, passed, details
  from checks
  union all
  select
    999,
    'DASHBOARD_3_0B_AUDIT_SUMMARY',
    bool_and(passed),
    format(
      'passed=%s; failed=%s; total=%s',
      count(*) filter (where passed),
      count(*) filter (where not passed),
      count(*)
    )
  from checks
)
select check_name, passed, details
from output
order by sort_order;

commit;
