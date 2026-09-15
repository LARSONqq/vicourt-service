-- Security / DB Hardening 1B: post-deploy RLS contract audit.
-- Strictly read-only and returns one consolidated review table.

begin;
set transaction read only;

with policy_state as (
  select
    policy.tablename::text as table_name,
    policy.policyname::text as policy_name,
    policy.cmd::text as command,
    policy.permissive::text as policy_mode,
    coalesce(
      (
        select string_agg(role_name::text, ',' order by role_name::text)
        from unnest(policy.roles) as role_value(role_name)
      ),
      ''
    ) as policy_roles,
    policy.qual::text as using_expression,
    policy.with_check::text as with_check_expression,
    regexp_replace(
      lower(coalesce(policy.qual::text, '')),
      '[[:space:]]+',
      '',
      'g'
    ) as normalized_using,
    regexp_replace(
      lower(coalesce(policy.with_check::text, '')),
      '[[:space:]]+',
      '',
      'g'
    ) as normalized_with_check,
    case
      when policy.with_check is null then regexp_replace(
        lower(coalesce(policy.qual::text, '')),
        '[[:space:]]+',
        '',
        'g'
      )
      else regexp_replace(
        lower(policy.with_check::text),
        '[[:space:]]+',
        '',
        'g'
      )
    end as normalized_effective_check
  from pg_catalog.pg_policies policy
  where policy.schemaname = 'public'
    and policy.tablename in (
      'equipment_service_records',
      'warehouse_movements',
      'object_tasks',
      'profiles'
    )
),
policy_expectations(
  check_order,
  table_name,
  contract_area,
  policy_name,
  should_exist,
  expected_command,
  expected_mode,
  expected_roles,
  predicate_contract,
  notes
) as (
  values
    (
      10,
      'equipment_service_records'::text,
      'service SELECT cleanup'::text,
      'Authenticated users can read equipment service records'::text,
      false,
      null::text,
      null::text,
      null::text,
      'ABSENT'::text,
      'Legacy scalar-subquery duplicate must be absent.'::text
    ),
    (
      11,
      'equipment_service_records',
      'service SELECT cleanup',
      'equipment_service_records_active_select_v2',
      true,
      'SELECT',
      'PERMISSIVE',
      'authenticated',
      'ACTIVE_USING_DIRECT',
      'Canonical source policy from equipment-2.1-post-deploy.sql.'
    ),
    (
      20,
      'warehouse_movements',
      'ledger SELECT cleanup',
      'Authenticated users can read warehouse movements',
      false,
      null,
      null,
      null,
      'ABSENT',
      'Legacy broad active-user policy must be absent.'
    ),
    (
      21,
      'warehouse_movements',
      'ledger SELECT cleanup',
      'warehouse_movements_management_select',
      true,
      'SELECT',
      'PERMISSIVE',
      'authenticated',
      'MANAGEMENT_USING',
      'Canonical permissive policy must be management-only.'
    ),
    (
      22,
      'warehouse_movements',
      'ledger SELECT cleanup',
      'warehouse_movements_management_select_guard',
      true,
      'SELECT',
      'RESTRICTIVE',
      'authenticated',
      'MANAGEMENT_USING',
      'Hardening 1A restrictive guard remains unchanged.'
    ),
    (
      30,
      'object_tasks',
      'task SELECT cleanup',
      'object_tasks_equipment_select',
      false,
      null,
      null,
      null,
      'ABSENT',
      'Redundant equipment-specific permissive SELECT must be absent.'
    ),
    (
      31,
      'object_tasks',
      'task INSERT cleanup',
      'object_tasks_equipment_manual_insert',
      false,
      null,
      null,
      null,
      'ABSENT',
      'Redundant manual-equipment permissive INSERT must be absent.'
    ),
    (
      32,
      'object_tasks',
      'task UPDATE cleanup',
      'object_tasks_equipment_manual_update',
      false,
      null,
      null,
      null,
      'ABSENT',
      'Redundant manual-equipment permissive UPDATE must be absent.'
    ),
    (
      33,
      'object_tasks',
      'task DELETE cleanup',
      'object_tasks_equipment_manual_delete',
      false,
      null,
      null,
      null,
      'ABSENT',
      'Redundant manual-equipment permissive DELETE must be absent.'
    ),
    (
      40,
      'object_tasks',
      'general task access',
      'Authenticated users can read object tasks',
      true,
      'SELECT',
      'PERMISSIVE',
      'authenticated',
      'ACTIVE_USING',
      'Retained general active-user SELECT policy.'
    ),
    (
      41,
      'object_tasks',
      'general task access',
      'Authenticated users can create object tasks',
      true,
      'INSERT',
      'PERMISSIVE',
      'authenticated',
      'ACTIVE_CHECK',
      'Retained general active-user INSERT policy.'
    ),
    (
      42,
      'object_tasks',
      'general task access',
      'Authenticated users can update object tasks',
      true,
      'UPDATE',
      'PERMISSIVE',
      'authenticated',
      'ACTIVE_BOTH',
      'Retained general active-user UPDATE policy.'
    ),
    (
      43,
      'object_tasks',
      'general task access',
      'Authenticated users can delete object tasks',
      true,
      'DELETE',
      'PERMISSIVE',
      'authenticated',
      'ACTIVE_USING',
      'Retained general active-user DELETE policy.'
    ),
    (
      50,
      'object_tasks',
      'maintenance mutation guard',
      'object_tasks_equipment_maintenance_insert_guard',
      true,
      'INSERT',
      'RESTRICTIVE',
      'authenticated',
      'NONEMPTY_CHECK',
      'Retained maintenance INSERT guard; exact predicate is reported.'
    ),
    (
      51,
      'object_tasks',
      'maintenance mutation guard',
      'object_tasks_equipment_maintenance_update_guard',
      true,
      'UPDATE',
      'RESTRICTIVE',
      'authenticated',
      'NONEMPTY_BOTH',
      'Retained maintenance UPDATE guard; exact predicates are reported.'
    ),
    (
      52,
      'object_tasks',
      'maintenance mutation guard',
      'object_tasks_equipment_maintenance_delete_guard',
      true,
      'DELETE',
      'RESTRICTIVE',
      'authenticated',
      'NONEMPTY_USING',
      'Retained maintenance DELETE guard; exact predicate is reported.'
    ),
    (
      60,
      'profiles',
      'intentional profile SELECT OR',
      'Admins can read all profiles',
      true,
      'SELECT',
      'PERMISSIVE',
      null,
      'PRESENT',
      'Intentional admin-wide SELECT policy must remain.'
    ),
    (
      61,
      'profiles',
      'intentional profile SELECT OR',
      'Users can read own profile',
      true,
      'SELECT',
      'PERMISSIVE',
      null,
      'PRESENT',
      'Intentional self-read SELECT policy must remain.'
    )
),
joined_policy_checks as (
  select
    expectation.*,
    policy.policy_name as actual_policy_name,
    policy.command as actual_command,
    policy.policy_mode as actual_mode,
    policy.policy_roles as actual_roles,
    policy.using_expression,
    policy.with_check_expression,
    policy.normalized_using,
    policy.normalized_with_check,
    policy.normalized_effective_check
  from policy_expectations expectation
  left join policy_state policy
    on policy.table_name = expectation.table_name
   and policy.policy_name = expectation.policy_name
),
evaluated_policy_checks as (
  select
    policy_check.*,
    case
      when not policy_check.should_exist then
        policy_check.actual_policy_name is null
      else
        policy_check.actual_policy_name is not null
        and policy_check.actual_command = policy_check.expected_command
        and policy_check.actual_mode = policy_check.expected_mode
        and (
          policy_check.expected_roles is null
          or policy_check.actual_roles = policy_check.expected_roles
        )
        and case policy_check.predicate_contract
          when 'ACTIVE_USING_DIRECT' then
            policy_check.normalized_using in (
              'private.is_active_user()',
              '(private.is_active_user())'
            )
            and policy_check.normalized_with_check = ''
          when 'MANAGEMENT_USING' then
            policy_check.normalized_using like
              '%private.is_active_user()%'
            and policy_check.normalized_using like '%private.has_role%'
            and policy_check.normalized_using like '%admin%'
            and policy_check.normalized_using like '%object_manager%'
            and policy_check.normalized_using not like '%worker%'
            and policy_check.normalized_using !~
              '(^|[^a-z_])or([^a-z_]|$)'
            and policy_check.normalized_with_check = ''
          when 'ACTIVE_USING' then
            policy_check.normalized_using like
              '%private.is_active_user()%'
            and policy_check.normalized_with_check = ''
          when 'ACTIVE_CHECK' then
            policy_check.normalized_using = ''
            and policy_check.normalized_with_check like
              '%private.is_active_user()%'
          when 'ACTIVE_BOTH' then
            policy_check.normalized_using like
              '%private.is_active_user()%'
            and policy_check.normalized_effective_check like
              '%private.is_active_user()%'
          when 'NONEMPTY_USING' then
            policy_check.normalized_using <> ''
            and policy_check.normalized_with_check = ''
          when 'NONEMPTY_CHECK' then
            policy_check.normalized_using = ''
            and policy_check.normalized_with_check <> ''
          when 'NONEMPTY_BOTH' then
            policy_check.normalized_using <> ''
            and policy_check.normalized_effective_check <> ''
          when 'PRESENT' then true
          else false
        end
    end as contract_matches
  from joined_policy_checks policy_check
),
policy_check_rows as (
  select
    policy_check.check_order,
    policy_check.table_name,
    policy_check.contract_area,
    case
      when policy_check.should_exist then format(
        'present: %s; %s; roles=%s; predicate=%s',
        policy_check.expected_command,
        policy_check.expected_mode,
        coalesce(policy_check.expected_roles, '(preserved)'),
        policy_check.predicate_contract
      )
      else 'policy absent'
    end as expected_state,
    case
      when policy_check.actual_policy_name is null then
        'policy absent'
      else format(
        'present: %s; %s; roles=%s; USING=%s; WITH CHECK=%s',
        policy_check.actual_command,
        policy_check.actual_mode,
        policy_check.actual_roles,
        coalesce(policy_check.using_expression, '(none)'),
        coalesce(policy_check.with_check_expression, '(none)')
      )
    end as actual_state,
    policy_check.contract_matches,
    policy_check.policy_name || ' | ' || policy_check.notes as notes
  from evaluated_policy_checks policy_check
),
policy_set_expectations(
  check_order,
  table_name,
  contract_area,
  command,
  expected_policy_names,
  notes
) as (
  values
    (
      70,
      'equipment_service_records'::text,
      'complete SELECT set'::text,
      'SELECT'::text,
      array[
        'equipment_service_records_active_select_v2'
      ]::text[],
      'No extra SELECT policy may restore legacy overlap.'::text
    ),
    (
      71,
      'warehouse_movements',
      'complete SELECT set',
      'SELECT',
      array[
        'warehouse_movements_management_select',
        'warehouse_movements_management_select_guard'
      ]::text[],
      'Only canonical management SELECT plus its restrictive guard.'
    ),
    (
      72,
      'object_tasks',
      'effective SELECT set',
      'SELECT',
      array[
        'Authenticated users can read object tasks'
      ]::text[],
      'General active-user SELECT is the only permissive SELECT path.'
    ),
    (
      73,
      'object_tasks',
      'effective INSERT set',
      'INSERT',
      array[
        'Authenticated users can create object tasks',
        'object_tasks_equipment_maintenance_insert_guard'
      ]::text[],
      'General permissive INSERT remains constrained by maintenance guard.'
    ),
    (
      74,
      'object_tasks',
      'effective UPDATE set',
      'UPDATE',
      array[
        'Authenticated users can update object tasks',
        'object_tasks_equipment_maintenance_update_guard'
      ]::text[],
      'General permissive UPDATE remains constrained by maintenance guard.'
    ),
    (
      75,
      'object_tasks',
      'effective DELETE set',
      'DELETE',
      array[
        'Authenticated users can delete object tasks',
        'object_tasks_equipment_maintenance_delete_guard'
      ]::text[],
      'General permissive DELETE remains constrained by maintenance guard.'
    )
),
policy_set_checks as (
  select
    expectation.check_order,
    expectation.table_name,
    expectation.contract_area,
    'exact policy set: ' || array_to_string(
      expectation.expected_policy_names,
      ', '
    ) as expected_state,
    'actual policy set: ' || coalesce(
      array_to_string(actual_policy.actual_policy_names, ', '),
      '(none)'
    ) as actual_state,
    actual_policy.actual_policy_names @> expectation.expected_policy_names
      and expectation.expected_policy_names
        @> actual_policy.actual_policy_names as contract_matches,
    expectation.notes
  from policy_set_expectations expectation
  cross join lateral (
    select coalesce(
      array_agg(policy.policy_name order by policy.policy_name),
      array[]::text[]
    ) as actual_policy_names
    from policy_state policy
    where policy.table_name = expectation.table_name
      and policy.command in (expectation.command, 'ALL')
  ) actual_policy
),
rls_expectations(check_order, table_name, notes) as (
  values
    (
      80,
      'equipment_service_records'::text,
      'Service history remains protected by RLS.'::text
    ),
    (
      81,
      'warehouse_movements',
      'Warehouse ledger remains protected by RLS.'
    ),
    (
      82,
      'object_tasks',
      'Task policy algebra requires RLS to remain enabled.'
    ),
    (
      83,
      'profiles',
      'Intentional profile policy OR requires RLS to remain enabled.'
    )
),
rls_check_rows as (
  select
    expectation.check_order,
    expectation.table_name,
    'RLS state'::text as contract_area,
    'RLS enabled'::text as expected_state,
    case
      when relation.oid is null then 'table missing'
      else format(
        'RLS enabled=%s; forced=%s',
        relation.relrowsecurity,
        relation.relforcerowsecurity
      )
    end as actual_state,
    coalesce(relation.relrowsecurity, false) as contract_matches,
    expectation.notes
  from rls_expectations expectation
  left join pg_catalog.pg_namespace namespace_row
    on namespace_row.nspname = 'public'
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace_row.oid
   and relation.relname = expectation.table_name
   and relation.relkind in ('r', 'p')
),
enforced_checks as (
  select * from policy_check_rows
  union all
  select * from policy_set_checks
  union all
  select * from rls_check_rows
),
table_contract_rows as (
  select
    900 + min(check_row.check_order) as check_order,
    check_row.table_name,
    'TABLE_CONTRACT'::text as contract_area,
    'all Hardening 1B checks pass'::text as expected_state,
    format(
      '%s/%s checks pass',
      count(*) filter (where check_row.contract_matches),
      count(*)
    ) as actual_state,
    bool_and(check_row.contract_matches) as contract_matches,
    case check_row.table_name
      when 'equipment_service_records' then
        'Operational SELECT remains active-user scoped; service cost grants/RPC are unchanged.'
      when 'warehouse_movements' then
        'Effective SELECT is management-only; DML policies and RPCs are unchanged.'
      when 'object_tasks' then
        'For E => G: G OR E = G; restrictive maintenance guards remain applied to DML.'
      when 'profiles' then
        'Admin-wide OR self-read policy layering remains intentional.'
    end as notes
  from enforced_checks check_row
  group by check_row.table_name
),
all_contract_rows as (
  select * from enforced_checks
  union all
  select * from table_contract_rows
),
overall_contract_row as (
  select
    9999 as check_order,
    'ALL_AFFECTED_TABLES'::text as table_name,
    'HARDENING_1B_CONTRACT'::text as contract_area,
    'every enforced check passes'::text as expected_state,
    format(
      '%s/%s checks pass',
      count(*) filter (where contract_row.contract_matches),
      count(*)
    ) as actual_state,
    bool_and(contract_row.contract_matches) as contract_matches,
    'No grants, functions, RPCs or non-target RLS policies are evaluated as changed.'::text
      as notes
  from enforced_checks contract_row
)
select
  result.table_name,
  result.contract_area,
  result.expected_state,
  result.actual_state,
  result.contract_matches,
  result.notes
from (
  select * from all_contract_rows
  union all
  select * from overall_contract_row
) result
order by result.check_order, result.table_name, result.contract_area;

commit;
