-- Security / DB Hardening 1.0: standalone read-only production audit.
-- Safe to run manually in Supabase SQL Editor. This file changes no data,
-- schema, privileges, policies or function definitions.

begin;
set transaction read only;

-- A1. Public relation security state. Tables without RLS are visible here too.
select
  'A1'::text as audit_section,
  namespace_row.nspname as table_schema,
  relation.relname as table_name,
  pg_catalog.pg_get_userbyid(relation.relowner) as owner_name,
  case relation.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'f' then 'foreign table'
    else relation.relkind::text
  end as relation_kind,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced,
  relation.relacl::text as raw_relation_acl
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
where namespace_row.nspname = 'public'
  and relation.relkind in ('r', 'p', 'v', 'm', 'f')
order by relation.relname;

-- A2. Raw table/view ACL entries, including PUBLIC and owner defaults.
select
  'A2'::text as audit_section,
  namespace_row.nspname as table_schema,
  relation.relname as table_name,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  grantor.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
cross join lateral pg_catalog.aclexplode(
  case
    when relation.relacl is null then
      pg_catalog.acldefault('r', relation.relowner)
    when pg_catalog.array_ndims(relation.relacl) = 1 then
      relation.relacl
    else pg_catalog.acldefault('r', relation.relowner)
  end
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where namespace_row.nspname = 'public'
  and relation.relkind in ('r', 'p', 'v', 'm', 'f')
  and (
    relation.relacl is null
    or pg_catalog.array_ndims(relation.relacl) = 1
  )
order by
  relation.relname,
  coalesce(grantee.rolname, 'PUBLIC'),
  privilege.privilege_type;

-- A3. Effective API-role table privileges. This includes privileges inherited
-- through role membership or PUBLIC, not only directly recorded ACL entries.
with requested_roles(role_name) as (
  values
    ('anon'::text),
    ('authenticated'::text),
    ('service_role'::text)
),
requested_privileges(privilege_name) as (
  values
    ('SELECT'::text),
    ('INSERT'::text),
    ('UPDATE'::text),
    ('DELETE'::text),
    ('TRUNCATE'::text),
    ('REFERENCES'::text),
    ('TRIGGER'::text)
)
select
  'A3'::text as audit_section,
  namespace_row.nspname as table_schema,
  relation.relname as table_name,
  requested_role.role_name,
  requested_privilege.privilege_name,
  pg_catalog.has_table_privilege(
    requested_role.role_name,
    relation.oid,
    requested_privilege.privilege_name
  ) as has_privilege,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
cross join requested_roles requested_role
cross join requested_privileges requested_privilege
where namespace_row.nspname = 'public'
  and relation.relkind in ('r', 'p', 'v', 'm', 'f')
  and pg_catalog.to_regrole(requested_role.role_name) is not null
  and pg_catalog.has_table_privilege(
    requested_role.role_name,
    relation.oid,
    requested_privilege.privilege_name
  )
order by
  relation.relname,
  requested_role.role_name,
  requested_privilege.privilege_name;

-- B1. Explicit column ACL entries. A table-level privilege is intentionally
-- not expanded here; compare this result with A2/A3.
select
  'B1'::text as audit_section,
  namespace_row.nspname as table_schema,
  relation.relname as table_name,
  attribute.attname as column_name,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  grantor.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
join pg_catalog.pg_attribute attribute
  on attribute.attrelid = relation.oid
cross join lateral pg_catalog.aclexplode(
  case
    when pg_catalog.array_ndims(attribute.attacl) = 1 then
      attribute.attacl
    else pg_catalog.acldefault('r', relation.relowner)
  end
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where namespace_row.nspname = 'public'
  and relation.relkind in ('r', 'p', 'v', 'm', 'f')
  and attribute.attnum > 0
  and not attribute.attisdropped
  and pg_catalog.array_ndims(attribute.attacl) = 1
order by
  relation.relname,
  attribute.attnum,
  coalesce(grantee.rolname, 'PUBLIC'),
  privilege.privilege_type;

-- B2. Effective SELECT access to known sensitive/internal columns. A true
-- value for authenticated means every authenticated JWT starts with the same
-- SQL column privilege; row-level role separation must then come from RLS.
with sensitive_columns(
  table_name,
  column_name,
  sensitivity
) as (
  values
    ('objects'::text, 'client_price'::text, 'finance'),
    ('objects', 'cost_budget', 'finance'),
    ('materials', 'price', 'finance'),
    ('work_logs', 'hourly_rate', 'finance'),
    ('employees', 'hourly_rate', 'finance'),
    ('employees', 'phone', 'employee privacy'),
    ('employees', 'email', 'employee privacy'),
    ('employees', 'employment_type', 'employee privacy'),
    ('employees', 'hire_date', 'employee privacy'),
    ('employees', 'notes', 'employee privacy'),
    ('warehouse_items', 'purchase_price', 'finance'),
    ('warehouse_movements', 'unit_price', 'finance'),
    ('warehouse_movements', 'total_cost', 'finance'),
    ('warehouse_purchases', 'purchase_price', 'finance'),
    ('object_expenses', 'amount', 'finance'),
    ('object_payments', 'amount', 'finance'),
    ('object_payment_schedule', 'amount', 'finance'),
    ('equipment_service_records', 'cost', 'finance'),
    ('equipment_service_records', 'created_by', 'internal actor id'),
    ('equipment_service_records', 'voided_by', 'internal actor id'),
    ('equipment_usage_logs', 'idempotency_key', 'internal replay key'),
    ('equipment_usage_logs', 'created_by', 'internal actor id'),
    ('activity_logs', 'actor_id', 'internal actor id'),
    ('activity_logs', 'metadata', 'potential sensitive metadata'),
    ('profiles', 'email', 'user privacy'),
    ('profiles', 'role', 'user administration'),
    ('profiles', 'employee_id', 'user administration'),
    ('profiles', 'is_active', 'user administration')
)
select
  'B2'::text as audit_section,
  namespace_row.nspname as table_schema,
  relation.relname as table_name,
  attribute.attname as column_name,
  sensitive.sensitivity,
  pg_catalog.has_table_privilege(
    'anon',
    relation.oid,
    'SELECT'
  ) as anon_has_table_select,
  pg_catalog.has_column_privilege(
    'anon',
    relation.oid,
    attribute.attnum,
    'SELECT'
  ) as anon_can_select_column,
  pg_catalog.has_table_privilege(
    'authenticated',
    relation.oid,
    'SELECT'
  ) as authenticated_has_table_select,
  pg_catalog.has_column_privilege(
    'authenticated',
    relation.oid,
    attribute.attnum,
    'SELECT'
  ) as authenticated_can_select_column,
  pg_catalog.has_column_privilege(
    'service_role',
    relation.oid,
    attribute.attnum,
    'SELECT'
  ) as service_role_can_select_column
from sensitive_columns sensitive
join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = sensitive.table_name
join pg_catalog.pg_attribute attribute
  on attribute.attrelid = relation.oid
 and attribute.attname = sensitive.column_name
 and attribute.attnum > 0
 and not attribute.attisdropped
order by relation.relname, attribute.attnum;

-- B3. Management-sensitive tables. Table SELECT can be intentional when RLS
-- is the row boundary; inspect the policies returned by C2 at the same time.
with management_tables(table_name, expected_boundary) as (
  values
    ('object_expenses'::text, 'admin + object_manager'),
    ('object_payments', 'admin + object_manager'),
    ('object_payment_schedule', 'admin + object_manager'),
    ('activity_logs', 'admin + object_manager'),
    ('warehouse_movements', 'admin + object_manager'),
    ('warehouse_purchases', 'management roles'),
    ('profiles', 'self/admin according to operation')
)
select
  'B3'::text as audit_section,
  relation.relname as table_name,
  management.expected_boundary,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced,
  pg_catalog.has_table_privilege(
    'anon',
    relation.oid,
    'SELECT'
  ) as anon_has_select,
  pg_catalog.has_table_privilege(
    'authenticated',
    relation.oid,
    'SELECT'
  ) as authenticated_has_select,
  pg_catalog.has_table_privilege(
    'authenticated',
    relation.oid,
    'INSERT'
  ) as authenticated_has_insert,
  pg_catalog.has_table_privilege(
    'authenticated',
    relation.oid,
    'UPDATE'
  ) as authenticated_has_update,
  pg_catalog.has_table_privilege(
    'authenticated',
    relation.oid,
    'DELETE'
  ) as authenticated_has_delete
from management_tables management
join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = management.table_name
order by relation.relname;

-- C1. Exact RLS state for every public table, including tables with no policy.
select
  'C1'::text as audit_section,
  namespace_row.nspname as table_schema,
  relation.relname as table_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced,
  count(policy.policyname)::bigint as policy_count
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
left join pg_catalog.pg_policies policy
  on policy.schemaname = namespace_row.nspname
 and policy.tablename = relation.relname
where namespace_row.nspname = 'public'
  and relation.relkind in ('r', 'p')
group by
  namespace_row.nspname,
  relation.relname,
  relation.relrowsecurity,
  relation.relforcerowsecurity
order by relation.relname;

-- C2. Every application/storage RLS policy and its combination semantics.
select
  'C2'::text as audit_section,
  policy.schemaname,
  policy.tablename,
  policy.policyname,
  policy.permissive,
  policy.roles,
  policy.cmd,
  policy.qual,
  policy.with_check
from pg_catalog.pg_policies policy
where policy.schemaname in ('public', 'storage')
order by
  policy.schemaname,
  policy.tablename,
  policy.cmd,
  policy.permissive,
  policy.policyname;

-- C3. Byte-for-byte equivalent policy definitions under different names.
select
  'C3'::text as audit_section,
  policy.schemaname,
  policy.tablename,
  policy.cmd,
  policy.permissive,
  policy.roles,
  policy.qual,
  policy.with_check,
  count(*)::bigint as equivalent_policy_count,
  array_agg(policy.policyname order by policy.policyname) as policy_names
from pg_catalog.pg_policies policy
where policy.schemaname in ('public', 'storage')
group by
  policy.schemaname,
  policy.tablename,
  policy.cmd,
  policy.permissive,
  policy.roles,
  policy.qual,
  policy.with_check
having count(*) > 1
order by policy.schemaname, policy.tablename, policy.cmd;

-- C4. Policy overlap candidates. Multiple permissive policies are ORed;
-- restrictive policies are ANDed with the permissive result.
select
  'C4'::text as audit_section,
  policy.schemaname,
  policy.tablename,
  policy.cmd,
  count(*)::bigint as policy_count,
  count(*) filter (
    where policy.permissive = 'PERMISSIVE'
  )::bigint as permissive_count,
  count(*) filter (
    where policy.permissive = 'RESTRICTIVE'
  )::bigint as restrictive_count,
  array_agg(
    policy.policyname
    order by policy.permissive, policy.policyname
  ) as policy_names
from pg_catalog.pg_policies policy
where policy.schemaname in ('public', 'storage')
group by policy.schemaname, policy.tablename, policy.cmd
having count(*) > 1
order by policy.schemaname, policy.tablename, policy.cmd;

-- D1. Function EXECUTE ACL entries. acldefault('f', ...) is important because
-- PostgreSQL grants EXECUTE to PUBLIC by default when a function is created.
select
  'D1'::text as audit_section,
  namespace_row.nspname as function_schema,
  procedure_row.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(
    procedure_row.oid
  ) as identity_arguments,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  grantor.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable
from pg_catalog.pg_proc procedure_row
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = procedure_row.pronamespace
cross join lateral pg_catalog.aclexplode(
  case
    when procedure_row.proacl is null then
      pg_catalog.acldefault('f', procedure_row.proowner)
    when pg_catalog.array_ndims(procedure_row.proacl) = 1 then
      procedure_row.proacl
    else pg_catalog.acldefault('f', procedure_row.proowner)
  end
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where namespace_row.nspname in ('public', 'private')
  and procedure_row.prokind = 'f'
  and (
    procedure_row.proacl is null
    or pg_catalog.array_ndims(procedure_row.proacl) = 1
  )
order by
  namespace_row.nspname,
  procedure_row.proname,
  identity_arguments,
  coalesce(grantee.rolname, 'PUBLIC');

-- D2/E. SECURITY DEFINER exposure, fixed search_path and guard indicators.
-- Guard indicators are triage aids; inspect source for every suspicious row.
select
  'D2/E'::text as audit_section,
  namespace_row.nspname as function_schema,
  procedure_row.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(
    procedure_row.oid
  ) as identity_arguments,
  pg_catalog.pg_get_function_result(
    procedure_row.oid
  ) as result_type,
  pg_catalog.pg_get_userbyid(
    procedure_row.proowner
  ) as owner_name,
  language_row.lanname as language_name,
  procedure_row.prosecdef as security_definer,
  case procedure_row.provolatile
    when 'i' then 'immutable'
    when 's' then 'stable'
    when 'v' then 'volatile'
  end as volatility,
  procedure_row.proconfig as function_settings,
  exists (
    select 1
    from unnest(
      coalesce(
        procedure_row.proconfig,
        '{}'::text[]
      )
    ) setting
    where setting like 'search_path=%'
  ) as has_fixed_search_path,
  exists (
    select 1
    from pg_catalog.aclexplode(
      case
        when namespace_row.nspacl is null then
          pg_catalog.acldefault('n', namespace_row.nspowner)
        when pg_catalog.array_ndims(namespace_row.nspacl) = 1 then
          namespace_row.nspacl
        else pg_catalog.acldefault('n', namespace_row.nspowner)
      end
    ) schema_privilege
    where (
        namespace_row.nspacl is null
        or pg_catalog.array_ndims(namespace_row.nspacl) = 1
      )
      and schema_privilege.grantee = 0
      and schema_privilege.privilege_type = 'USAGE'
  )
  and exists (
    select 1
    from pg_catalog.aclexplode(
      case
        when procedure_row.proacl is null then
          pg_catalog.acldefault('f', procedure_row.proowner)
        when pg_catalog.array_ndims(procedure_row.proacl) = 1 then
          procedure_row.proacl
        else pg_catalog.acldefault('f', procedure_row.proowner)
      end
    ) function_privilege
    where (
        procedure_row.proacl is null
        or pg_catalog.array_ndims(procedure_row.proacl) = 1
      )
      and function_privilege.grantee = 0
      and function_privilege.privilege_type = 'EXECUTE'
  ) as public_can_execute,
  pg_catalog.has_schema_privilege(
    'anon',
    namespace_row.oid,
    'USAGE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    procedure_row.oid,
    'EXECUTE'
  ) as anon_can_execute,
  pg_catalog.has_schema_privilege(
    'authenticated',
    namespace_row.oid,
    'USAGE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    procedure_row.oid,
    'EXECUTE'
  ) as authenticated_can_execute,
  pg_catalog.has_schema_privilege(
    'service_role',
    namespace_row.oid,
    'USAGE'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    procedure_row.oid,
    'EXECUTE'
  ) as service_role_can_execute,
  procedure_row.prosrc ~* 'auth[.]uid[[:space:]]*[(]'
    as source_mentions_auth_uid,
  procedure_row.prosrc ~* 'private[.]is_active_user[[:space:]]*[(]'
    as source_mentions_active_user,
  procedure_row.prosrc ~* 'private[.](has_role|is_admin)[[:space:]]*[(]'
    as source_mentions_role_guard,
  procedure_row.prosrc ~* 'private[.]assert_[a-z0-9_]+'
    as source_mentions_assert_guard,
  pg_catalog.md5(
    pg_catalog.pg_get_functiondef(
      procedure_row.oid
    )
  ) as definition_md5
from pg_catalog.pg_proc procedure_row
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = procedure_row.pronamespace
join pg_catalog.pg_language language_row
  on language_row.oid = procedure_row.prolang
where namespace_row.nspname in ('public', 'private')
  and procedure_row.prokind = 'f'
  and procedure_row.prosecdef
order by
  namespace_row.nspname,
  procedure_row.proname,
  identity_arguments;

-- F1. Sequence ownership, ACL and effective API-role privileges.
select
  'F1'::text as audit_section,
  namespace_row.nspname as sequence_schema,
  sequence_row.relname as sequence_name,
  pg_catalog.pg_get_userbyid(
    sequence_row.relowner
  ) as owner_name,
  case
    when owned_relation.oid is null then null
    else pg_catalog.format(
      '%I.%I.%I',
      owned_namespace.nspname,
      owned_relation.relname,
      owned_attribute.attname
    )
  end as owned_by,
  sequence_row.relacl::text as raw_sequence_acl,
  pg_catalog.has_sequence_privilege(
    'anon',
    sequence_row.oid,
    'USAGE'
  ) as anon_has_usage,
  pg_catalog.has_sequence_privilege(
    'anon',
    sequence_row.oid,
    'SELECT'
  ) as anon_has_select,
  pg_catalog.has_sequence_privilege(
    'anon',
    sequence_row.oid,
    'UPDATE'
  ) as anon_has_update,
  pg_catalog.has_sequence_privilege(
    'authenticated',
    sequence_row.oid,
    'USAGE'
  ) as authenticated_has_usage,
  pg_catalog.has_sequence_privilege(
    'authenticated',
    sequence_row.oid,
    'SELECT'
  ) as authenticated_has_select,
  pg_catalog.has_sequence_privilege(
    'authenticated',
    sequence_row.oid,
    'UPDATE'
  ) as authenticated_has_update,
  pg_catalog.has_sequence_privilege(
    'service_role',
    sequence_row.oid,
    'USAGE'
  ) as service_role_has_usage,
  pg_catalog.has_sequence_privilege(
    'service_role',
    sequence_row.oid,
    'SELECT'
  ) as service_role_has_select,
  pg_catalog.has_sequence_privilege(
    'service_role',
    sequence_row.oid,
    'UPDATE'
  ) as service_role_has_update
from pg_catalog.pg_class sequence_row
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = sequence_row.relnamespace
left join pg_catalog.pg_depend dependency
  on dependency.classid = 'pg_catalog.pg_class'::regclass
 and dependency.objid = sequence_row.oid
 and dependency.refclassid = 'pg_catalog.pg_class'::regclass
 and dependency.deptype in ('a', 'i')
left join pg_catalog.pg_class owned_relation
  on owned_relation.oid = dependency.refobjid
left join pg_catalog.pg_namespace owned_namespace
  on owned_namespace.oid = owned_relation.relnamespace
left join pg_catalog.pg_attribute owned_attribute
  on owned_attribute.attrelid = owned_relation.oid
 and owned_attribute.attnum = dependency.refobjsubid
where namespace_row.nspname = 'public'
  and sequence_row.relkind = 'S'
order by sequence_row.relname;

-- F2. Raw sequence ACL entries, including PUBLIC and owner defaults.
select
  'F2'::text as audit_section,
  namespace_row.nspname as sequence_schema,
  sequence_row.relname as sequence_name,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  grantor.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable
from pg_catalog.pg_class sequence_row
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = sequence_row.relnamespace
cross join lateral pg_catalog.aclexplode(
  case
    when sequence_row.relacl is null then
      pg_catalog.acldefault('S', sequence_row.relowner)
    when pg_catalog.array_ndims(sequence_row.relacl) = 1 then
      sequence_row.relacl
    else pg_catalog.acldefault('S', sequence_row.relowner)
  end
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where namespace_row.nspname = 'public'
  and sequence_row.relkind = 'S'
  and (
    sequence_row.relacl is null
    or pg_catalog.array_ndims(sequence_row.relacl) = 1
  )
order by
  sequence_row.relname,
  coalesce(grantee.rolname, 'PUBLIC'),
  privilege.privilege_type;

-- F3. Default privileges can silently reintroduce broad grants on future
-- tables, sequences and functions.
select
  'F3'::text as audit_section,
  owner_role.rolname as owner_name,
  namespace_row.nspname as schema_name,
  case default_acl.defaclobjtype
    when 'r' then 'table'
    when 'S' then 'sequence'
    when 'f' then 'function'
    when 'T' then 'type'
    when 'n' then 'schema'
    else default_acl.defaclobjtype::text
  end as object_type,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  grantor.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable
from pg_catalog.pg_default_acl default_acl
join pg_catalog.pg_roles owner_role
  on owner_role.oid = default_acl.defaclrole
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = default_acl.defaclnamespace
cross join lateral pg_catalog.aclexplode(
  case
    when pg_catalog.array_ndims(default_acl.defaclacl) = 1 then
      default_acl.defaclacl
    else pg_catalog.acldefault(
      default_acl.defaclobjtype,
      default_acl.defaclrole
    )
  end
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where (
    namespace_row.nspname in ('public', 'private', 'storage')
    or default_acl.defaclnamespace = 0
  )
  and pg_catalog.array_ndims(default_acl.defaclacl) = 1
order by
  owner_role.rolname,
  namespace_row.nspname nulls first,
  object_type,
  coalesce(grantee.rolname, 'PUBLIC'),
  privilege.privilege_type;

-- G1. Storage buckets and their public/private mode.
select
  'G1'::text as audit_section,
  bucket.id,
  bucket.name,
  bucket.public,
  bucket.file_size_limit,
  bucket.allowed_mime_types
from storage.buckets bucket
order by bucket.id;

-- G2. Effective API-role privileges on Storage metadata tables. Object-level
-- access still depends on the storage policies returned by C2.
with requested_roles(role_name) as (
  values
    ('anon'::text),
    ('authenticated'::text),
    ('service_role'::text)
),
requested_privileges(privilege_name) as (
  values
    ('SELECT'::text),
    ('INSERT'::text),
    ('UPDATE'::text),
    ('DELETE'::text)
)
select
  'G2'::text as audit_section,
  namespace_row.nspname as table_schema,
  relation.relname as table_name,
  requested_role.role_name,
  requested_privilege.privilege_name,
  pg_catalog.has_table_privilege(
    requested_role.role_name,
    relation.oid,
    requested_privilege.privilege_name
  ) as has_privilege,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = relation.relnamespace
cross join requested_roles requested_role
cross join requested_privileges requested_privilege
where namespace_row.nspname = 'storage'
  and relation.relname in ('buckets', 'objects')
  and relation.relkind in ('r', 'p')
  and pg_catalog.to_regrole(requested_role.role_name) is not null
  and pg_catalog.has_table_privilege(
    requested_role.role_name,
    relation.oid,
    requested_privilege.privilege_name
  )
order by
  relation.relname,
  requested_role.role_name,
  requested_privilege.privilege_name;

commit;
