-- Security / DB Hardening 1A Cleanup-C: production verification.
-- Strictly read-only: this script changes no data, ACLs or schema objects.

begin;
set transaction read only;

-- A0. Execution context. Hosted Supabase SQL Editor runs as postgres; it is
-- not permitted to alter default privileges owned by supabase_admin.
select
  'A0'::text as audit_section,
  current_user as current_user_name,
  session_user as session_user_name,
  pg_catalog.pg_has_role(
    current_user,
    'postgres',
    'MEMBER'
  ) as current_user_is_postgres_member,
  pg_catalog.pg_has_role(
    current_user,
    'supabase_admin',
    'MEMBER'
  ) as current_user_is_supabase_admin_member;

-- A1. Effective defaults for future public tables. Global defaults are
-- included because schema-specific REVOKE cannot override a global GRANT.
-- anon/authenticated/PUBLIC arrays must be empty and the contract must match.
with requested_owners(owner_order, owner_name) as (
  values
    (1, 'postgres'::text)
),
owner_defaults as (
  select
    requested_owner.owner_order,
    requested_owner.owner_name,
    owner_role.oid as owner_oid,
    global_default.defaclacl as global_acl,
    public_default.defaclacl as public_acl
  from requested_owners requested_owner
  left join pg_catalog.pg_roles owner_role
    on owner_role.rolname = requested_owner.owner_name
  left join pg_catalog.pg_namespace public_namespace
    on public_namespace.nspname = 'public'
  left join pg_catalog.pg_default_acl global_default
    on global_default.defaclrole = owner_role.oid
   and global_default.defaclnamespace = 0
   and global_default.defaclobjtype = 'r'
  left join pg_catalog.pg_default_acl public_default
    on public_default.defaclrole = owner_role.oid
   and public_default.defaclnamespace = public_namespace.oid
   and public_default.defaclobjtype = 'r'
),
expanded_defaults as (
  select
    owner_default.owner_order,
    owner_default.owner_name,
    owner_default.owner_oid,
    owner_default.global_acl::text as raw_global_default_acl,
    owner_default.public_acl::text as raw_public_default_acl,
    privilege.grantee,
    privilege.privilege_type
  from owner_defaults owner_default
  left join lateral (
    select
      global_privilege.grantee,
      global_privilege.privilege_type
    from pg_catalog.aclexplode(
      case
        when owner_default.owner_oid is null then '{}'::aclitem[]
        else coalesce(
          owner_default.global_acl,
          pg_catalog.acldefault('r', owner_default.owner_oid)
        )
      end
    ) global_privilege

    union all

    select
      public_privilege.grantee,
      public_privilege.privilege_type
    from pg_catalog.aclexplode(
      coalesce(owner_default.public_acl, '{}'::aclitem[])
    ) public_privilege
  ) privilege on true
),
requested_roles as (
  select
    anon_role.oid as anon_oid,
    authenticated_role.oid as authenticated_oid,
    service_role.oid as service_role_oid
  from (values (true)) singleton(single_row)
  left join pg_catalog.pg_roles anon_role
    on anon_role.rolname = 'anon'
  left join pg_catalog.pg_roles authenticated_role
    on authenticated_role.rolname = 'authenticated'
  left join pg_catalog.pg_roles service_role
    on service_role.rolname = 'service_role'
)
select
  'A1'::text as audit_section,
  expanded.owner_order,
  expanded.owner_name,
  expanded.owner_oid is not null as owner_exists,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.anon_oid
    ),
    '{}'::text[]
  ) as anon_direct_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.authenticated_oid
    ),
    '{}'::text[]
  ) as authenticated_direct_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = 0
    ),
    '{}'::text[]
  ) as public_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.service_role_oid
    ),
    '{}'::text[]
  ) as service_role_direct_default_privileges,
  expanded.owner_oid is not null
    and count(*) filter (
      where expanded.grantee = 0
         or expanded.grantee = requested_role.anon_oid
         or expanded.grantee = requested_role.authenticated_oid
    ) = 0 as table_default_contract_matches,
  expanded.raw_global_default_acl,
  expanded.raw_public_default_acl
from expanded_defaults expanded
cross join requested_roles requested_role
group by
  expanded.owner_order,
  expanded.owner_name,
  expanded.owner_oid,
  expanded.raw_global_default_acl,
  expanded.raw_public_default_acl,
  requested_role.anon_oid,
  requested_role.authenticated_oid,
  requested_role.service_role_oid
order by expanded.owner_order;

