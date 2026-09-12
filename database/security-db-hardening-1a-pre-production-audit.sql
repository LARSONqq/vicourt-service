-- Security / DB Hardening 1A PRE: standalone read-only production audit.
-- Safe to run manually in Supabase SQL Editor after the PRE migration.

begin;
set transaction read only;

-- A. RLS must be enabled for the restrictive guard to apply.
select
  'A'::text as audit_section,
  pg_catalog.to_regclass(
    'public.warehouse_movements'
  ) is not null as table_exists,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
where namespace_row.nspname = 'public'
  and relation.relname = 'warehouse_movements'
  and relation.relkind in ('r', 'p');

-- B/C. Verify the exact guard identity, combination mode, command, role and
-- expected active-management predicates. The raw qualification is returned
-- as evidence in addition to the individual checks.
with expected(policy_name) as (
  values (
    'warehouse_movements_management_select_guard'::name
  )
)
select
  'B/C'::text as audit_section,
  policy.policyname is not null as policy_exists,
  policy.policyname,
  policy.permissive,
  policy.permissive = 'RESTRICTIVE' as is_restrictive,
  policy.cmd,
  policy.cmd = 'SELECT' as is_select_policy,
  policy.roles,
  'authenticated'::name = any(policy.roles)
    and pg_catalog.array_length(policy.roles, 1) = 1
    as authenticated_role_only,
  policy.qual,
  pg_catalog.strpos(
    pg_catalog.lower(coalesce(policy.qual, '')),
    'private.is_active_user()'
  ) > 0 as has_active_user_guard,
  pg_catalog.strpos(
    pg_catalog.lower(coalesce(policy.qual, '')),
    'private.has_role'
  ) > 0
    and pg_catalog.strpos(
      pg_catalog.lower(coalesce(policy.qual, '')),
      'admin'
    ) > 0
    and pg_catalog.strpos(
      pg_catalog.lower(coalesce(policy.qual, '')),
      'object_manager'
    ) > 0 as has_management_role_guard
from expected
left join pg_catalog.pg_policies policy
  on policy.schemaname = 'public'
 and policy.tablename = 'warehouse_movements'
 and policy.policyname = expected.policy_name;

-- D. Show every policy that can participate in SELECT evaluation. PostgreSQL
-- ORs permissive policies and then ANDs the result with restrictive policies.
select
  'D'::text as audit_section,
  policy.policyname,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual,
  policy.with_check
from pg_catalog.pg_policies policy
where policy.schemaname = 'public'
  and policy.tablename = 'warehouse_movements'
  and policy.cmd in ('SELECT', 'ALL')
order by
  policy.permissive,
  policy.policyname;

-- E. Effective table-level SELECT privileges. A true privilege still remains
-- subject to RLS for non-bypass roles such as anon/authenticated.
with requested_roles(role_name) as (
  values
    ('anon'::text),
    ('authenticated'::text),
    ('service_role'::text)
)
select
  'E'::text as audit_section,
  requested_role.role_name,
  pg_catalog.to_regrole(
    requested_role.role_name
  ) is not null as role_exists,
  pg_catalog.has_table_privilege(
    requested_role.role_name,
    'public.warehouse_movements',
    'SELECT'
  ) as has_select
from requested_roles requested_role
order by requested_role.role_name;

commit;
