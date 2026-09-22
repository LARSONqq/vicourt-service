-- Client Portal 1.0C1a structural audit. Read-only; one consolidated result.
-- No business/auth/photo/file rows, helper calls or application RPC execution.
-- PASS is not runtime Storage authorization proof; test actual sessions later.
begin;
set transaction read only;
set local search_path = pg_catalog;

with publication_table as materialized (
  select c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
  from pg_class c where c.oid=to_regclass('public.client_object_photo_publications') and c.relkind='r'
), expected_columns(name,type_name,required,default_value) as (
  values ('photo_id','bigint',true,null), ('is_published','boolean',true,'false'),
    ('client_caption','text',false,null), ('sort_order','integer',true,'0'),
    ('published_at','timestamp with time zone',false,null), ('unpublished_at','timestamp with time zone',false,null),
    ('created_at','timestamp with time zone',true,'now'), ('updated_at','timestamp with time zone',true,'now'),
    ('created_by','uuid',false,null), ('updated_by','uuid',false,null)
), expected_fks(column_name,target,target_column,delete_action) as (
  values ('photo_id','public.object_photos','id','c'),
    ('created_by','auth.users','id','n'), ('updated_by','auth.users','id','n')
), expected_constraints(name,normalized_expression) as (
  values ('client_photo_caption_check','client_captionisnullorclient_caption=btrimclient_captionandlengthclient_caption>=1andlengthclient_caption<=500'),
    ('client_photo_order_check','sort_order>=0'),
    ('client_photo_published_check','notis_publishedorpublished_atisnotnull')
), expected_functions(signature,source_md5,definer,volatility,language,authenticated_execute,output_names,output_types) as (
  values
    ('private.client_photo_is_safe_raster(text,text)','c6d4c2bdf2144d11830096d188dbcc44',false,'i','sql',true,array[]::text[],array[]::text[]),
    ('private.client_can_read_object_photo(text)','42c895b81e36b2a8c46e3621d5bed408',true,'s','sql',true,array[]::text[],array[]::text[]),
    ('public.get_client_object_photos(bigint,integer)','a98f41e73eb71faaa0f40880b5a72d02',true,'s','plpgsql',true,
      array['id','object_id','caption','published_at','total_count'],array['bigint','bigint','text','timestamp with time zone','bigint']),
    ('public.get_client_object_photo_file(bigint,bigint)','d549ad0aca586fe34fef2dc38b733436',true,'s','plpgsql',true,
      array['storage_path'],array['text']),
    ('public.get_management_client_photo_publications(bigint,bigint[])','a89b3288abb08e97b89377ad39b9e6bb',true,'s','plpgsql',true,
      array['photo_id','object_id','is_published','client_caption','sort_order','published_at','unpublished_at','updated_at'],
      array['bigint','bigint','boolean','text','integer','timestamp with time zone','timestamp with time zone','timestamp with time zone']),
    ('public.set_client_object_photo_publication(bigint,bigint,boolean,text,integer)','432adbcbff14ec410d1724ee175a5cb5',true,'v','plpgsql',true,
      array['photo_id','object_id','is_published','client_caption','sort_order','published_at','unpublished_at','updated_at'],
      array['bigint','bigint','boolean','text','integer','timestamp with time zone','timestamp with time zone','timestamp with time zone'])
), functions as materialized (
  select e.*,p.oid,p.proname,p.pronamespace,p.proowner,p.prosecdef,p.proconfig,p.proacl,p.prosrc,
    p.provolatile,p.proretset,p.prorettype,p.proargnames,p.proargmodes,p.proallargtypes,l.lanname
  from expected_functions e left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'
  left join pg_language l on l.oid=p.prolang
), preserved_functions(signature) as (
  values ('private.is_active_user()'),('private.has_role(text[])'),
    ('private.is_active_client()'),('private.client_has_object_access(bigint)'),
    ('storage.allow_only_operation(text)'),('storage.allow_any_operation(text[])'),('storage.operation()'),
    ('public.get_client_object_progress(bigint)'),('public.get_management_client_object_progress(bigint)'),
    ('public.save_client_object_progress(bigint,smallint,text,text,jsonb,bigint)')
), preserved_catalog as materialized (
  select p.* from pg_proc p where p.prokind='f'
    and p.oid in (select to_regprocedure(signature) from preserved_functions)
), baseline as (
  select 'client-portal-1.0c1a:v1;policies=' || (
    select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
    from pg_policies p where ((p.schemaname='storage' and p.tablename='objects')
      or (p.schemaname='public' and p.tablename='object_photos'))
      and not (p.schemaname='storage' and p.policyname='client_object_photos_authenticated_get')
  ) || ';guards=' || (
    select md5(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text) from preserved_catalog p
  ) as current_fingerprint
), client_policy as materialized (
  select p.*,regexp_replace(replace(replace(replace(coalesce(p.qual,''),
    '::text[]',''),'::text',''),'objects.',''),'[[:space:]()]','','g') as normalized_qual
  from pg_policies p where p.schemaname='storage' and p.tablename='objects'
    and p.policyname='client_object_photos_authenticated_get'
), reviewed_policy_contracts(schema_name, table_name, command, expressions) as (
    values
      ('public','object_photos','SELECT',array['private.is_active_user']),
      ('public','object_photos','INSERT',array[$expr$private.has_roleARRAY['admin','object_manager']$expr$]),
      ('public','object_photos','DELETE',array[$expr$private.has_roleARRAY['admin','object_manager']$expr$]),
      ('storage','objects','SELECT',array[
        $expr$bucket_id='object-photos'ANDprivate.is_active_user$expr$,
        $expr$private.is_active_userANDbucket_id='object-photos'$expr$]),
      ('storage','objects','INSERT',array[
        $expr$bucket_id='object-photos'ANDprivate.has_roleARRAY['admin','object_manager']$expr$,
        $expr$private.has_roleARRAY['admin','object_manager']ANDbucket_id='object-photos'$expr$]),
      ('storage','objects','DELETE',array[
        $expr$bucket_id='object-photos'ANDprivate.has_roleARRAY['admin','object_manager']$expr$,
        $expr$private.has_roleARRAY['admin','object_manager']ANDbucket_id='object-photos'$expr$])
  ), policy_expressions as (
    select p.*, regexp_replace(replace(replace(replace(
      case when p.cmd='INSERT' then p.with_check else p.qual end,
      '::text[]',''),'::text',''),'objects.bucket_id','bucket_id'),'[[:space:]()]','','g') as compact_expression
    from pg_policies p
    where (p.schemaname='public' and p.tablename='object_photos')
      or (p.schemaname='storage' and p.tablename='objects'
        and p.policyname<>'client_object_photos_authenticated_get'
        and (p.policyname='Authenticated users can read object photo files'
          or coalesce(p.qual,'') like '%''object-photos''%'
          or coalesce(p.with_check,'') like '%''object-photos''%'))
  ), normalized_policies as (
    -- Replace ONLY the two exact, uncorrelated scalar SELECT forms discovered.
    -- Do not strip arbitrary SELECT/AS/FROM/WHERE, boolean terms or role names.
    select p.*, replace(replace(p.compact_expression,
      'SELECTprivate.is_active_userASis_active_user','private.is_active_user'),
      $expr$SELECTprivate.has_roleARRAY['admin','object_manager']AShas_role$expr$,
      $expr$private.has_roleARRAY['admin','object_manager']$expr$) as normalized_expression
    from policy_expressions p
  ), internal_policy_checks as (
    select p.schemaname::text||'.'||p.tablename::text||':'||p.policyname::text as check_name,
      p.schemaname::text as schema_name, p.tablename::text as table_name, p.cmd as command,
      coalesce(p.permissive='PERMISSIVE' and p.roles=array['authenticated'::name]
        and p.normalized_expression=any(e.expressions)
        and case when p.cmd='INSERT' then p.qual is null else p.with_check is null end
        and (p.schemaname<>'storage' or p.cmd<>'SELECT'
          or p.policyname='Authenticated users can read object photo files'),false) as matches,
      jsonb_build_object('roles',p.roles,'command',p.cmd,'mode',p.permissive,
        'using',p.qual,'with_check',p.with_check,'normalized',p.normalized_expression) as evidence
    from normalized_policies p left join reviewed_policy_contracts e
      on e.schema_name=p.schemaname::text and e.table_name=p.tablename::text and e.command=p.cmd
  ), internal_policy_results as (
    select check_name,matches,evidence from internal_policy_checks
    union all
    select e.schema_name||'.'||e.table_name||':required_'||e.command,
      exists (select 1 from internal_policy_checks p where p.schema_name=e.schema_name
        and p.table_name=e.table_name and p.command=e.command and p.matches),
      jsonb_build_object('required_expressions',e.expressions)
    from reviewed_policy_contracts e
  ),
