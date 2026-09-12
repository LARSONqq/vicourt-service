-- Security / DB Hardening 1A Cleanup: standalone production audit.
-- This script is strictly read-only. It changes no rows, privileges, schema,
-- policies, functions, triggers or default privileges.

begin;
set transaction read only;

-- A1. Effective anon privileges on every application-owned public table.
-- raw_relation_acl helps distinguish direct grants from inherited/PUBLIC ones.
with app_tables(table_order, table_name) as (
  values
    (1, 'activity_logs'::text),
    (2, 'app_settings'),
    (3, 'employees'),
    (4, 'equipment'),
    (5, 'equipment_service_records'),
    (6, 'equipment_usage_logs'),
    (7, 'materials'),
    (8, 'object_documents'),
    (9, 'object_expenses'),
    (10, 'object_payment_schedule'),
    (11, 'object_payments'),
    (12, 'object_photos'),
    (13, 'object_tasks'),
    (14, 'objects'),
    (15, 'profiles'),
    (16, 'push_delivery_attempts'),
    (17, 'push_notification_preferences'),
    (18, 'push_notification_states'),
    (19, 'push_subscriptions'),
    (20, 'task_checklist_items'),
    (21, 'task_templates'),
    (22, 'warehouse_items'),
    (23, 'warehouse_ledger_cutovers'),
    (24, 'warehouse_movements'),
    (25, 'warehouse_purchases'),
    (26, 'work_logs')
)
select
  'A1'::text as audit_section,
  app_table.table_order,
  app_table.table_name,
  relation.oid is not null as table_exists,
  pg_catalog.pg_get_userbyid(
    relation.relowner
  ) as owner_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced,
  relation.relacl::text as raw_relation_acl,
  pg_catalog.has_table_privilege(
    'anon', relation.oid, 'SELECT'
  ) as anon_select,
  pg_catalog.has_table_privilege(
    'anon', relation.oid, 'INSERT'
  ) as anon_insert,
  pg_catalog.has_table_privilege(
    'anon', relation.oid, 'UPDATE'
  ) as anon_update,
  pg_catalog.has_table_privilege(
    'anon', relation.oid, 'DELETE'
  ) as anon_delete,
  pg_catalog.has_table_privilege(
    'anon', relation.oid, 'TRUNCATE'
  ) as anon_truncate,
  pg_catalog.has_table_privilege(
    'anon', relation.oid, 'TRIGGER'
  ) as anon_trigger,
  pg_catalog.has_table_privilege(
    'anon', relation.oid, 'REFERENCES'
  ) as anon_references
from app_tables app_table
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
left join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = app_table.table_name
 and relation.relkind in ('r', 'p')
order by app_table.table_order;

-- A2. Exact app-table/role/structural-privilege rows that are candidates for
-- REVOKE. Only true effective privileges are returned.
with app_tables(table_name) as (
  values
    ('activity_logs'::text),
    ('app_settings'),
    ('employees'),
    ('equipment'),
    ('equipment_service_records'),
    ('equipment_usage_logs'),
    ('materials'),
    ('object_documents'),
    ('object_expenses'),
    ('object_payment_schedule'),
    ('object_payments'),
    ('object_photos'),
    ('object_tasks'),
    ('objects'),
    ('profiles'),
    ('push_delivery_attempts'),
    ('push_notification_preferences'),
    ('push_notification_states'),
    ('push_subscriptions'),
    ('task_checklist_items'),
    ('task_templates'),
    ('warehouse_items'),
    ('warehouse_ledger_cutovers'),
    ('warehouse_movements'),
    ('warehouse_purchases'),
    ('work_logs')
),
requested_roles(role_name) as (
  values
    ('anon'::text),
    ('authenticated'::text)
),
structural_privileges(privilege_name) as (
  values
    ('TRUNCATE'::text),
    ('TRIGGER'::text),
    ('REFERENCES'::text)
)
select
  'A2'::text as audit_section,
  relation.relname as table_name,
  requested_role.role_name,
  structural_privilege.privilege_name,
  true as has_privilege
from app_tables app_table
join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = app_table.table_name
 and relation.relkind in ('r', 'p')
cross join requested_roles requested_role
cross join structural_privileges structural_privilege
where pg_catalog.has_table_privilege(
  requested_role.role_name,
  relation.oid,
  structural_privilege.privilege_name
)
order by
  relation.relname,
  requested_role.role_name,
  structural_privilege.privilege_name;

-- A3. Raw table ACL entries for PUBLIC/anon/authenticated. This identifies the
-- grant source when an effective privilege in A1/A2 is inherited from PUBLIC.
with app_tables(table_name) as (
  values
    ('activity_logs'::text),
    ('app_settings'),
    ('employees'),
    ('equipment'),
    ('equipment_service_records'),
    ('equipment_usage_logs'),
    ('materials'),
    ('object_documents'),
    ('object_expenses'),
    ('object_payment_schedule'),
    ('object_payments'),
    ('object_photos'),
    ('object_tasks'),
    ('objects'),
    ('profiles'),
    ('push_delivery_attempts'),
    ('push_notification_preferences'),
    ('push_notification_states'),
    ('push_subscriptions'),
    ('task_checklist_items'),
    ('task_templates'),
    ('warehouse_items'),
    ('warehouse_ledger_cutovers'),
    ('warehouse_movements'),
    ('warehouse_purchases'),
    ('work_logs')
)
select
  'A3'::text as audit_section,
  relation.relname as table_name,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  grantor.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable
