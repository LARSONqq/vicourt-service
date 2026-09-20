-- Client Portal 1.0A FINAL structural audit (PRE + app + POST + provisioning repair).
-- Strictly read-only: catalog evidence only; no user/business rows, tokens or
-- application RPC execution. ONE result set. Structural PASS is NOT session
-- smoke proof. Compare existing-boundary evidence with the reviewed discovery.
begin;
set transaction read only;
set local search_path = pg_catalog;

with expected_functions(signature, source_md5, security_definer, authenticated_execute) as (
  values
    ('private.guard_application_identity()', 'fc86743adc9d0efc3878e6e4b0d1473e', true, false),
    ('public.handle_new_user()', 'f055a9f5e7f827c549eff6e37b0c5b7c', true, false),
    ('private.is_active_client()', 'b220a9950bb96f0f6bd817af5fa20e41', true, true),
    ('private.client_has_object_access(bigint)', 'a94f372e167d6a9d30ab7db3ff2c698f', true, false),
    ('public.get_application_identity()', '955b141f146d01b047b85e9ca744db27', true, true),
    ('public.get_client_objects(integer)', '7f8fa613fd12e5f9495ba0104747972c', true, true),
    ('public.get_client_object(bigint)', 'faae6e13f9f94772084c3caaf0d538bf', true, true),
    ('public.get_admin_client_profiles(text,integer)', 'b4f02bb0b71c14846c2ec4264e1dcbe0', true, true),
    ('public.get_client_portal_provisioning_state()', 'c231fd3e9aef77ee82eea3a267412651', true, true),
    ('public.get_admin_object_clients(bigint,integer)', '2b470a1a76779927f28a3a2371c7bf82', true, true),
    ('public.set_client_object_access(uuid,bigint,boolean)', 'd95584cb553ff8c85b3401546121ef1a', true, true),
    ('public.set_client_active(uuid,boolean)', '8bdc3caa93ec4e01a2cc2d1509bcfba3', true, true),
    ('private.legacy_internal_signup_enabled()', md5('select false'), false, false)
), resolved_functions as materialized (
  select e.*, p.oid, p.prosecdef, p.proowner, p.proconfig, p.proacl, p.prosrc,
    p.proargnames, p.proargmodes, p.proallargtypes
  from expected_functions e left join pg_proc p on p.oid = to_regprocedure(e.signature)
), portal_tables(name, allowed_columns) as (
  values
    ('client_profiles'::text, array['user_id','display_name','is_active']::text[]),
    ('client_object_access', array['client_user_id','object_id']::text[])
), table_catalog as materialized (
  select t.*, c.oid, c.relrowsecurity, c.relowner
  from portal_tables t left join pg_class c on c.oid = to_regclass('public.' || t.name)
), expected_fks(table_name, column_name, target, target_column, delete_action) as (
  values
    ('client_profiles'::text, 'user_id'::text, 'auth.users'::text, 'id'::text, 'c'::text),
    ('client_profiles', 'updated_by', 'auth.users', 'id', 'n'),
    ('client_object_access', 'client_user_id', 'public.client_profiles', 'user_id', 'c'),
    ('client_object_access', 'object_id', 'public.objects', 'id', 'c'),
    ('client_object_access', 'granted_by', 'auth.users', 'id', 'n'),
    ('client_object_access', 'revoked_by', 'auth.users', 'id', 'n')
), expected_triggers(table_name, name, function_name, trigger_type) as (
  values
    ('auth.users'::text, 'on_auth_user_created'::text, 'public.handle_new_user()'::text, 5),
    ('public.profiles', 'client_portal_identity_guard', 'private.guard_application_identity()', 23),
    ('public.client_profiles', 'client_portal_identity_guard', 'private.guard_application_identity()', 23)
), public_sequences as materialized (
  select c.oid, c.relname, c.relacl from pg_sequence s
  join pg_class c on c.oid = s.seqrelid
  join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
), internal_relations as materialized (
  select c.*, n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where (n.nspname = 'public' or (n.nspname = 'storage' and c.relname in ('objects','buckets')))
    and c.relkind in ('r','p','v','m','f')
    and c.relname not in ('client_profiles','client_object_access')
), internal_functions as materialized (
  select p.*, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and p.prokind in ('f','p')
    and not exists (select 1 from resolved_functions f where f.oid = p.oid)
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
), checks as (
  select 'function:' || f.signature as check_name,
    coalesce(f.oid is not null and f.prosecdef = f.security_definer
      and pg_get_userbyid(f.proowner) = 'postgres'
      and f.proconfig @> array['search_path=""']
      and md5(f.prosrc) = f.source_md5
      and not has_function_privilege('anon', f.oid, 'EXECUTE')
      and has_function_privilege('authenticated', f.oid, 'EXECUTE') = f.authenticated_execute
      and not exists (
        select 1 from aclexplode(case
          when f.proacl is null then acldefault('f', f.proowner)
          when array_ndims(f.proacl) = 1 then f.proacl
          else null::aclitem[] end) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      ), false) as matches,
    jsonb_build_object('exists', f.oid is not null, 'body_matches_reviewed_source', md5(f.prosrc) = f.source_md5,
      'owner', pg_get_userbyid(f.proowner), 'config', f.proconfig, 'acl', f.proacl::text,
      'service_role_execute_observation', has_function_privilege('service_role', f.oid, 'EXECUTE')) as evidence,
    'Exact source-body comparison includes active identity, explicit grants, admin guards and collision denial. Does not execute this function.'::text as notes
  from resolved_functions f

  union all
  select 'table:' || t.name,
    coalesce(t.oid is not null and t.relrowsecurity and pg_get_userbyid(t.relowner) = 'postgres'
      and not has_table_privilege('authenticated', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not exists (
        select 1 from pg_attribute a where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
          and (has_column_privilege('authenticated',t.oid,a.attnum,'SELECT') <> (a.attname::text = any(t.allowed_columns))
            or has_column_privilege('authenticated',t.oid,a.attnum,'INSERT,UPDATE,REFERENCES')
            or has_column_privilege('anon',t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES'))
      ), false),
    jsonb_build_object('rls_enabled',t.relrowsecurity,'allowed_columns',t.allowed_columns,
      'columns',(select jsonb_agg(jsonb_build_object('name',a.attname::text,'type',format_type(a.atttypid,a.atttypmod),'nullable',not a.attnotnull))
        from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped)),
    'Clients have no direct writes. Column grants are a strict allowlist; the self-read policies below enforce identity.'
  from table_catalog t

  union all
  select 'foreign_key:' || e.table_name || '.' || e.column_name,
    exists (
      select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      join pg_attribute target_a on target_a.attrelid=c.confrelid and target_a.attnum=c.confkey[1]
      where c.conrelid=to_regclass('public.'||e.table_name) and c.contype='f'
        and c.confrelid=to_regclass(e.target) and cardinality(c.conkey)=1
        and a.attname=e.column_name and target_a.attname=e.target_column
        and c.confdeltype::text=e.delete_action and c.convalidated
    ),
    jsonb_build_object('target',e.target,'delete_action',e.delete_action),
    'Cascade direction is from a deleted parent to its access mapping. Deleting clients cannot delete objects. Actor deletion only nulls metadata.'
  from expected_fks e

  union all
  select 'unique_identity_and_grant',
    (select count(*)=2 from pg_constraint c where c.contype='p' and
      ((c.conrelid=to_regclass('public.client_profiles') and pg_get_constraintdef(c.oid)='PRIMARY KEY (user_id)')
        or (c.conrelid=to_regclass('public.client_object_access') and pg_get_constraintdef(c.oid)='PRIMARY KEY (client_user_id, object_id)'))),
    '{}'::jsonb,
    'One profile per auth account; one grant row per client/object pair. Revocation is soft; regrant reuses the pair.'

  union all
  select 'no_client_to_business_cascade',
    not exists (select 1 from pg_constraint c
      where c.contype='f' and c.confrelid in (to_regclass('public.client_profiles'),to_regclass('public.client_object_access'))
        and c.conrelid not in (to_regclass('public.client_profiles'),to_regclass('public.client_object_access'))
        and c.confdeltype='c'),
    '{}'::jsonb,
    'No business table may cascade-delete its rows when a client identity/access mapping is deleted.'

  union all
  select 'identity_trigger:'||t.table_name,
    exists (select 1 from pg_trigger g where g.tgrelid=to_regclass(t.table_name)
      and g.tgname=t.name and g.tgfoid=to_regprocedure(t.function_name)
      and g.tgtype=t.trigger_type and g.tgenabled='O' and not g.tgisinternal),
    jsonb_build_object('binding',t.name,'function',t.function_name,'expected_trigger_type',t.trigger_type),
    'Shared auth-row lock and both profile guards prevent concurrent dual identity creation. Signup binding remains AFTER INSERT.'
  from expected_triggers t

  union all
  select 'identity_classification_update_trigger',
    exists (
      select 1 from pg_trigger g
      join pg_attribute a on a.attrelid=g.tgrelid and a.attnum=g.tgattr[0]
      where g.tgrelid=to_regclass('auth.users') and g.tgname='on_auth_user_classified'
        and g.tgfoid=to_regprocedure('public.handle_new_user()')
        and g.tgtype=17 and g.tgenabled='O' and not g.tgisinternal
        and g.tgnargs=0 and cardinality(g.tgattr::smallint[])=1
        and a.attname='raw_app_meta_data' and not a.attisdropped
        and g.tgqual is not null
        and position(
          'foreachrowwhenold.raw_app_meta_data->>''account_type''isnullandnew.raw_app_meta_data->>''account_type''=anyarray[''internal'',''client'']executefunction'
          in regexp_replace(
            replace(lower(pg_get_triggerdef(g.oid,true)), '::text', ''),
            '[[:space:]()]', '', 'g'
          )
        ) > 0
    ),
    (select jsonb_build_object(
      'definition',pg_get_triggerdef(g.oid,true),
      'normalized_definition',regexp_replace(
        replace(lower(pg_get_triggerdef(g.oid,true)), '::text', ''),
        '[[:space:]()]', '', 'g'
      )
    ) from pg_trigger g
      where g.tgrelid=to_regclass('auth.users') and g.tgname='on_auth_user_classified'),
    'Auth INSERT precedes app_metadata UPDATE. PASS requires the exact reviewed WHEN expression after normalization: old account_type IS NULL AND new account_type IN (internal, client). Source body/ACL checks remain above; actual Admin API create smoke is still required.'

  union all
  select 'client_self_read_policies',
    (select count(*)=2 from pg_policy p where p.polrelid in (to_regclass('public.client_profiles'),to_regclass('public.client_object_access')))
    and (select count(*)=2 from pg_policy p
      where p.polcmd='r' and p.polpermissive and p.polroles=array[to_regrole('authenticated')::oid]
        and ((p.polrelid=to_regclass('public.client_profiles') and p.polname='client_profile_self_read'
          and regexp_replace(lower(pg_get_expr(p.polqual,p.polrelid)),'[[:space:]()]','','g')='user_id=auth.uidandprivate.is_active_client')
          or (p.polrelid=to_regclass('public.client_object_access') and p.polname='client_grant_self_read'
          and regexp_replace(lower(pg_get_expr(p.polqual,p.polrelid)),'[[:space:]()]','','g')='client_user_id=auth.uidandrevoked_atisnullandprivate.is_active_client'))),
    '{}'::jsonb,
    'Exactly the two SELECT-only self policies; no client activation or self-grant policy.'

  union all
  select 'client_object_dto_allowlist',
    (select count(*)=2 and bool_and(pg_get_function_result(f.oid)='TABLE(id bigint, name text, address text, status text)')
      from resolved_functions f where f.signature in ('public.get_client_objects(integer)','public.get_client_object(bigint)')),
    jsonb_build_object('fields',array['id','name','address','status']),
    'No contact, employee, costs, finance, notes, timestamps or management metadata; no broad objects row return.'

  union all
  select 'internal_role_constraint',
    exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.profiles') and c.contype='c'
      and pg_get_constraintdef(c.oid) like '%role%'
      and (select array_agg(m[1] order by m[1]) from regexp_matches(pg_get_constraintdef(c.oid),'''([^'']+)''','g') m)
        = array['admin','object_manager','worker']::text[]),
    '{}'::jsonb, 'Internal role CHECK remains exactly the three original roles.'

  union all
  select 'internal_auth_helper_configuration',
    (select count(*)=3 and bool_and(p.prosecdef and coalesce(p.proconfig @> array['search_path=""'],false))
      from pg_proc p where p.oid in (to_regprocedure('private.is_active_user()'),to_regprocedure('private.has_role(text[])'),to_regprocedure('private.is_admin()'))),
    (select jsonb_object_agg(p.oid::regprocedure::text,pg_get_functiondef(p.oid))
      from pg_proc p where p.oid in (to_regprocedure('private.is_active_user()'),to_regprocedure('private.has_role(text[])'),to_regprocedure('private.is_admin()'))),
    'Bodies are observation evidence to compare with verified discovery. This migration does not redefine internal helpers.'

  union all
  select 'internal_objects_select_boundary',
    exists (select 1 from pg_class c where c.oid=to_regclass('public.objects') and c.relrowsecurity)
    and exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename='objects'
      and p.cmd in ('SELECT','ALL') and p.qual like '%private.is_active_user()%')
    and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename='objects'
      and p.cmd in ('SELECT','ALL') and p.permissive='PERMISSIVE'
      and p.roles && array['authenticated','public']::name[]
      and coalesce(p.qual,'') not like '%private.is_active_user()%'
      and coalesce(p.qual,'') not like '%private.has_role(%'
      and coalesce(p.qual,'') not like '%private.is_admin()%'),
    jsonb_build_object('no_new_client_objects_policy',true),
    'Structural drift screen only; exact policy semantics were reviewed in discovery. A new client objects SELECT policy is forbidden.'
), output as (
  select 10 as sort_order, check_name, case when matches then 'PASS' else 'FAIL' end as status, evidence, notes from checks
  union all
  select 90, 'EXISTING_DIRECT_API_OBSERVATION', 'REVIEW',
    jsonb_build_object(
      'relations',(select jsonb_agg(jsonb_build_object(
        'relation',r.oid::regclass::text,'rls',r.relrowsecurity,'acl',r.relacl::text,
        'policies',(select jsonb_agg(jsonb_build_object('name',p.policyname,'cmd',p.cmd,'mode',p.permissive,'roles',p.roles,'using',p.qual,'check',p.with_check))
          from pg_policies p where p.schemaname=r.nspname and p.tablename=r.relname),
        'view_definition',case when r.relkind in ('v','m') then pg_get_viewdef(r.oid,true) end
      ) order by r.oid::regclass::text) from internal_relations r),
      'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
        'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
        'definition',pg_get_functiondef(p.oid))) from internal_functions p),
      'sequences',(select jsonb_agg(jsonb_build_object('name',s.relname::text,'acl',s.relacl::text,
        'usage',has_sequence_privilege('authenticated',s.oid,'USAGE'),
        'select',has_sequence_privilege('authenticated',s.oid,'SELECT'),
        'update',has_sequence_privilege('authenticated',s.oid,'UPDATE'))) from public_sequences s),
      'buckets',(select jsonb_agg(jsonb_build_object('id',b.id,'public',b.public)) from storage.buckets b)
    ),
    'Observation only. Compare with reviewed production discovery; do not infer guard correctness from a name/text match. Private Data API exposure and Auth settings require Dashboard verification.'
  union all
  select 999, 'CLIENT_PORTAL_1_0A_STRUCTURAL_SUMMARY',
    case when bool_and(matches) then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'failed',count(*) filter(where not matches),
      'runtime_session_proof',false,'requires_internal_and_client_session_smoke',true,
      'requires_review_of_direct_api_observation',true,'private_schema_must_not_be_exposed',true),
    'PASS certifies listed structural contracts only. Required session smoke: internal roles, two isolated clients, guessed object IDs, revoked/disabled same-session access, direct internal API/RPC denial, and unclassified signup with forged user_metadata.'
  from checks
)
select check_name,status,evidence,notes from output order by sort_order,check_name;
commit;