verified_guard_fingerprints(signature,source_md5) as (
  values
    ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1'),
    ('private.has_role(text[])','53ee6011008695bf5bba95283f571979'),
    ('private.is_active_client()','b220a9950bb96f0f6bd817af5fa20e41'),
    ('private.client_has_object_access(bigint)','a94f372e167d6a9d30ab7db3ff2c698f'),
    ('storage.allow_only_operation(text)','8682c6d323bc2e01e70abf92f4ae85f6'),
    ('storage.operation()','a9b2cc8c1b536867e48f86d3455d4704')
), checks(check_name,matches,evidence,notes) as (
  select 'publication_table_boundary', exists (select 1 from publication_table t
    where t.relrowsecurity and not t.relforcerowsecurity and pg_get_userbyid(t.relowner)='postgres'
      and not exists (select 1 from pg_policy p where p.polrelid=t.oid)
      and not has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not exists (select 1 from aclexplode(case when t.relacl is null then acldefault('r',t.relowner)
        when array_ndims(t.relacl)=1 then t.relacl else null::aclitem[] end) a
        where a.grantee in (0,to_regrole('anon')::oid,to_regrole('authenticated')::oid))
      and not exists (select 1 from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
        and (has_column_privilege('anon',t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')
          or has_column_privilege('authenticated',t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')))),
    (select jsonb_build_object('owner',pg_get_userbyid(t.relowner),'rls',t.relrowsecurity,
      'acl',t.relacl::text,'comment',obj_description(t.oid,'pg_class')) from publication_table t),
    'RPC-only table; no direct client/internal policies or API table/column privileges.'

  union all
  select 'column:'||e.name, coalesce(a.atttypid=to_regtype(e.type_name) and a.attnotnull=e.required
    and a.attidentity::text='' and a.attgenerated::text=''
    and regexp_replace(replace(pg_get_expr(d.adbin,d.adrelid),'pg_catalog.',''),'[[:space:]()]','','g') is not distinct from e.default_value,false),
    jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)),
    'Actual SQL type, nullability and default contract; no duplicate object/path columns.'
  from expected_columns e left join pg_attribute a on a.attrelid=to_regclass('public.client_object_photo_publications')
    and a.attname::text=e.name and a.attnum>0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum

  union all
  select 'exact_columns_and_primary_key',
    (select count(*)=10 from pg_attribute where attrelid=to_regclass('public.client_object_photo_publications') and attnum>0 and not attisdropped)
    and exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      where c.conrelid=to_regclass('public.client_object_photo_publications') and c.contype='p'
        and cardinality(c.conkey)=1 and a.attname='photo_id' and c.convalidated),
    '{}'::jsonb,'One publication per photo, no sequence or binary duplication.'

  union all
  select 'foreign_key:'||e.column_name, exists (select 1 from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
    where c.conrelid=to_regclass('public.client_object_photo_publications') and c.contype='f'
      and c.confrelid=to_regclass(e.target) and cardinality(c.conkey)=1
      and a.attname::text=e.column_name and b.attname::text=e.target_column
      and c.confdeltype::text=e.delete_action and c.confupdtype='a' and c.convalidated),
    jsonb_build_object('target',e.target,'delete_action',e.delete_action),
    'Original deletion removes dependent publication; actor deletion only clears audit attribution.'
  from expected_fks e

  union all
  select 'constraint:'||e.name, coalesce(c.convalidated and
    regexp_replace(replace(replace(lower(pg_get_expr(c.conbin,c.conrelid)),'::text',''),'pg_catalog.',''),
      '[[:space:]()]','','g')=e.normalized_expression,false),
    jsonb_build_object('definition',pg_get_constraintdef(c.oid,true),'expected_normalized',e.normalized_expression),
    'Trimmed nullable caption <=500 characters, nonnegative order, publication timestamp required.'
  from expected_constraints e left join pg_constraint c
    on c.conrelid=to_regclass('public.client_object_photo_publications') and c.conname::text=e.name and c.contype='c'

  union all
  select 'function:'||f.signature, coalesce(f.oid is not null and f.prosecdef=f.definer
    and pg_get_userbyid(f.proowner)='postgres' and f.proconfig=array['search_path=""']
    and f.provolatile::text=f.volatility and f.lanname::text=f.language and md5(f.prosrc)=f.source_md5
    and has_function_privilege('authenticated',f.oid,'EXECUTE')=f.authenticated_execute
    and not has_function_privilege('anon',f.oid,'EXECUTE')
    and not exists (select 1 from aclexplode(case when f.proacl is null then acldefault('f',f.proowner)
      when array_ndims(f.proacl)=1 then f.proacl else null::aclitem[] end) a where a.grantee=0)
    and (case when cardinality(f.output_names)=0 then not f.proretset and f.prorettype='boolean'::regtype else f.proretset end)
    and array(select f.proargnames[i] from generate_subscripts(f.proallargtypes,1) i where f.proargmodes[i]='t')=f.output_names
    and array(select format_type(f.proallargtypes[i],null) from generate_subscripts(f.proallargtypes,1) i where f.proargmodes[i]='t')=f.output_types,false),
    jsonb_build_object('body_md5',md5(f.prosrc),'expected_md5',f.source_md5,'config',f.proconfig,
      'acl',f.proacl::text,'return_contract',pg_get_function_result(f.oid)),
    'Exact reviewed body pins active identity/grant or management guard, safe raster matching, publication checks, caption isolation, pagination and locking. No RPC is executed.'
  from functions f

  union all
  select 'no_extra_photo_function_overloads', (select count(*)=6 from pg_proc p
    where (p.pronamespace,p.proname) in (select f.pronamespace,f.proname from functions f)),
    '{}'::jsonb,'No unreviewed overload can expose another contract under a new photo RPC name.'

  union all
  select 'client_storage_get_policy', exists (select 1 from client_policy p
    where p.cmd='SELECT' and p.permissive='PERMISSIVE' and p.roles=array['authenticated'::name]
      and p.with_check is null
      and p.normalized_qual=$expr$bucket_id='object-photos'ANDstorage.allow_only_operation'object.get_authenticated'ANDprivate.client_photo_is_safe_rastername,metadata->>'mimetype'ANDprivate.client_can_read_object_photoname$expr$),
    (select jsonb_build_object('roles',p.roles,'command',p.cmd,'mode',p.permissive,'using',p.qual,'normalized',p.normalized_qual) from client_policy p),
    'Exact bucket + operation + current-row MIME/extension predicate + narrow authorization helper. No list/sign/info/write operation is authorized by this policy.'

  union all
  select 'private_bucket_and_storage_rls',
    exists (select 1 from storage.buckets where id='object-photos' and public=false)
    and exists (select 1 from pg_class where oid=to_regclass('storage.objects') and relrowsecurity),
    (select jsonb_build_object('id',id,'public',public) from storage.buckets where id='object-photos'),
    'Public delivery must remain disabled. No Storage file enumeration.'

  union all
  select 'existing_policy_and_guard_preservation',
    coalesce(obj_description(to_regclass('public.client_object_photo_publications'),'pg_class')=b.current_fingerprint,false)
    and (select count(*)=10 from preserved_catalog),
    jsonb_build_object('current_fingerprint',b.current_fingerprint,
      'recorded_preflight_fingerprint',obj_description(to_regclass('public.client_object_photo_publications'),'pg_class')),
    'Exact preflight baseline includes ALL old Storage/photo policies (including upload/delete and unrelated buckets), 1.0A guards, Storage operation helpers and all 1.0B RPC bodies/config/ACL. No new client DML policies can be hidden outside the single excluded SELECT policy.'
  from baseline b

  union all
  select 'internal_policy:'||p.check_name,p.matches,p.evidence,
    'Exact authenticated/permissive SELECT or management INSERT/DELETE guard, including the reviewed scalar SELECT forms. UPDATE/ALL, extra roles/OR and missing required policies fail.'
  from internal_policy_results p

  union all
  select 'existing_storage_policy_modes', not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and permissive<>'PERMISSIVE'),
    coalesce((select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p
      where p.schemaname='storage' and p.tablename='objects'),'[]'::jsonb),
    'All Storage policies shown for combined OR/AND review. Other bucket policies remain fingerprinted, never rewritten.'

  union all
  select 'verified_guard:'||e.signature,coalesce(md5(p.prosrc)=e.source_md5,false),
    jsonb_build_object('source_md5',md5(p.prosrc),'expected_md5',e.source_md5),
    'Pinned production discovery evidence, not a trust-on-first-run fingerprint. Configuration/ACL preservation is checked separately.'
  from verified_guard_fingerprints e left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'

  union all
  select 'definer_storage_metadata_access',exists (select 1 from pg_roles r
    where r.rolname='postgres' and (r.rolsuper or r.rolbypassrls)
      and has_schema_privilege(r.oid,'storage','USAGE')
      and has_table_privilege(r.oid,to_regclass('storage.objects'),'SELECT')),
    (select jsonb_build_object('owner',r.rolname::text,'superuser',r.rolsuper,'bypassrls',r.rolbypassrls,
      'storage_select',has_table_privilege(r.oid,to_regclass('storage.objects'),'SELECT')) from pg_roles r where r.rolname='postgres'),
    'Every new DEFINER owner is separately pinned to postgres. Metadata reads must not depend on request-role Storage RLS.'

  union all
  select 'storage_policy_helpers_no_self_reference',
    coalesce((select count(*)=2 and bool_and(f.prosrc !~* 'storage[[:space:]]*[.][[:space:]]*objects'
      and md5(f.prosrc)=f.source_md5) from functions f
      where f.signature in ('private.client_can_read_object_photo(text)','private.client_photo_is_safe_raster(text,text)')),false),
    (select jsonb_agg(jsonb_build_object('signature',f.signature,'body',f.prosrc)) from functions f
      where f.signature in ('private.client_can_read_object_photo(text)','private.client_photo_is_safe_raster(text,text)')),
    'Authorization helper reads only photo/publication/grant state; raster predicate is pure input-only. Exact hashes detect even quoted/dynamic/indirect changes. Neither queries the policy relation.'

  union all
  select 'client_object_access_helper_acl_unchanged',
    coalesce(not has_function_privilege('authenticated',to_regprocedure('private.client_has_object_access(bigint)'),'EXECUTE')
      and not has_function_privilege('anon',to_regprocedure('private.client_has_object_access(bigint)'),'EXECUTE'),false),
    '{}'::jsonb,'Authenticated gets only the NEW photo authorization and pure raster predicates, never direct execution of the existing object-grant helper.'
), results as (
  select check_name,case when matches then 'PASS' else 'FAIL' end as status,evidence,notes,0 as summary_order from checks
  union all
  select 'CLIENT_PORTAL_1_0C1A_STRUCTURAL_SUMMARY',case when bool_and(matches) then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'failed',count(*) filter(where not matches),
      'runtime_authorization_tested',false,'requires_storage_session_smoke',true),
    'Structural proof only. Smoke internal roles, assigned/unassigned/revoked clients, unpublished/unsafe formats, direct GET/list/sign/write attempts, and unpublish during an open session. No business rows or application RPCs were read/executed.',1
  from checks
)
select check_name,status,evidence,notes from results order by summary_order,check_name;
commit;