-- A2. Effective defaults for future public sequences. As in A1, both global
-- and public-schema default ACLs are considered.
with requested_owners(owner_order, owner_name) as (
  values
    (1, 'postgres'::text)
),
owner_defaults as (
  select
    requested_owner.owner_order,
    requested_owner.owner_name,
    owner_role.oid as owner_oid,
    global_default.defaclacl as global_acl,
    public_default.defaclacl as public_acl
  from requested_owners requested_owner
  left join pg_catalog.pg_roles owner_role
    on owner_role.rolname = requested_owner.owner_name
  left join pg_catalog.pg_namespace public_namespace
    on public_namespace.nspname = 'public'
  left join pg_catalog.pg_default_acl global_default
    on global_default.defaclrole = owner_role.oid
   and global_default.defaclnamespace = 0
   and global_default.defaclobjtype = 'S'
  left join pg_catalog.pg_default_acl public_default
    on public_default.defaclrole = owner_role.oid
   and public_default.defaclnamespace = public_namespace.oid
   and public_default.defaclobjtype = 'S'
),
expanded_defaults as (
  select
    owner_default.owner_order,
    owner_default.owner_name,
    owner_default.owner_oid,
    owner_default.global_acl::text as raw_global_default_acl,
    owner_default.public_acl::text as raw_public_default_acl,
    privilege.grantee,
    privilege.privilege_type
  from owner_defaults owner_default
  left join lateral (
    select
      global_privilege.grantee,
      global_privilege.privilege_type
    from pg_catalog.aclexplode(
      case
        when owner_default.owner_oid is null then '{}'::aclitem[]
        else coalesce(
          owner_default.global_acl,
          pg_catalog.acldefault('S', owner_default.owner_oid)
        )
      end
    ) global_privilege

    union all

    select
      public_privilege.grantee,
      public_privilege.privilege_type
    from pg_catalog.aclexplode(
      coalesce(owner_default.public_acl, '{}'::aclitem[])
    ) public_privilege
  ) privilege on true
),
requested_roles as (
  select
    anon_role.oid as anon_oid,
    authenticated_role.oid as authenticated_oid,
    service_role.oid as service_role_oid
  from (values (true)) singleton(single_row)
  left join pg_catalog.pg_roles anon_role
    on anon_role.rolname = 'anon'
  left join pg_catalog.pg_roles authenticated_role
    on authenticated_role.rolname = 'authenticated'
  left join pg_catalog.pg_roles service_role
    on service_role.rolname = 'service_role'
)
select
  'A2'::text as audit_section,
  expanded.owner_order,
  expanded.owner_name,
  expanded.owner_oid is not null as owner_exists,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.anon_oid
    ),
    '{}'::text[]
  ) as anon_direct_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.authenticated_oid
    ),
    '{}'::text[]
  ) as authenticated_direct_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = 0
    ),
    '{}'::text[]
  ) as public_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.service_role_oid
    ),
    '{}'::text[]
  ) as service_role_direct_default_privileges,
  expanded.owner_oid is not null
    and count(*) filter (
      where expanded.grantee = 0
         or expanded.grantee = requested_role.anon_oid
         or expanded.grantee = requested_role.authenticated_oid
    ) = 0 as sequence_default_contract_matches,
  expanded.raw_global_default_acl,
  expanded.raw_public_default_acl
from expanded_defaults expanded
cross join requested_roles requested_role
group by
  expanded.owner_order,
  expanded.owner_name,
  expanded.owner_oid,
  expanded.raw_global_default_acl,
  expanded.raw_public_default_acl,
  requested_role.anon_oid,
  requested_role.authenticated_oid,
  requested_role.service_role_oid
order by expanded.owner_order;

-- A3. supabase_admin table/sequence defaults are a hosted-platform-managed,
-- observation-only exception. Cleanup-C does not require these rows to match
-- the postgres contract and makes no attempt to alter them.
select
  'A3'::text as audit_section,
  'PLATFORM-MANAGED / OBSERVATION-ONLY'::text as contract_status,
  owner_role.rolname as owner_name,
  case
    when default_acl.defaclnamespace = 0 then '(global)'
    else namespace_row.nspname
  end as schema_name,
  case default_acl.defaclobjtype
    when 'r' then 'table'
    when 'S' then 'sequence'
    else default_acl.defaclobjtype::text
  end as object_type,
  coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
  grantor_role.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable,
  default_acl.defaclacl::text as raw_default_acl
from pg_catalog.pg_default_acl default_acl
join pg_catalog.pg_roles owner_role
  on owner_role.oid = default_acl.defaclrole
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = default_acl.defaclnamespace
cross join lateral pg_catalog.aclexplode(
  default_acl.defaclacl
) privilege
left join pg_catalog.pg_roles grantor_role
  on grantor_role.oid = privilege.grantor
left join pg_catalog.pg_roles grantee_role
  on grantee_role.oid = privilege.grantee
where owner_role.rolname = 'supabase_admin'
  and default_acl.defaclobjtype in ('r', 'S')
  and (
    default_acl.defaclnamespace = 0
    or namespace_row.nspname = 'public'
  )
order by
  schema_name,
  object_type,
  coalesce(grantee_role.rolname, 'PUBLIC'),
  privilege.privilege_type;

