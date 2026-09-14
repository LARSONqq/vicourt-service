-- Security / DB Hardening 1A Cleanup-B: production verification.
-- Strictly read-only: this script changes no data, privileges or schema.

begin;
set transaction read only;

-- A1. Final anon contract for the two Cleanup-B target tables. Every
-- privilege result must be false and anon_contract_matches must be true.
with targets(target_order, table_name) as (
  values
    (1, 'object_expenses'::text),
    (2, 'profiles')
),
resolved_targets as (
  select
    target.target_order,
    target.table_name,
    relation.oid as relation_oid,
    relation.relacl
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
  target.table_name,
  target.relation_oid is not null as table_exists,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'SELECT'
    )
  end as anon_select,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'INSERT'
    )
  end as anon_insert,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'UPDATE'
    )
  end as anon_update,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'DELETE'
    )
  end as anon_delete,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'TRUNCATE'
    )
  end as anon_truncate,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'TRIGGER'
    )
  end as anon_trigger,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'REFERENCES'
    )
  end as anon_references,
  case
    when target.relation_oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', target.relation_oid, 'MAINTAIN'
    )
  end as anon_maintain,
  case
    when target.relation_oid is null then false
    else not (
      pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'SELECT'
      )
      or pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'INSERT'
      )
      or pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'UPDATE'
      )
      or pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'DELETE'
      )
      or pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'TRUNCATE'
      )
      or pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'TRIGGER'
      )
      or pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'REFERENCES'
      )
      or pg_catalog.has_table_privilege(
        'anon', target.relation_oid, 'MAINTAIN'
      )
    )
  end as anon_contract_matches,
  target.relacl::text as raw_relation_acl
from resolved_targets target
order by target.target_order;

-- B1. Authenticated runtime CRUD comparison. Compare with the pre-deploy
-- baseline; Cleanup-B grants/revokes nothing from authenticated.
with targets(target_order, table_name) as (
  values
    (1, 'object_expenses'::text),
    (2, 'profiles')
)
select
  'B1'::text as audit_section,
  target.target_order,
  target.table_name,
  relation.oid is not null as table_exists,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'authenticated', relation.oid, 'SELECT'
    )
  end as authenticated_select,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'authenticated', relation.oid, 'INSERT'
    )
  end as authenticated_insert,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'authenticated', relation.oid, 'UPDATE'
    )
  end as authenticated_update,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'authenticated', relation.oid, 'DELETE'
    )
  end as authenticated_delete,
  relation.relacl::text as raw_relation_acl
from targets target
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
left join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = target.table_name
 and relation.relkind in ('r', 'p')
order by target.target_order;

-- C1. app_settings is observation-only. It is not in the confirmed production
-- target set and is not mutated by Cleanup-B.
select
  'C1'::text as audit_section,
  relation.oid is not null as table_exists,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'SELECT'
    )
  end as anon_select,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'INSERT'
    )
  end as anon_insert,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'UPDATE'
    )
  end as anon_update,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'DELETE'
    )
  end as anon_delete,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'TRUNCATE'
    )
  end as anon_truncate,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'TRIGGER'
    )
  end as anon_trigger,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'REFERENCES'
    )
  end as anon_references,
  case
    when relation.oid is null then null
    else pg_catalog.has_table_privilege(
      'anon', relation.oid, 'MAINTAIN'
    )
  end as anon_maintain,
  relation.relacl::text as raw_relation_acl
from (values ('app_settings'::text)) target(table_name)
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
left join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = target.table_name
 and relation.relkind in ('r', 'p');

commit;
