-- Client Portal 1.0B1 structural audit: catalogs only, ONE result set.
-- Does NOT execute application RPCs or read business/auth rows.
-- PASS is structural evidence, NOT real-session authorization/concurrency proof.
-- Smoke separately: management publish/version conflict/reorder; worker denial;
-- client assigned/unassigned/unpublished/revoked/inactive; direct table denial.
begin;
set transaction read only;
set local search_path = pg_catalog;

with expected_tables(name) as (
  values ('client_object_progress'::text), ('client_object_progress_stages')
), tables as materialized (
  select e.name, c.oid, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  from expected_tables e left join pg_class c on c.oid = to_regclass('public.' || e.name)
    and c.relkind = 'r'
), expected_columns(table_name, name, type_name, required, identity_kind) as (
  values
    ('client_object_progress','object_id','bigint',true,''),
    ('client_object_progress','overall_percent','smallint',true,''),
    ('client_object_progress','completed_summary','text',false,''),
    ('client_object_progress','next_summary','text',false,''),
    ('client_object_progress','version','bigint',true,''),
    ('client_object_progress','created_at','timestamp with time zone',true,''),
    ('client_object_progress','updated_at','timestamp with time zone',true,''),
    ('client_object_progress','created_by','uuid',false,''),
    ('client_object_progress','updated_by','uuid',false,''),
    ('client_object_progress_stages','id','bigint',true,'a'),
    ('client_object_progress_stages','object_id','bigint',true,''),
    ('client_object_progress_stages','title','text',true,''),
    ('client_object_progress_stages','status','text',true,''),
    ('client_object_progress_stages','sort_order','integer',true,''),
    ('client_object_progress_stages','created_at','timestamp with time zone',true,''),
    ('client_object_progress_stages','updated_at','timestamp with time zone',true,'')
), expected_fks(table_name, column_name, target, target_column, delete_action) as (
  values
    ('client_object_progress','object_id','public.objects','id','c'),
    ('client_object_progress','created_by','auth.users','id','n'),
    ('client_object_progress','updated_by','auth.users','id','n'),
    ('client_object_progress_stages','object_id','public.client_object_progress','object_id','c')
), expected_checks(table_name, name, normalized_expression) as (
  values
    ('client_object_progress','client_progress_percent_check','overall_percent>=0andoverall_percent<=100'),
    ('client_object_progress','client_progress_version_check','version>=1'),
    ('client_object_progress','client_progress_completed_check','completed_summaryisnullorcompleted_summary=btrimcompleted_summaryandlengthcompleted_summary>=1andlengthcompleted_summary<=2000'),
    ('client_object_progress','client_progress_next_check','next_summaryisnullornext_summary=btrimnext_summaryandlengthnext_summary>=1andlengthnext_summary<=2000'),
    ('client_object_progress_stages','client_progress_stage_title_check','title=btrimtitleandlengthtitle>=1andlengthtitle<=120'),
    ('client_object_progress_stages','client_progress_stage_status_check',$expr$status=anyarray['planned','in_progress','completed']$expr$),
    ('client_object_progress_stages','client_progress_stage_order_check','sort_order>=0')
), check_catalog as materialized (
  select e.*, c.oid, c.convalidated, pg_get_constraintdef(c.oid, true) as definition,
    -- CHECKs reference one relation (unlike trigger OLD/NEW WHEN expressions).
    regexp_replace(replace(replace(lower(pg_get_expr(c.conbin,c.conrelid)), '::text', ''), 'pg_catalog.', ''),
      '[[:space:]()]', '', 'g') as normalized_actual
  from expected_checks e join tables t on t.name = e.table_name
  left join pg_constraint c on c.conrelid = t.oid and c.conname::text = e.name and c.contype = 'c'
), expected_functions(signature, source_md5, output_names, output_types, volatility) as (
  values
    ('public.get_client_object_progress(bigint)','0278ed74776b14da44d557f707ed85cf',
      array['object_id','overall_percent','completed_summary','next_summary','updated_at','stages']::text[],
      array['bigint','smallint','text','text','timestamp with time zone','jsonb']::text[], 's'),
    ('public.get_management_client_object_progress(bigint)','5ad888337069ef0c5fe1e1fda92ea7e8',
      array['object_id','overall_percent','completed_summary','next_summary','updated_at','stages','version'],
      array['bigint','smallint','text','text','timestamp with time zone','jsonb','bigint'], 's'),
    ('public.save_client_object_progress(bigint,smallint,text,text,jsonb,bigint)','755dc1a4506b49fa44f358182976f669',
      array['object_id','overall_percent','completed_summary','next_summary','updated_at','stages','version'],
      array['bigint','smallint','text','text','timestamp with time zone','jsonb','bigint'], 'v')
), functions as materialized (
  select e.*, p.oid, p.proowner, p.prosecdef, p.proconfig, p.proacl, p.prosrc, p.proretset,
    p.proargnames, p.proargmodes, p.proallargtypes, p.provolatile, l.lanname
  from expected_functions e left join pg_proc p on p.oid = to_regprocedure(e.signature) and p.prokind = 'f'
  left join pg_language l on l.oid = p.prolang
), legacy_functions(signature, source_md5, security_definer, authenticated_execute) as (
  -- Reviewed 1.0A production/source baselines, including POST. Observation/check
  -- only: this migration must not replace or grant any of these functions.
  values
    ('private.guard_application_identity()','fc86743adc9d0efc3878e6e4b0d1473e',true,false),
    ('public.handle_new_user()','f055a9f5e7f827c549eff6e37b0c5b7c',true,false),
    ('private.is_active_client()','b220a9950bb96f0f6bd817af5fa20e41',true,true),
    ('private.client_has_object_access(bigint)','a94f372e167d6a9d30ab7db3ff2c698f',true,false),
    ('public.get_application_identity()','955b141f146d01b047b85e9ca744db27',true,true),
    ('public.get_client_objects(integer)','7f8fa613fd12e5f9495ba0104747972c',true,true),
    ('public.get_client_object(bigint)','faae6e13f9f94772084c3caaf0d538bf',true,true),
    ('public.get_admin_client_profiles(text,integer)','b4f02bb0b71c14846c2ec4264e1dcbe0',true,true),
    ('public.get_client_portal_provisioning_state()','c231fd3e9aef77ee82eea3a267412651',true,true),
    ('public.get_admin_object_clients(bigint,integer)','2b470a1a76779927f28a3a2371c7bf82',true,true),
    ('public.set_client_object_access(uuid,bigint,boolean)','d95584cb553ff8c85b3401546121ef1a',true,true),
    ('public.set_client_active(uuid,boolean)','8bdc3caa93ec4e01a2cc2d1509bcfba3',true,true),
    ('private.legacy_internal_signup_enabled()',md5('select false'),false,false)
), identity_sequence as materialized (
  -- pg_sequence first: has_sequence_privilege must never receive other relkinds.
  select c.oid, c.relacl, c.relowner from pg_sequence s join pg_class c on c.oid = s.seqrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'client_object_progress_stages_id_seq'
), checks as (
  select 'table:' || t.name as check_name,
    coalesce(t.oid is not null and t.relrowsecurity and not t.relforcerowsecurity
      and pg_get_userbyid(t.relowner) = 'postgres'
      and not exists (select 1 from pg_policy p where p.polrelid = t.oid)
      and not has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not exists (select 1 from pg_attribute a where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
        and (has_column_privilege('anon',t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')
          or has_column_privilege('authenticated',t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')))
      and not exists (select 1 from aclexplode(case when t.relacl is null then acldefault('r',t.relowner)
        when array_ndims(t.relacl)=1 then t.relacl else null::aclitem[] end) a where a.grantee=0),false) as matches,
    jsonb_build_object('oid',t.oid,'rls',t.relrowsecurity,'acl',t.relacl::text,
      'owner',pg_get_userbyid(t.relowner)) as evidence,
    'RPC-only, default-deny RLS; no PUBLIC/anon/authenticated direct table or column access.'::text as notes
  from tables t

  union all
  select 'column:' || e.table_name || '.' || e.name,
    coalesce(a.atttypid = to_regtype(e.type_name) and a.attnotnull = e.required and a.attidentity::text = e.identity_kind,false),
    jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity::text),
    'Typed column/nullability/identity contract.'
  from expected_columns e join tables t on t.name = e.table_name
  left join pg_attribute a on a.attrelid = t.oid and a.attname::text = e.name and a.attnum > 0 and not a.attisdropped

  union all
  select 'primary_key:' || t.name,
    exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid = t.oid
      and a.attname::text = case when t.name = 'client_object_progress' then 'object_id' else 'id' end
      where c.conrelid = t.oid and c.contype = 'p' and c.conkey = array[a.attnum]::smallint[] and c.convalidated),
    jsonb_build_object('table',t.name), 'Single-column primary key.' from tables t

  union all
  select 'foreign_key:' || e.table_name || '.' || e.column_name,
    exists (select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attname::text = e.column_name
      join pg_attribute b on b.attrelid = c.confrelid and b.attname::text = e.target_column
      where c.conrelid = t.oid and c.contype = 'f' and c.convalidated
        and c.conkey = array[a.attnum]::smallint[] and c.confkey = array[b.attnum]::smallint[]
        and c.confrelid = to_regclass(e.target) and c.confdeltype::text = e.delete_action and c.confupdtype = 'a'),
    jsonb_build_object('target',e.target,'delete_action',e.delete_action),
    'Object deletion removes progress only; auth actor deletion sets metadata NULL, never deletes objects.'
  from expected_fks e join tables t on t.name = e.table_name

  union all
  select 'constraint:' || c.name, coalesce(c.convalidated and c.normalized_actual = c.normalized_expression,false),
    jsonb_build_object('definition',c.definition,'normalized',c.normalized_actual,'expected',c.normalized_expression),
    'Validated bounded/trimmed text, percentage/version/order/status check.' from check_catalog c

  union all
  select 'stage_order_unique', exists (select 1 from pg_constraint c
      join tables t on t.oid = c.conrelid and t.name = 'client_object_progress_stages'
      join pg_attribute a on a.attrelid = t.oid and a.attname = 'object_id'
      join pg_attribute b on b.attrelid = t.oid and b.attname = 'sort_order'
      where c.contype = 'u' and c.conname = 'client_progress_stages_order_key'
        and c.conkey = array[a.attnum,b.attnum]::smallint[] and c.condeferrable and c.condeferred and c.convalidated),
    jsonb_build_object('columns',array['object_id','sort_order']),
    'DEFERRABLE INITIALLY DEFERRED permits atomic stage swaps.'

  union all
  select 'stage_identity_sequence', exists (select 1 from identity_sequence s
      where not has_sequence_privilege('anon',s.oid,'SELECT,USAGE,UPDATE')
        and not has_sequence_privilege('authenticated',s.oid,'SELECT,USAGE,UPDATE')
        and not exists (select 1 from aclexplode(case when s.relacl is null then acldefault('S',s.relowner)
          when array_ndims(s.relacl)=1 then s.relacl else null::aclitem[] end) a where a.grantee=0)),
    jsonb_build_object('name','public.client_object_progress_stages_id_seq'),
    'No direct API sequence use; generation happens inside the guarded definer mutation.'

  union all
  select 'rpc:' || f.signature,
    coalesce(f.oid is not null and f.prosecdef and pg_get_userbyid(f.proowner)='postgres'
      and f.proconfig = array['search_path=""'] and f.lanname = 'plpgsql' and f.proretset
      and f.provolatile::text = f.volatility and md5(f.prosrc)=f.source_md5
      and has_function_privilege('authenticated',f.oid,'EXECUTE')
      and not has_function_privilege('anon',f.oid,'EXECUTE')
      and not exists (select 1 from aclexplode(case when f.proacl is null then acldefault('f',f.proowner)
        when array_ndims(f.proacl)=1 then f.proacl else null::aclitem[] end) a where a.grantee=0)
      and (select array_agg(f.proargnames[i] order by i) from generate_subscripts(f.proallargtypes,1) i
        where f.proargmodes[i]='t') = f.output_names
      and (select array_agg(format_type(f.proallargtypes[i],null) order by i) from generate_subscripts(f.proallargtypes,1) i
        where f.proargmodes[i]='t') = f.output_types,false),
    jsonb_build_object('body_md5',md5(f.prosrc),'expected_md5',f.source_md5,'owner',pg_get_userbyid(f.proowner),
      'config',f.proconfig,'acl',f.proacl::text,'return_contract',pg_get_function_result(f.oid),
      'service_role_execute_observation',has_function_privilege('service_role',f.oid,'EXECUTE')),
    'Exact reviewed body pins auth/active/grant or management-role guard, allowlists, ordered max-50 stages, ownership and optimistic locking. ACL alone cannot distinguish client/worker from internal authenticated roles.'
  from functions f

  union all
  select 'preserved_1_0a:' || e.signature,
    coalesce(p.oid is not null and md5(p.prosrc)=e.source_md5 and p.prosecdef=e.security_definer
      and pg_get_userbyid(p.proowner)='postgres' and p.proconfig @> array['search_path=""']
      and has_function_privilege('authenticated',p.oid,'EXECUTE')=e.authenticated_execute
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not exists (select 1 from aclexplode(case when p.proacl is null then acldefault('f',p.proowner)
        when array_ndims(p.proacl)=1 then p.proacl else null::aclitem[] end) a where a.grantee=0),false),
    jsonb_build_object('body_md5',md5(p.prosrc),'expected_md5',e.source_md5),
    'Existing 1.0A identity, collision, active-client and object-grant contract unchanged; run full 1.0A audit for its remaining structural evidence.'
  from legacy_functions e left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'
), results as (
  select check_name, case when matches then 'PASS' else 'FAIL' end as status, evidence, notes, 0 as summary_order from checks
  union all
  select 'CLIENT_PORTAL_1_0B_STRUCTURAL_SUMMARY', case when bool_and(matches) then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'passed',count(*) filter(where matches),'failed',count(*) filter(where not matches)),
    'Structural evidence only. Still require actual admin/object_manager/worker/client sessions, stale and concurrent first publish, swapped orders, foreign-stage rejection and revoked/unassigned/direct-API smoke. No SQL mutation or application RPC executed by this audit.', 1
  from checks
)
select check_name, status, evidence, notes from results order by summary_order, check_name;
commit;