-- A4. Function default privileges are observation-only. Cleanup-C contains no
-- ALTER DEFAULT PRIVILEGES ... ON FUNCTIONS statement; hardening remains
-- deferred to the complete RPC/function contract audit in Hardening 1C.
with requested_owners(owner_order, owner_name) as (
  values
    (1, 'postgres'::text),
    (2, 'supabase_admin')
),
owner_defaults as (
  select
    requested_owner.owner_order,
    requested_owner.owner_name,
    owner_role.oid as owner_oid,
    global_default.defaclacl as global_acl,
    public_default.defaclacl as public_acl
  from requested_owners requested_owner
  left join pg_catalog.pg_roles owner_role
    on owner_role.rolname = requested_owner.owner_name
  left join pg_catalog.pg_namespace public_namespace
    on public_namespace.nspname = 'public'
  left join pg_catalog.pg_default_acl global_default
    on global_default.defaclrole = owner_role.oid
   and global_default.defaclnamespace = 0
   and global_default.defaclobjtype = 'f'
  left join pg_catalog.pg_default_acl public_default
    on public_default.defaclrole = owner_role.oid
   and public_default.defaclnamespace = public_namespace.oid
   and public_default.defaclobjtype = 'f'
),
expanded_defaults as (
  select
    owner_default.owner_order,
    owner_default.owner_name,
    owner_default.owner_oid,
    owner_default.global_acl::text as raw_global_default_acl,
    owner_default.public_acl::text as raw_public_default_acl,
    privilege.grantee,
    privilege.privilege_type
  from owner_defaults owner_default
  left join lateral (
    select
      global_privilege.grantee,
      global_privilege.privilege_type
    from pg_catalog.aclexplode(
      case
        when owner_default.owner_oid is null then '{}'::aclitem[]
        else coalesce(
          owner_default.global_acl,
          pg_catalog.acldefault('f', owner_default.owner_oid)
        )
      end
    ) global_privilege

    union all

    select
      public_privilege.grantee,
      public_privilege.privilege_type
    from pg_catalog.aclexplode(
      coalesce(owner_default.public_acl, '{}'::aclitem[])
    ) public_privilege
  ) privilege on true
),
requested_roles as (
  select
    anon_role.oid as anon_oid,
    authenticated_role.oid as authenticated_oid,
    service_role.oid as service_role_oid
  from (values (true)) singleton(single_row)
  left join pg_catalog.pg_roles anon_role
    on anon_role.rolname = 'anon'
  left join pg_catalog.pg_roles authenticated_role
    on authenticated_role.rolname = 'authenticated'
  left join pg_catalog.pg_roles service_role
    on service_role.rolname = 'service_role'
)
select
  'A4'::text as audit_section,
  expanded.owner_order,
  expanded.owner_name,
  expanded.owner_oid is not null as owner_exists,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.anon_oid
    ),
    '{}'::text[]
  ) as anon_direct_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.authenticated_oid
    ),
    '{}'::text[]
  ) as authenticated_direct_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = 0
    ),
    '{}'::text[]
  ) as public_default_privileges,
  coalesce(
    array_agg(
      distinct expanded.privilege_type
      order by expanded.privilege_type
    ) filter (
      where expanded.grantee = requested_role.service_role_oid
    ),
    '{}'::text[]
  ) as service_role_direct_default_privileges,
  expanded.raw_global_default_acl,
  expanded.raw_public_default_acl
from expanded_defaults expanded
cross join requested_roles requested_role
group by
  expanded.owner_order,
  expanded.owner_name,
  expanded.owner_oid,
  expanded.raw_global_default_acl,
  expanded.raw_public_default_acl,
  requested_role.anon_oid,
  requested_role.authenticated_oid,
  requested_role.service_role_oid
order by expanded.owner_order;

-- B1. Representative existing table ACLs. Cleanup-C alters pg_default_acl,
-- not pg_class.relacl; compare these values with the earlier production audit.
with existing_tables(table_order, table_name) as (
  values
    (1, 'profiles'::text),
    (2, 'object_expenses'),
    (3, 'equipment_usage_logs'),
    (4, 'warehouse_movements')
)
select
  'B1'::text as audit_section,
  existing_table.table_order,
  existing_table.table_name,
  relation.oid is not null as table_exists,
  pg_catalog.pg_get_userbyid(relation.relowner) as owner_name,
  relation.relacl::text as raw_relation_acl
from existing_tables existing_table
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
left join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = existing_table.table_name
 and relation.relkind in ('r', 'p')
order by existing_table.table_order;

-- B2. Representative existing sequence ACLs. No ALTER/GRANT/REVOKE ON an
-- existing sequence appears in Cleanup-C.
with existing_sequences(sequence_order, sequence_name) as (
  values
    (1, 'employees_id_seq'::text),
    (2, 'equipment_id_seq'),
    (3, 'objects_id_seq'),
    (4, 'warehouse_items_id_seq'),
    (5, 'work_logs_id_seq'),
    (6, 'equipment_inventory_number_seq')
)
select
  'B2'::text as audit_section,
  existing_sequence.sequence_order,
  existing_sequence.sequence_name,
  sequence_row.oid is not null as sequence_exists,
  pg_catalog.pg_get_userbyid(sequence_row.relowner) as owner_name,
  sequence_row.relacl::text as raw_sequence_acl
from existing_sequences existing_sequence
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
left join pg_catalog.pg_class sequence_row
  on sequence_row.relnamespace = namespace_row.oid
 and sequence_row.relname = existing_sequence.sequence_name
 and sequence_row.relkind = 'S'
order by existing_sequence.sequence_order;

commit;
