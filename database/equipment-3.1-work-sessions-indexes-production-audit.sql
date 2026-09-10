-- Equipment 3.1 / Work Sessions indexes — read-only production audit.
-- This file only inspects PostgreSQL catalog metadata.

begin;
set transaction read only;

with expected_indexes (
  index_name,
  expected_key_columns_and_order,
  expected_partial_predicate
) as (
  values
    (
      'equipment_usage_logs_work_session_object_date_id_idx'::text,
      array[
        'object_id ASC',
        'reading_date DESC',
        'id DESC'
      ]::text[],
      'entry_type = ''work_session''::text AND object_id IS NOT NULL'::text
    ),
    (
      'equipment_usage_logs_work_session_employee_date_id_idx'::text,
      array[
        'employee_id ASC',
        'reading_date DESC',
        'id DESC'
      ]::text[],
      'entry_type = ''work_session''::text AND employee_id IS NOT NULL'::text
    )
),
actual_indexes as (
  select
    index_relation.relname::text as index_name,
    index_definition.indexrelid,
    index_definition.indnkeyatts,
    index_definition.indisvalid,
    index_definition.indisready,
    array(
      select
        pg_catalog.pg_get_indexdef(
          index_definition.indexrelid,
          key_position,
          true
        ) ||
        case
          when (
            index_definition.indoption[
              key_position - 1
            ] & 1
          ) = 1
          then ' DESC'
          else ' ASC'
        end
      from pg_catalog.generate_series(
        1,
        index_definition.indnkeyatts
      ) as key_position
      order by key_position
    ) as key_columns_and_order,
    pg_catalog.pg_get_expr(
      index_definition.indpred,
      index_definition.indrelid,
      true
    ) as partial_predicate,
    pg_catalog.pg_get_indexdef(
      index_definition.indexrelid
    ) as index_definition
  from pg_catalog.pg_index index_definition
  join pg_catalog.pg_class table_relation
    on table_relation.oid = index_definition.indrelid
  join pg_catalog.pg_namespace table_namespace
    on table_namespace.oid = table_relation.relnamespace
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_definition.indexrelid
  where table_namespace.nspname = 'public'
    and table_relation.relname = 'equipment_usage_logs'
)
select
  expected.index_name,
  actual.indexrelid is not null as index_exists,
  coalesce(actual.indisvalid, false) as indisvalid,
  coalesce(actual.indisready, false) as indisready,
  expected.expected_key_columns_and_order,
  coalesce(
    actual.key_columns_and_order,
    array[]::text[]
  ) as key_columns_and_order,
  coalesce(
    actual.key_columns_and_order =
      expected.expected_key_columns_and_order,
    false
  ) as key_columns_and_order_match,
  expected.expected_partial_predicate,
  actual.partial_predicate,
  coalesce(
    pg_catalog.regexp_replace(
      actual.partial_predicate,
      '[[:space:]()]',
      '',
      'g'
    ) = pg_catalog.regexp_replace(
      expected.expected_partial_predicate,
      '[[:space:]()]',
      '',
      'g'
    ),
    false
  ) as partial_predicate_matches,
  actual.index_definition
from expected_indexes expected
left join actual_indexes actual
  on actual.index_name = expected.index_name
order by expected.index_name;

commit;
