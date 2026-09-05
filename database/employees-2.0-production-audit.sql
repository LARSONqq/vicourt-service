-- Employees 2.0 Phase 1: read-only production audit.
-- This file is standalone and safe to run in Supabase SQL Editor. It changes
-- no schema or data and returns several result sets for manual review.

begin;
set transaction read only;

-- 1. Actual employee columns, nullability and defaults.
select
  column_info.ordinal_position,
  column_info.column_name,
  column_info.data_type,
  column_info.udt_name,
  column_info.is_nullable,
  column_info.column_default
from information_schema.columns column_info
where column_info.table_schema = 'public'
  and column_info.table_name = 'employees'
order by column_info.ordinal_position;

-- 2. Existing data values reveal whether the legacy "Звільнений" status is
-- present. This query does not alter or normalize any row.
select
  employee.status,
  count(*)::bigint as row_count
from public.employees employee
group by employee.status
order by employee.status;

-- 3. RLS policies for employee-related tables.
select
  policy.schemaname,
  policy.tablename,
  policy.policyname,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual,
  policy.with_check
from pg_policies policy
where policy.schemaname = 'public'
  and policy.tablename in (
    'employees',
    'profiles',
    'object_tasks',
    'work_logs',
    'objects',
    'equipment'
  )
order by policy.tablename, policy.cmd, policy.policyname;

-- 4. Table-level privileges. A table SELECT grant must be considered before
-- interpreting column-level privacy.
select
  privilege.table_schema,
  privilege.table_name,
  privilege.grantee,
  privilege.privilege_type,
  privilege.is_grantable
from information_schema.table_privileges privilege
where privilege.table_schema = 'public'
  and privilege.table_name in (
    'employees',
    'profiles',
    'object_tasks',
    'work_logs',
    'objects',
    'equipment'
  )
order by
  privilege.table_name,
  privilege.grantee,
  privilege.privilege_type;

-- 5. Column-level privileges, including the effective employee allowlist.
select
  privilege.table_schema,
  privilege.table_name,
  privilege.column_name,
  privilege.grantee,
  privilege.privilege_type,
  privilege.is_grantable
from information_schema.column_privileges privilege
where privilege.table_schema = 'public'
  and privilege.table_name in (
    'employees',
    'profiles',
    'object_tasks',
    'work_logs',
    'objects',
    'equipment'
  )
order by
  privilege.table_name,
  privilege.column_name,
  privilege.grantee,
  privilege.privilege_type;

-- 6. Full index definitions for the affected relations.
select
  index_info.schemaname,
  index_info.tablename,
  index_info.indexname,
  index_info.indexdef
from pg_indexes index_info
where index_info.schemaname = 'public'
  and index_info.tablename in (
    'employees',
    'profiles',
    'object_tasks',
    'work_logs',
    'objects',
    'equipment'
  )
order by index_info.tablename, index_info.indexname;

-- 7. Verify whether an index begins with each expected employee lookup key.
-- A matching prefix may contain additional trailing columns.
with expected_indexes (
  table_name,
  expected_columns
) as (
  values
    (
      'object_tasks'::text,
      array['assigned_employee_id', 'status', 'due_date']::text[]
    ),
    (
      'work_logs'::text,
      array['employee_id', 'work_date', 'id']::text[]
    ),
    (
      'objects'::text,
      array['responsible_employee_id']::text[]
    ),
    (
      'equipment'::text,
      array['responsible_employee_id']::text[]
    ),
    (
      'profiles'::text,
      array['employee_id']::text[]
    )
),
actual_indexes as (
  select
    relation.relname::text as table_name,
    index_relation.relname::text as index_name,
    array_agg(
      attribute.attname::text
      order by index_column.ordinality
    ) filter (
      where attribute.attname is not null
    ) as index_columns
  from pg_index index_definition
  join pg_class relation
    on relation.oid = index_definition.indrelid
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  join pg_class index_relation
    on index_relation.oid = index_definition.indexrelid
  cross join lateral unnest(index_definition.indkey)
    with ordinality as index_column(attnum, ordinality)
  left join pg_attribute attribute
    on attribute.attrelid = relation.oid
   and attribute.attnum = index_column.attnum
  where namespace.nspname = 'public'
    and relation.relname in (
      'object_tasks',
      'work_logs',
      'objects',
      'equipment',
      'profiles'
    )
    and index_column.ordinality <= index_definition.indnkeyatts
  group by relation.relname, index_relation.relname
)
select
  expected.table_name,
  expected.expected_columns,
  coalesce(
    bool_or(
      actual.index_columns[
        1:cardinality(expected.expected_columns)
      ] = expected.expected_columns
    ),
    false
  ) as matching_index_exists,
  array_remove(
    array_agg(
      case
        when actual.index_columns[
          1:cardinality(expected.expected_columns)
        ] = expected.expected_columns
        then actual.index_name
        else null
      end
    ),
    null
  ) as matching_indexes
from expected_indexes expected
left join actual_indexes actual
  on actual.table_name = expected.table_name
group by expected.table_name, expected.expected_columns
order by expected.table_name;

-- 8. FK/CHECK/UNIQUE constraints and exact ON DELETE semantics.
select
  namespace.nspname as table_schema,
  relation.relname as table_name,
  constraint_info.conname as constraint_name,
  constraint_info.contype as constraint_type,
  pg_get_constraintdef(
    constraint_info.oid,
    true
  ) as definition
from pg_constraint constraint_info
join pg_class relation
  on relation.oid = constraint_info.conrelid
join pg_namespace namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'employees',
    'profiles',
    'object_tasks',
    'work_logs',
    'objects',
    'equipment'
  )
order by relation.relname, constraint_info.contype, constraint_info.conname;

commit;
