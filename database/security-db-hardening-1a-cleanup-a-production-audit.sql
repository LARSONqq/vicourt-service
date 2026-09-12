-- Security / DB Hardening 1A Cleanup-A: production verification.
-- Strictly read-only: this script changes no data, privileges or schema.

begin;
set transaction read only;

-- A1. Cleanup-A contract. Every structural/maintenance result must be false
-- and cleanup_contract_matches must be true for every existing target table.
with targets(target_order, role_name, table_name) as (
  values
    (1, 'anon'::text, 'object_expenses'::text),
    (2, 'anon', 'objects'),
    (3, 'anon', 'profiles'),
    (4, 'authenticated', 'app_settings'),
    (5, 'authenticated', 'employees'),
    (6, 'authenticated', 'equipment'),
    (7, 'authenticated', 'equipment_service_records'),
    (8, 'authenticated', 'materials'),
    (9, 'authenticated', 'object_expenses'),
    (10, 'authenticated', 'object_photos'),
    (11, 'authenticated', 'object_tasks'),
    (12, 'authenticated', 'objects'),
    (13, 'authenticated', 'profiles'),
    (14, 'authenticated', 'push_subscriptions'),
    (15, 'authenticated', 'task_checklist_items'),
    (16, 'authenticated', 'warehouse_items'),
    (17, 'authenticated', 'warehouse_movements'),
    (18, 'authenticated', 'warehouse_purchases'),
    (19, 'authenticated', 'work_logs')
),
resolved_targets as (
  select
    target.target_order,
    target.role_name,
    target.table_name,
    relation.oid as relation_oid
  from targets target
  left join pg_catalog.pg_namespace namespace_row
    on namespace_row.nspname = 'public'
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace_row.oid
   and relation.relname = target.table_name
   and relation.relkind in ('r', 'p')
)
select
  'A1'::text as audit_section,
  target.target_order,
  target.role_name,
  target.table_name,
  target.relation_oid is not null as table_exists,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, target.relation_oid, 'TRUNCATE'
    )
  end as has_truncate,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, target.relation_oid, 'TRIGGER'
    )
  end as has_trigger,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, target.relation_oid, 'REFERENCES'
    )
  end as has_references,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, target.relation_oid, 'MAINTAIN'
    )
  end as has_maintain,
  case
    when target.relation_oid is null then false
    else not (
      pg_catalog.has_table_privilege(
        target.role_name, target.relation_oid, 'TRUNCATE'
      )
      or pg_catalog.has_table_privilege(
        target.role_name, target.relation_oid, 'TRIGGER'
      )
      or pg_catalog.has_table_privilege(
        target.role_name, target.relation_oid, 'REFERENCES'
      )
      or pg_catalog.has_table_privilege(
        target.role_name, target.relation_oid, 'MAINTAIN'
      )
    )
  end as cleanup_contract_matches
from resolved_targets target
order by target.target_order;

-- B1. Runtime CRUD preservation summary. Compare these values with the
-- pre-deploy A1/A3 baseline; Cleanup-A does not grant or revoke any of them.
with targets(target_order, role_name, table_name) as (
  values
    (1, 'anon'::text, 'object_expenses'::text),
    (2, 'anon', 'objects'),
    (3, 'anon', 'profiles'),
    (4, 'authenticated', 'app_settings'),
    (5, 'authenticated', 'employees'),
    (6, 'authenticated', 'equipment'),
    (7, 'authenticated', 'equipment_service_records'),
    (8, 'authenticated', 'materials'),
    (9, 'authenticated', 'object_expenses'),
    (10, 'authenticated', 'object_photos'),
    (11, 'authenticated', 'object_tasks'),
    (12, 'authenticated', 'objects'),
    (13, 'authenticated', 'profiles'),
    (14, 'authenticated', 'push_subscriptions'),
    (15, 'authenticated', 'task_checklist_items'),
    (16, 'authenticated', 'warehouse_items'),
    (17, 'authenticated', 'warehouse_movements'),
    (18, 'authenticated', 'warehouse_purchases'),
    (19, 'authenticated', 'work_logs')
)
select
  'B1'::text as audit_section,
  target.target_order,
  target.role_name,
  target.table_name,
  relation.oid is not null as table_exists,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, relation.oid, 'SELECT'
    )
  end as has_select,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, relation.oid, 'INSERT'
    )
  end as has_insert,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, relation.oid, 'UPDATE'
    )
  end as has_update,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      target.role_name, relation.oid, 'DELETE'
    )
  end as has_delete,
  relation.relacl::text as raw_relation_acl
from targets target
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
left join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = target.table_name
 and relation.relkind in ('r', 'p')
order by target.target_order;

commit;