from app_tables app_table
join pg_catalog.pg_namespace namespace_row
  on namespace_row.nspname = 'public'
join pg_catalog.pg_class relation
  on relation.relnamespace = namespace_row.oid
 and relation.relname = app_table.table_name
 and relation.relkind in ('r', 'p')
cross join lateral pg_catalog.aclexplode(
  case
    when relation.relacl is null then
      pg_catalog.acldefault('r', relation.relowner)
    else relation.relacl
  end
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where privilege.grantee = 0
   or grantee.rolname in ('anon', 'authenticated')
order by
  relation.relname,
  coalesce(grantee.rolname, 'PUBLIC'),
  privilege.privilege_type;

-- B1. Every user-defined trigger on auth.users plus its exact trigger
-- function security contract. pg_get_functiondef is included so profile-row
-- creation can be reviewed rather than inferred from the function name.
select
  'B1'::text as audit_section,
  trigger_row.tgname as trigger_name,
  trigger_row.tgenabled as trigger_enabled,
  pg_catalog.pg_get_triggerdef(
    trigger_row.oid,
    true
  ) as trigger_definition,
  function_namespace.nspname as function_schema,
  function_row.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(
    function_row.oid
  ) as identity_arguments,
  pg_catalog.pg_get_userbyid(
    function_row.proowner
  ) as function_owner,
  case
    when function_row.prosecdef then 'SECURITY DEFINER'
    else 'SECURITY INVOKER'
  end as function_security,
  function_row.proconfig as function_config,
  exists (
    select 1
    from unnest(
      coalesce(
        function_row.proconfig,
        '{}'::text[]
      )
    ) setting
    where setting like 'search_path=%'
  ) as has_fixed_search_path,
  function_row.prosrc ~* 'insert[[:space:]]+into[[:space:]]+public[.]profiles'
    as source_inserts_public_profiles,
  function_row.prosrc ~* 'public[.]profiles'
    as source_mentions_public_profiles,
  pg_catalog.has_table_privilege(
    function_row.proowner,
    profile_relation.oid,
    'INSERT'
  ) as function_owner_can_insert_profiles,
  pg_catalog.has_table_privilege(
    'anon',
    profile_relation.oid,
    'INSERT'
  ) as anon_can_insert_profiles,
  function_row.proacl::text as raw_function_acl,
  pg_catalog.pg_get_functiondef(
    function_row.oid
  ) as function_definition
from pg_catalog.pg_namespace auth_namespace
join pg_catalog.pg_class auth_users
  on auth_users.relnamespace = auth_namespace.oid
 and auth_users.relname = 'users'
 and auth_users.relkind in ('r', 'p')
join pg_catalog.pg_trigger trigger_row
  on trigger_row.tgrelid = auth_users.oid
 and not trigger_row.tgisinternal
join pg_catalog.pg_proc function_row
  on function_row.oid = trigger_row.tgfoid
join pg_catalog.pg_namespace function_namespace
  on function_namespace.oid = function_row.pronamespace
join pg_catalog.pg_namespace public_namespace
  on public_namespace.nspname = 'public'
join pg_catalog.pg_class profile_relation
  on profile_relation.relnamespace = public_namespace.oid
 and profile_relation.relname = 'profiles'
 and profile_relation.relkind in ('r', 'p')
where auth_namespace.nspname = 'auth'
order by trigger_row.tgname;

-- B2. Ownership and INSERT capabilities around auth.users/profile creation.
-- The auth service role is catalog-resolved rather than assumed to exist.
select
  'B2'::text as audit_section,
  pg_catalog.pg_get_userbyid(
    auth_users.relowner
  ) as auth_users_owner,
  pg_catalog.pg_get_userbyid(
    profile_relation.relowner
  ) as profiles_owner,
  auth_admin.rolname as auth_service_role,
  case
    when auth_admin.oid is null then null
    else pg_catalog.has_table_privilege(
      auth_admin.oid,
      profile_relation.oid,
      'INSERT'
    )
  end as auth_service_role_can_insert_profiles,
  pg_catalog.has_table_privilege(
    'anon',
    profile_relation.oid,
    'INSERT'
  ) as anon_can_insert_profiles,
  profile_relation.relacl::text as profiles_raw_acl
from pg_catalog.pg_namespace auth_namespace
join pg_catalog.pg_class auth_users
  on auth_users.relnamespace = auth_namespace.oid
 and auth_users.relname = 'users'
 and auth_users.relkind in ('r', 'p')
join pg_catalog.pg_namespace public_namespace
  on public_namespace.nspname = 'public'
join pg_catalog.pg_class profile_relation
  on profile_relation.relnamespace = public_namespace.oid
 and profile_relation.relname = 'profiles'
 and profile_relation.relkind in ('r', 'p')
left join pg_catalog.pg_roles auth_admin
  on auth_admin.rolname = 'supabase_auth_admin'
where auth_namespace.nspname = 'auth';

-- C1. Explicit global/public default ACL entries. Each defaclacl value is
-- exploded independently, so no multidimensional ACL array is constructed.
select
  'C1'::text as audit_section,
  owner_role.rolname as owner_name,
  case
    when default_acl.defaclnamespace = 0 then '(global)'
    else namespace_row.nspname
  end as schema_name,
  case default_acl.defaclobjtype
    when 'r' then 'table'
    when 'S' then 'sequence'
    when 'f' then 'function'
    else default_acl.defaclobjtype::text
  end as object_type,
  default_acl.defaclacl::text as raw_default_acl,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  grantor.rolname as grantor,
  privilege.privilege_type,
  privilege.is_grantable,
  (
    privilege.grantee = 0
    or grantee.rolname in ('anon', 'authenticated')
  ) as affects_anon_or_authenticated
from pg_catalog.pg_default_acl default_acl
join pg_catalog.pg_roles owner_role
  on owner_role.oid = default_acl.defaclrole
left join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = default_acl.defaclnamespace
cross join lateral pg_catalog.aclexplode(
  default_acl.defaclacl
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where default_acl.defaclobjtype in ('r', 'S', 'f')
  and (
    default_acl.defaclnamespace = 0
    or namespace_row.nspname = 'public'
  )
order by
  owner_role.rolname,
  schema_name,
  object_type,
  coalesce(grantee.rolname, 'PUBLIC'),
  privilege.privilege_type;

-- D1. Sequence ownership, identity/default semantics, table INSERT capability
-- and effective anon/authenticated sequence privileges.
select
  'D1'::text as audit_section,
  sequence_row.relname as sequence_name,
  pg_catalog.pg_get_userbyid(
    sequence_row.relowner
  ) as sequence_owner,
  case
    when owned_relation.oid is null then null
    else pg_catalog.format(
      '%I.%I.%I',
      owned_namespace.nspname,
      owned_relation.relname,
      owned_attribute.attname
    )
  end as owned_by,
  owned_attribute.attidentity as identity_kind,
  pg_catalog.pg_get_expr(
    owned_default.adbin,
    owned_default.adrelid
  ) as column_default,
  sequence_row.relacl::text as raw_sequence_acl,
  pg_catalog.has_table_privilege(
    'anon',
    owned_relation.oid,
    'INSERT'
  ) as anon_can_insert_owned_table,
  pg_catalog.has_sequence_privilege(
    'anon', sequence_row.oid, 'USAGE'
  ) as anon_sequence_usage,
  pg_catalog.has_sequence_privilege(
    'anon', sequence_row.oid, 'SELECT'
  ) as anon_sequence_select,
  pg_catalog.has_sequence_privilege(
    'anon', sequence_row.oid, 'UPDATE'
  ) as anon_sequence_update,
  pg_catalog.has_table_privilege(
    'authenticated',
    owned_relation.oid,
    'INSERT'
  ) as authenticated_can_insert_owned_table,
  pg_catalog.has_sequence_privilege(
    'authenticated', sequence_row.oid, 'USAGE'
  ) as authenticated_sequence_usage,
  pg_catalog.has_sequence_privilege(
    'authenticated', sequence_row.oid, 'SELECT'
  ) as authenticated_sequence_select,
  pg_catalog.has_sequence_privilege(
    'authenticated', sequence_row.oid, 'UPDATE'
  ) as authenticated_sequence_update
from pg_catalog.pg_class sequence_row
join pg_catalog.pg_namespace sequence_namespace
  on sequence_namespace.oid = sequence_row.relnamespace
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
left join pg_catalog.pg_attrdef owned_default
  on owned_default.adrelid = owned_attribute.attrelid
 and owned_default.adnum = owned_attribute.attnum
where sequence_namespace.nspname = 'public'
  and sequence_row.relkind = 'S'
order by sequence_row.relname;

-- D2. Raw public-sequence ACL entries for PUBLIC/anon/authenticated. As with
-- table/default ACLs, each sequence ACL is independently one-dimensional.
select
  'D2'::text as audit_section,
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
    else sequence_row.relacl
  end
) privilege
left join pg_catalog.pg_roles grantor
  on grantor.oid = privilege.grantor
left join pg_catalog.pg_roles grantee
  on grantee.oid = privilege.grantee
where namespace_row.nspname = 'public'
  and sequence_row.relkind = 'S'
  and (
    privilege.grantee = 0
    or grantee.rolname in ('anon', 'authenticated')
  )
order by
  sequence_row.relname,
  coalesce(grantee.rolname, 'PUBLIC'),
  privilege.privilege_type;

commit;
