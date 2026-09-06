-- Equipment 3.0 Phase 1: standalone read-only production audit.
-- Safe for Supabase SQL Editor. It changes no schema, grants or data.

begin;
set transaction read only;

-- 1. Exact columns, types, nullability and defaults.
select
  column_info.table_name,
  column_info.ordinal_position,
  column_info.column_name,
  column_info.data_type,
  column_info.udt_name,
  column_info.is_nullable,
  column_info.column_default
from information_schema.columns column_info
where column_info.table_schema = 'public'
  and column_info.table_name in (
    'equipment',
    'equipment_service_records',
    'equipment_usage_logs',
    'object_tasks',
    'activity_logs'
  )
order by
  column_info.table_name,
  column_info.ordinal_position;

-- 2. RLS policies and their permissive/restrictive behavior.
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
    'equipment',
    'equipment_service_records',
    'equipment_usage_logs',
    'object_tasks',
    'activity_logs'
  )
order by
  policy.tablename,
  policy.cmd,
  policy.policyname;

-- 3. Table-level grants. A table SELECT grant overrides a column allowlist.
select
  privilege.table_schema,
  privilege.table_name,
  privilege.grantee,
  privilege.privilege_type,
  privilege.is_grantable
from information_schema.table_privileges privilege
where privilege.table_schema = 'public'
  and privilege.table_name in (
    'equipment',
    'equipment_service_records',
    'equipment_usage_logs',
    'object_tasks',
    'activity_logs'
  )
order by
  privilege.table_name,
  privilege.grantee,
  privilege.privilege_type;

-- 4. Column-level grants, including effective service-cost exposure.
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
    'equipment',
    'equipment_service_records',
    'equipment_usage_logs',
    'object_tasks',
    'activity_logs'
  )
order by
  privilege.table_name,
  privilege.column_name,
  privilege.grantee,
  privilege.privilege_type;

-- 5. Constraints and exact FK ON DELETE semantics.
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
    'equipment',
    'equipment_service_records',
    'equipment_usage_logs',
    'object_tasks'
  )
order by
  relation.relname,
  constraint_info.contype,
  constraint_info.conname;

-- 6. Full index definitions for scoped Passport queries.
select
  index_info.schemaname,
  index_info.tablename,
  index_info.indexname,
  index_info.indexdef
from pg_indexes index_info
where index_info.schemaname = 'public'
  and index_info.tablename in (
    'equipment',
    'equipment_service_records',
    'equipment_usage_logs',
    'object_tasks',
    'activity_logs'
  )
order by
  index_info.tablename,
  index_info.indexname;

-- 7. Verify the requested index prefixes without claiming they exist.
with expected_indexes (
  table_name,
  expected_columns
) as (
  values
    (
      'equipment_service_records'::text,
      array[
        'equipment_id',
        'service_date',
        'created_at',
        'id'
      ]::text[]
    ),
    (
      'equipment_usage_logs'::text,
      array[
        'equipment_id',
        'reading_date',
        'created_at',
        'id'
      ]::text[]
    ),
    (
      'object_tasks'::text,
      array[
        'equipment_id',
        'due_date',
        'created_at',
        'id'
      ]::text[]
    ),
    (
      'activity_logs'::text,
      array['entity_type', 'entity_id', 'created_at', 'id']::text[]
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
      'equipment_service_records',
      'equipment_usage_logs',
      'object_tasks',
      'activity_logs'
    )
    and index_column.ordinality <= index_definition.indnkeyatts
  group by
    relation.relname,
    index_relation.relname
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
group by
  expected.table_name,
  expected.expected_columns
order by expected.table_name;

-- 8. Actual service/usage taxonomy values in production data.
select
  service_record.service_type,
  count(*)::bigint as row_count
from public.equipment_service_records service_record
group by service_record.service_type
order by service_record.service_type;

select
  usage_log.entry_type,
  usage_log.usage_type,
  count(*)::bigint as row_count
from public.equipment_usage_logs usage_log
group by
  usage_log.entry_type,
  usage_log.usage_type
order by
  usage_log.entry_type,
  usage_log.usage_type;

commit;
