-- Client Portal 1.0C2: production evidence discovery, not a security PASS audit.
-- Run manually in the Supabase SQL editor with catalog/bucket-read permission.
-- One result set; no document/object/auth-user rows or stored files are read.
-- Function definitions are catalog text only: no application/helper execution.
-- PostgreSQL 12+ catalogs and the existing Supabase storage.buckets(id) contract
-- are required. Optional bucket settings are read through an explicit allowlist.
begin;
set transaction read only;
set local search_path = pg_catalog;

with recursive target_relations(section, schema_name, relation_name) as (
  values ('A'::text, 'public'::text, 'object_documents'::text),
         ('B', 'storage', 'objects')
), relations as materialized (
  select t.*, c.oid, c.relkind, c.relowner, c.relacl,
    c.relrowsecurity, c.relforcerowsecurity
  from target_relations t
  left join pg_namespace n on n.nspname::text = t.schema_name
  left join pg_class c on c.relnamespace = n.oid and c.relname::text = t.relation_name
), api_roles as (
  select requested.role_name, r.oid
  from (values ('anon'::text), ('authenticated'), ('service_role')) requested(role_name)
  left join pg_roles r on r.rolname::text = requested.role_name
), document_columns as materialized (
  select a.attnum, a.attname::text as column_name,
    format_type(a.atttypid, a.atttypmod) as data_type,
    a.attnotnull, a.attidentity::text as identity_kind,
    a.attgenerated::text as generated_kind, a.attacl, a.attrelid,
    case when d.oid is not null then pg_get_expr(d.adbin, d.adrelid, true) end as default_expression
  from relations r
  join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where r.schema_name = 'public' and r.relation_name = 'object_documents' and r.relkind in ('r', 'p')
), document_constraints as materialized (
  select c.* from pg_constraint c join relations r on r.oid = c.conrelid
  where r.schema_name = 'public' and r.relation_name = 'object_documents'
), document_indexes as materialized (
  -- pg_index is the type-safe source for index OIDs, not a filtered pg_class scan.
  select i.*, ic.relname::text as index_name, am.amname::text as access_method
  from pg_index i
  join relations r on r.oid = i.indrelid
  join pg_class ic on ic.oid = i.indexrelid
  join pg_am am on am.oid = ic.relam
  where r.schema_name = 'public' and r.relation_name = 'object_documents'
), required_columns(column_name) as (
  values ('id'::text), ('object_id'), ('title'), ('category'), ('access_level'),
         ('original_file_name'), ('storage_path'), ('mime_type'), ('file_size'),
         ('note'), ('created_by'), ('created_at'), ('updated_at'), ('is_ready')
), bucket_record as materialized (
  -- Only this bucket's configuration; never storage.objects rows.
  -- Do not return this JSON wholesale: owner/owner_id and unknown metadata
  -- are deliberately excluded by bucket_setting_names below.
  select to_jsonb(b) as config from storage.buckets b where b.id = 'object-documents'
), bucket_setting_names(column_name) as (
  values ('id'::text), ('name'), ('public'), ('file_size_limit'),
         ('allowed_mime_types'), ('avif_autodetection'), ('type')
), bucket_columns as materialized (
  select a.attname::text as column_name, format_type(a.atttypid, a.atttypmod) as data_type
  from pg_attribute a
  where a.attrelid = to_regclass('storage.buckets') and a.attnum > 0 and not a.attisdropped
), storage_functions as materialized (
  -- Fence out aggregates/procedures before pg_get_functiondef is called.
  select p.*, n.nspname::text as schema_name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'storage' and p.prokind = 'f'
), storage_candidates as materialized (
  select p.*,
    (p.proname::text ~* '(operation|auth|sign|download|access|permission|policy|get.*object|object.*get)') as name_match,
    (p.prosrc ~* '(allow_only_operation|allow_any_operation|storage\.operation|request\.jwt|auth\.(uid|jwt|role)|get_authenticated)') as body_hint,
    exists (
      select 1 from pg_depend d join pg_policy pol on pol.oid = d.objid
      where d.classid = 'pg_catalog.pg_policy'::regclass
        and d.refclassid = 'pg_catalog.pg_proc'::regclass and d.refobjid = p.oid
        and pol.polrelid = to_regclass('storage.objects')
    ) as storage_policy_dependency
  from storage_functions p
  where p.proname::text ~* '(operation|auth|sign|download|access|permission|policy|get.*object|object.*get)'
    or p.prosrc ~* '(allow_only_operation|allow_any_operation|storage\.operation|request\.jwt|auth\.(uid|jwt|role)|get_authenticated)'
    or exists (
      select 1 from pg_depend d join pg_policy pol on pol.oid = d.objid
      where d.classid = 'pg_catalog.pg_policy'::regclass
        and d.refclassid = 'pg_catalog.pg_proc'::regclass and d.refobjid = p.oid
        and pol.polrelid = to_regclass('storage.objects')
    )
), required_guards(signature) as (
  values ('private.is_active_user()'::text), ('private.has_role(text[])'),
         ('private.is_active_client()'), ('private.client_has_object_access(bigint)'),
         ('private.is_admin()'), ('auth.uid()'), ('auth.jwt()'),
         ('public.set_object_documents_updated_at()'),
         ('storage.operation()'), ('storage.allow_only_operation(text)'),
         ('storage.allow_any_operation(text[])')
), guards as materialized (
  select g.signature, p.oid
  from required_guards g left join pg_proc p on p.oid = to_regprocedure(g.signature) and p.prokind = 'f'
), policy_function_refs as materialized (
  select distinct d.refobjid as function_oid, pol.polrelid, pol.polname::text as policy_name
  from pg_depend d join pg_policy pol on pol.oid = d.objid
  where d.classid = 'pg_catalog.pg_policy'::regclass
    and d.refclassid = 'pg_catalog.pg_proc'::regclass
    and pol.polrelid in (select oid from relations)
), document_triggers as materialized (
  select t.* from pg_trigger t
  where t.tgrelid = to_regclass('public.object_documents')
), document_functions as materialized (
  -- Name/body discovery is evidence, not proof of usage or an exhaustive call graph.
  select p.* from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prokind = 'f' and n.nspname in ('public','private','storage','auth')
    and (p.proname::text ~* '(document|document_ready)'
      or p.prosrc ~* '(object_documents|object-documents)')
), function_roots(oid) as (
  select oid from storage_candidates
  union select oid from guards where oid is not null
  union select function_oid from policy_function_refs
  union select tgfoid from document_triggers
  union select oid from document_functions
), function_closure(oid) as (
  select oid from function_roots
  union
  select d.refobjid from function_closure f join pg_depend d
    on d.classid = 'pg_catalog.pg_proc'::regclass and d.objid = f.oid
    and d.refclassid = 'pg_catalog.pg_proc'::regclass
  join pg_proc p on p.oid = d.refobjid and p.prokind = 'f'
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private','storage','auth')
), inspected_functions as materialized (
  -- MATERIALIZED + prokind fence keeps aggregates away from pg_get_functiondef.
  select p.* from pg_proc p join function_closure f on f.oid = p.oid where p.prokind = 'f'
), function_evidence as (
  select p.oid, jsonb_build_object(
    'signature', p.oid::regprocedure::text,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'arguments_with_defaults', pg_get_function_arguments(p.oid),
    'result', pg_get_function_result(p.oid),
    'owner', pg_get_userbyid(p.proowner),
    'language', l.lanname::text,
    'security_mode', case when p.prosecdef then 'DEFINER' else 'INVOKER' end,
    'volatility', p.provolatile::text,
    'proconfig', p.proconfig,
    'search_path', (select setting from unnest(p.proconfig) setting where setting like 'search_path=%' limit 1),
    'raw_acl', p.proacl::text,
    'expanded_acl', (select coalesce(jsonb_agg(jsonb_build_object(
      'grantee', case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      'grantor', pg_get_userbyid(a.grantor), 'privilege', a.privilege_type, 'grantable', a.is_grantable)
      order by a.grantee,a.privilege_type),'[]'::jsonb)
      from aclexplode(case when p.proacl is null then acldefault('f',p.proowner)
        when array_ndims(p.proacl)=1 then p.proacl else null::aclitem[] end) a),
    'public_execute', exists (
      select 1 from aclexplode(case
        when p.proacl is null then acldefault('f', p.proowner)
        when array_ndims(p.proacl) = 1 then p.proacl
        else null::aclitem[] end) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ),
    'execute_privileges', (select jsonb_object_agg(r.role_name, jsonb_build_object(
      'role_exists', r.oid is not null,
      'execute', case when r.oid is not null then has_function_privilege(r.oid, p.oid, 'EXECUTE') end,
      'schema_usage', case when r.oid is not null then has_schema_privilege(r.oid, p.pronamespace, 'USAGE') end
    )) from api_roles r),
    'source_md5', md5(p.prosrc),
    'function_definition', pg_get_functiondef(p.oid)
  ) as evidence
  from inspected_functions p join pg_language l on l.oid = p.prolang
), observations(section, check_name, status, evidence, notes) as (
  select r.section || '1', r.schema_name || '.' || r.relation_name || ':relation',
    case when r.oid is null then 'MISSING' when r.relkind not in ('r', 'p') then 'REVIEW' else 'OBSERVED' end,
    jsonb_build_object('exists', r.oid is not null, 'relation_kind', r.relkind::text,
      'owner', pg_get_userbyid(r.relowner), 'rls_enabled', r.relrowsecurity,
      'rls_forced', r.relforcerowsecurity, 'raw_table_acl', r.relacl::text),
    'Catalog state only. NULL ACL means default ACL semantics, not necessarily no privileges.'
  from relations r

  union all
  select 'A2', 'object_documents:columns_and_column_acl',
    case when exists (select 1 from document_columns) then 'OBSERVED' else 'MISSING' end,
    coalesce((select jsonb_agg(jsonb_build_object(
      'position', c.attnum, 'name', c.column_name, 'exact_type', c.data_type,
      'nullable', not c.attnotnull, 'identity_kind', c.identity_kind,
      'generated_kind', c.generated_kind, 'default_expression', c.default_expression,
      'raw_column_acl', c.attacl::text,
      'explicit_column_acl', (select coalesce(jsonb_agg(jsonb_build_object(
        'grantee', case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
        'grantor', pg_get_userbyid(acl.grantor),
        'privilege', acl.privilege_type, 'grantable', acl.is_grantable)
        order by acl.grantee,acl.privilege_type),'[]'::jsonb)
        from aclexplode(case when array_ndims(c.attacl)=1 then c.attacl else null::aclitem[] end) acl),
      'effective_column_privileges', (select jsonb_object_agg(r.role_name, jsonb_build_object(
        'role_exists', r.oid is not null,
        'SELECT', case when r.oid is not null then has_column_privilege(r.oid, c.attrelid, c.attnum, 'SELECT') end,
        'INSERT', case when r.oid is not null then has_column_privilege(r.oid, c.attrelid, c.attnum, 'INSERT') end,
        'UPDATE', case when r.oid is not null then has_column_privilege(r.oid, c.attrelid, c.attnum, 'UPDATE') end,
        'REFERENCES', case when r.oid is not null then has_column_privilege(r.oid, c.attrelid, c.attnum, 'REFERENCES') end
      )) from api_roles r)
    ) order by c.attnum) from document_columns c), '[]'::jsonb),
    'Explicit column ACL includes PUBLIC; named-role effective rights include table grants/inheritance and PUBLIC. NULL column ACL adds no column grants; RLS still applies. Identity: a=ALWAYS, d=BY DEFAULT, empty=none. No defaults are executed.'

  union all
  select 'A3', 'object_documents:primary_key',
    case when exists (select 1 from document_constraints where contype = 'p') then 'OBSERVED' else 'MISSING' end,
    coalesce((select jsonb_agg(jsonb_build_object('name', c.conname::text,
      'definition', pg_get_constraintdef(c.oid, true), 'validated', c.convalidated,
      'deferrable', c.condeferrable, 'initially_deferred', c.condeferred)
      order by c.conname::text) from document_constraints c where c.contype = 'p'), '[]'::jsonb),
    'Exact primary-key definition, without assuming key name or type.'

  union all
  select 'A4', 'object_documents:foreign_keys',
    case when exists (select 1 from document_constraints where contype = 'f') then 'OBSERVED' else 'MISSING' end,
    coalesce((select jsonb_agg(jsonb_build_object(
      'name', c.conname::text, 'definition', pg_get_constraintdef(c.oid, true),
      'column_mapping', (select jsonb_agg(jsonb_build_object(
        'position', k.position, 'local_column', local_a.attname::text,
        'target_relation', c.confrelid::regclass::text, 'target_column', target_a.attname::text
      ) order by k.position)
        from unnest(c.conkey, c.confkey) with ordinality k(local_num, target_num, position)
        left join pg_attribute local_a on local_a.attrelid = c.conrelid and local_a.attnum = k.local_num
        left join pg_attribute target_a on target_a.attrelid = c.confrelid and target_a.attnum = k.target_num),
      'on_delete', case c.confdeltype::text when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
        when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' else c.confdeltype::text end,
      'on_update', case c.confupdtype::text when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
        when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' else c.confupdtype::text end,
      'validated', c.convalidated, 'deferrable', c.condeferrable, 'initially_deferred', c.condeferred
    ) order by c.conname::text) from document_constraints c where c.contype = 'f'), '[]'::jsonb),
    'Includes every outbound FK and every component of composite FKs; no target business/auth rows are read.'

  union all
  select 'A5', 'object_documents:unique_and_check_constraints', 'OBSERVED',
    coalesce((select jsonb_agg(jsonb_build_object('name', c.conname::text, 'type', c.contype::text,
      'definition', pg_get_constraintdef(c.oid, true), 'validated', c.convalidated,
      'deferrable', c.condeferrable, 'initially_deferred', c.condeferred)
      order by c.contype::text, c.conname::text)
      from document_constraints c where c.contype in ('u', 'c', 'x')), '[]'::jsonb),
    'u=UNIQUE, c=CHECK, x=EXCLUDE. Empty array means none found; see A1 for relation existence.'

  union all
  select 'A6', 'object_documents:indexes', 'OBSERVED',
    coalesce((select jsonb_agg(jsonb_build_object(
      'name', i.index_name, 'access_method', i.access_method,
      'definition', pg_get_indexdef(i.indexrelid),
      'primary', i.indisprimary, 'unique', i.indisunique, 'valid', i.indisvalid, 'ready', i.indisready,
      'predicate', pg_get_expr(i.indpred, i.indrelid, true),
      'expressions', pg_get_expr(i.indexprs, i.indrelid, true),
      'columns', (select jsonb_agg(jsonb_build_object(
        'position', k.position, 'column', a.attname::text,
        'expression_or_column', pg_get_indexdef(i.indexrelid, k.position::integer, true),
        'included', k.position > i.indnkeyatts,
        'sort_direction', case when i.access_method = 'btree' and k.position <= i.indnkeyatts
          then case when (i.indoption[k.position::integer - 1] & 1) = 1 then 'DESC' else 'ASC' end end,
        'nulls_order', case when i.access_method = 'btree' and k.position <= i.indnkeyatts
          then case when (i.indoption[k.position::integer - 1] & 2) = 2 then 'FIRST' else 'LAST' end end
      ) order by k.position)
        from unnest(i.indkey) with ordinality k(attnum, position)
        left join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum)
    ) order by i.index_name) from document_indexes i), '[]'::jsonb),
    'ASC/DESC comes from indoption for B-tree keys; included columns are not ordering keys. Full definitions preserve other access-method semantics.'

  union all
  select r.section || '7', r.schema_name || '.' || r.relation_name || ':all_policies',
    case when r.oid is null then 'MISSING' else 'OBSERVED' end,
    coalesce((select jsonb_agg(jsonb_build_object(
      'name', p.policyname::text, 'command', p.cmd::text,
      'mode', p.permissive::text, 'roles', p.roles,
      'using', p.qual, 'with_check', p.with_check
    ) order by p.policyname::text)
      from pg_policies p where p.schemaname::text = r.schema_name and p.tablename::text = r.relation_name), '[]'::jsonb),
    'ALL policies on this relation, without bucket/name filtering. Review permissive OR and restrictive AND together. Empty set is not proof of access.'
  from relations r

  union all
  select r.section || '8', r.schema_name || '.' || r.relation_name || ':effective_table_privileges',
    case when r.oid is null then 'MISSING' else 'OBSERVED' end,
    (select jsonb_object_agg(a.role_name, jsonb_build_object(
      'role_exists', a.oid is not null,
      'SELECT', case when a.oid is not null and r.relkind in ('r', 'p') then has_table_privilege(a.oid, r.oid, 'SELECT') end,
      'INSERT', case when a.oid is not null and r.relkind in ('r', 'p') then has_table_privilege(a.oid, r.oid, 'INSERT') end,
      'UPDATE', case when a.oid is not null and r.relkind in ('r', 'p') then has_table_privilege(a.oid, r.oid, 'UPDATE') end,
      'DELETE', case when a.oid is not null and r.relkind in ('r', 'p') then has_table_privilege(a.oid, r.oid, 'DELETE') end
    )) from api_roles a),
    'anon/authenticated/service_role effective ACL rights include PUBLIC/inherited grants, not row authorization. False table SELECT does not exclude column SELECT; A2 reports document column rights.'
  from relations r

  union all
  select 'A9', 'object_documents:required_column:' || required.column_name,
    case when actual.attnum is null then 'MISSING' else 'OBSERVED' end,
    jsonb_build_object('exists', actual.attnum is not null, 'actual_type', actual.data_type,
      'nullable', not actual.attnotnull, 'identity_kind', actual.identity_kind, 'default_expression', actual.default_expression),
    'Application-required column existence and ACTUAL type; no expected SQL type is assumed.'
  from required_columns required left join document_columns actual using (column_name)

  union all
  select 'A10', 'object_documents:storage_path_uniqueness',
    case when not exists (select 1 from document_columns where column_name = 'storage_path') then 'MISSING' else 'OBSERVED' end,
    jsonb_build_object(
      'single_column_unique_constraint', exists (
        select 1 from document_constraints c join document_columns a on a.column_name = 'storage_path'
        where c.contype in ('p', 'u') and cardinality(c.conkey) = 1 and c.conkey[1] = a.attnum
      ),
      'valid_ready_unconditional_unique_index_on_path_alone', exists (
        select 1 from document_indexes i join document_columns a on a.column_name = 'storage_path'
        where i.indisunique and i.indisvalid and i.indisready and i.indnkeyatts = 1
          and i.indkey[0] = a.attnum and i.indexprs is null and i.indpred is null
      ),
      'unique_indexes_involving_path', coalesce((select jsonb_agg(jsonb_build_object(
        'name', i.index_name, 'definition', pg_get_indexdef(i.indexrelid),
        'valid', i.indisvalid, 'ready', i.indisready,
        'path_is_key', exists (select 1 from unnest(i.indkey) with ordinality k(attnum, position)
          where k.attnum = a.attnum and k.position <= i.indnkeyatts)
      ) order by i.index_name)
        from document_indexes i join document_columns a on a.column_name = 'storage_path'
        where i.indisunique and a.attnum = any(i.indkey)), '[]'::jsonb)
    ),
    'Composite/partial/expression uniqueness is not global path uniqueness. Included columns do not confer uniqueness. NULL behavior and expressions remain visible in A2/A6.'

  union all
  select 'C1', 'object-documents:bucket_configuration',
    case when exists (select 1 from bucket_record) then 'OBSERVED' else 'MISSING' end,
    jsonb_build_object(
      'exists', exists (select 1 from bucket_record),
      'settings', (select jsonb_object_agg(s.column_name, jsonb_build_object(
        'column_exists', c.column_name is not null, 'actual_type', c.data_type,
        'value', (select b.config -> s.column_name from bucket_record b)
      )) from bucket_setting_names s left join bucket_columns c using (column_name)),
      'available_configuration_columns', coalesce((select jsonb_agg(jsonb_build_object(
        'name', c.column_name, 'type', c.data_type) order by c.column_name) from bucket_columns c), '[]'::jsonb)
    ),
    'Only object-documents configuration values from the allowlist. Catalog column names/types expose schema, not owner IDs or user metadata; unknown column values are omitted.'

  union all
  select 'D1', 'storage:allow_only_operation_availability',
    case when exists (select 1 from storage_functions where proname = 'allow_only_operation') then 'OBSERVED' else 'MISSING' end,
    jsonb_build_object(
      'named_helper_exists', exists (select 1 from storage_functions where proname = 'allow_only_operation'),
      'overloads', coalesce((select jsonb_agg(f.evidence order by s.oid::regprocedure::text)
        from storage_functions s join function_evidence f on f.oid = s.oid
        where s.proname = 'allow_only_operation'), '[]'::jsonb),
      'candidate_count', (select count(*) from storage_candidates),
      'all_storage_function_signatures', coalesce((select jsonb_agg(p.oid::regprocedure::text
        order by p.oid::regprocedure::text) from storage_functions p), '[]'::jsonb)
    ),
    'Missing named helper does not rule out an equivalent: inspect D2 candidates. EXECUTE + schema USAGE are catalog callability evidence only; accepted operation names/Storage request context require review, not helper execution.'

  union all
  select 'D2', s.oid::regprocedure::text, 'REVIEW',
    f.evidence || jsonb_build_object('discovery_reason', jsonb_build_object(
      'name_match', s.name_match, 'body_hint', s.body_hint, 'storage_policy_dependency', s.storage_policy_dependency)),
    'Candidate discovery is heuristic plus direct catalog policy dependencies. Review exact body and signature for equivalent operation/download/signing checks; no behavior is inferred from its name.'
  from storage_candidates s join function_evidence f on f.oid = s.oid

  union all
  select 'E1', g.signature, case when g.oid is null then 'MISSING' else 'OBSERVED' end,
    jsonb_build_object('exists', g.oid is not null) || coalesce(f.evidence, '{}'::jsonb),
    'Baseline capture only: exact prosrc MD5, definition, config and EXECUTE ACL. No definition, grant or helper call is changed/executed.'
  from guards g left join function_evidence f on f.oid = g.oid

  union all
  select r.section || '11', r.schema_name || '.' || r.relation_name || ':expanded_table_acl',
    case when r.oid is null then 'MISSING'
      when r.relacl is not null and coalesce(array_ndims(r.relacl),0)>1 then 'REVIEW' else 'OBSERVED' end,
    jsonb_build_object(
      'raw_acl',r.relacl::text,
      'acl_dimensions',array_ndims(r.relacl),
      'entries',coalesce((select jsonb_agg(jsonb_build_object(
        'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
        order by a.grantee,a.privilege_type)
        from aclexplode(case when r.relacl is null then acldefault('r',r.relowner)
          when array_ndims(r.relacl)=1 then r.relacl else null::aclitem[] end) a),'[]'::jsonb)),
    'Full per-relation ACL, including PUBLIC/anon/authenticated/service_role and owner. Empty arrays are never passed to aclexplode as multidimensional ACLs. No privileges changed.'
  from relations r

  union all
  select 'A12','object_documents:triggers',
    case when exists (select 1 from document_triggers) then 'OBSERVED' else 'REVIEW' end,
    coalesce((select jsonb_agg(jsonb_build_object(
      'name',t.tgname::text,'enabled',t.tgenabled::text,'internal',t.tgisinternal,
      'function',t.tgfoid::regprocedure::text,'definition',pg_get_triggerdef(t.oid,true))
      order by t.tgname::text) from document_triggers t),'[]'::jsonb),
    'Readiness/metadata triggers and FK triggers are inspected, never fired. Trigger WHEN is deparsed using pg_get_triggerdef, not single-relation pg_get_expr.'

  union all
  select 'F1','documents:related_function_inventory',
    case when exists (select 1 from document_functions) then 'REVIEW' else 'MISSING' end,
    coalesce((select jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
      from document_functions p),'[]'::jsonb),
    'Name/body candidates, including document RPCs and trigger helpers. No match is not proof of absence; indirect or dynamic SQL may not mention the table.'

  union all
  select 'F2',p.oid::regprocedure::text,'REVIEW',
    f.evidence || jsonb_build_object(
      'document_name_or_body_candidate',exists (select 1 from document_functions d where d.oid=p.oid),
      'direct_policy_dependencies',coalesce((select jsonb_agg(jsonb_build_object(
        'relation',d.polrelid::regclass::text,'policy',d.policy_name)
        order by d.polrelid,d.policy_name) from policy_function_refs d where d.function_oid=p.oid),'[]'::jsonb),
      'document_trigger_bindings',coalesce((select jsonb_agg(t.tgname::text order by t.tgname::text)
        from document_triggers t where t.tgfoid=p.oid),'[]'::jsonb)),
    'Exact function body/return shape/security/config/ACL. Includes policy helpers from ALL Storage policies and catalog-recursive helper dependencies. PL/pgSQL text/dynamic calls are not always catalog dependencies: review the recovered bodies before design.'
  from inspected_functions p join function_evidence f on f.oid=p.oid
), output as (
  select * from observations
  union all
  select 'Z', 'CLIENT_PORTAL_1_0C2_DISCOVERY_SUMMARY', 'REVIEW',
    jsonb_build_object('observations', count(*),
      'observed', count(*) filter (where status = 'OBSERVED'),
      'missing', count(*) filter (where status = 'MISSING'),
      'review', count(*) filter (where status = 'REVIEW'),
      'runtime_authorization_tested', false, 'safe_to_deploy_document_access', false, 'business_rows_read', false,
      'bucket_configuration_only', true, 'document_policy_source_missing_in_repo', true),
    'Discovery only, never a security PASS. Review all policy combinations, actual types/FKs/indexes, helper semantics/ACLs and private bucket configuration before designing 1.0C2. Worker team-only/readiness semantics and client direct-API denial remain unproven. Actual client/internal sessions must later verify Storage authorization and revocation.'
  from observations
)
select section, check_name, status, evidence, notes
from output
order by left(section, 1), length(section), section, check_name;

commit;

