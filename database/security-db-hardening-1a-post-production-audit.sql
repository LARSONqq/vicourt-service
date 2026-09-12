-- Security / DB Hardening 1A POST: standalone read-only production audit.
-- Safe to run manually in Supabase SQL Editor after the POST migration.

begin;
set transaction read only;

-- A1. Table-level SELECT must be absent for authenticated. RLS still applies
-- to roles that have access through the operational column grants.
with requested_roles(role_name) as (
  values
    ('anon'::text),
    ('authenticated'::text),
    ('service_role'::text)
)
select
  'A1'::text as audit_section,
  requested_role.role_name,
  pg_catalog.has_table_privilege(
    requested_role.role_name,
    'public.equipment_usage_logs',
    'SELECT'
  ) as has_table_select,
  case
    when requested_role.role_name = 'authenticated'
      then not pg_catalog.has_table_privilege(
        requested_role.role_name,
        'public.equipment_usage_logs',
        'SELECT'
      )
    else null
  end as authenticated_contract_matches
from requested_roles requested_role
order by requested_role.role_name;

-- A2. Internal identifiers must not be directly selectable by authenticated.
with hidden_columns(column_name) as (
  values
    ('created_by'::text),
    ('idempotency_key'::text)
)
select
  'A2'::text as audit_section,
  hidden.column_name,
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.equipment_usage_logs',
    hidden.column_name,
    'SELECT'
  ) as authenticated_can_select,
  not pg_catalog.has_column_privilege(
    'authenticated',
    'public.equipment_usage_logs',
    hidden.column_name,
    'SELECT'
  ) as hidden_contract_matches
from hidden_columns hidden
order by hidden.column_name;

-- B. Every operational column required by Equipment/Object/Employee history
-- must remain selectable by authenticated users.
with operational_columns(column_order, column_name) as (
  values
    (1, 'id'::text),
    (2, 'equipment_id'),
    (3, 'equipment_name_snapshot'),
    (4, 'inventory_number_snapshot'),
    (5, 'usage_type'),
    (6, 'reading'),
    (7, 'previous_reading'),
    (8, 'delta'),
    (9, 'reading_date'),
    (10, 'entry_type'),
    (11, 'object_id'),
    (12, 'object_name_snapshot'),
    (13, 'employee_id'),
    (14, 'employee_name_snapshot'),
    (15, 'note'),
    (16, 'created_by_name'),
    (17, 'created_at')
)
select
  'B'::text as audit_section,
  operational.column_order,
  operational.column_name,
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.equipment_usage_logs',
    operational.column_name,
    'SELECT'
  ) as authenticated_can_select,
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.equipment_usage_logs',
    operational.column_name,
    'SELECT'
  ) as operational_contract_matches
from operational_columns operational
order by operational.column_order;

-- C1. RLS state must remain enabled and unchanged by the privilege migration.
select
  'C1'::text as audit_section,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
where namespace_row.nspname = 'public'
  and relation.relname = 'equipment_usage_logs'
  and relation.relkind in ('r', 'p');

-- C2. The existing active-user SELECT policy must still be present. No RLS
-- policy is added, removed or altered by POST.
with expected(policy_name) as (
  values ('equipment_usage_logs_active_select'::name)
)
select
  'C2'::text as audit_section,
  policy.policyname is not null as policy_exists,
  policy.policyname,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual,
  policy.policyname = expected.policy_name
    and policy.cmd in ('SELECT', 'ALL')
    and 'authenticated'::name = any(policy.roles)
    and pg_catalog.strpos(
      pg_catalog.lower(coalesce(policy.qual, '')),
      'private.is_active_user()'
    ) > 0 as expected_active_select_policy
from expected
left join pg_catalog.pg_policies policy
  on policy.schemaname = 'public'
 and policy.tablename = 'equipment_usage_logs'
 and policy.policyname = expected.policy_name;

-- C3. Show all remaining policies for regression evidence.
select
  'C3'::text as audit_section,
  policy.policyname,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual,
  policy.with_check
from pg_catalog.pg_policies policy
where policy.schemaname = 'public'
  and policy.tablename = 'equipment_usage_logs'
order by policy.cmd, policy.policyname;

-- D. Function signatures, security mode, raw ACL and effective EXECUTE stay
-- observable for both canonical usage mutation RPCs.
with expected_functions(function_name, signature) as (
  values
    (
      'record_equipment_usage'::text,
      'public.record_equipment_usage(bigint,numeric,date,text,text)'::text
    ),
    (
      'record_equipment_work_session'::text,
      'public.record_equipment_work_session(bigint,numeric,date,bigint,bigint,text,uuid)'::text
    )
),
requested_roles(role_name, expected_execute) as (
  values
    ('anon'::text, false),
    ('authenticated'::text, true),
    ('service_role'::text, null::boolean)
)
select
  'D'::text as audit_section,
  expected.function_name,
  expected.signature,
  procedure_row.oid is not null as function_exists,
  procedure_row.prosecdef as security_definer,
  procedure_row.proconfig as function_config,
  procedure_row.proacl::text as raw_function_acl,
  requested_role.role_name,
  pg_catalog.has_function_privilege(
    requested_role.role_name,
    procedure_row.oid,
    'EXECUTE'
  ) as has_execute,
  case
    when requested_role.expected_execute is null then null
    else pg_catalog.has_function_privilege(
      requested_role.role_name,
      procedure_row.oid,
      'EXECUTE'
    ) = requested_role.expected_execute
  end as execute_contract_matches
from expected_functions expected
cross join requested_roles requested_role
left join pg_catalog.pg_proc procedure_row
  on procedure_row.oid = pg_catalog.to_regprocedure(
    expected.signature
  )
order by expected.function_name, requested_role.role_name;

commit;
