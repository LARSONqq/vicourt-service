-- Client Portal 1.0C2b structural audit: one read-only consolidated result.
-- Reviewed production pins must match the PRE and current catalog state.
-- No business/auth/file rows or application RPC/helper execution.
begin;
set transaction read only;
set local search_path = pg_catalog;

-- Each group is planned/executed separately. Only catalog/bucket configuration is read.
-- 16 groups retain all 47 logical checks; failed groups emit FAIL for every expected
-- check name, so errors cannot silently reduce coverage or pass the final summary.
-- JSONB variables and a transaction-local setting carry results; no tables are written.
do $audit$
declare
  v_review_pins_sql constant text := $review_pins$
review_pins(policy_md5,allow_any_md5) as (
  values ('19d78281b49a8e3e347b0536840c88d2'::text,'407da87238d42a76d764c6f273ce99a8'::text)
)
$review_pins$;
  -- Reused only within independent groups; these are the unchanged reviewed contracts.
  v_document_functions_sql constant text := $document_functions$
expected_functions(signature,source_md5,definer,volatility,language,output_names,output_types) as (
  values
    ('private.client_document_is_safe_file(text,text)','87c400a8272562ec559ad567c5e7e7e0',false,'i','sql',array[]::text[],array[]::text[]),
    ('private.client_can_read_object_document(text)','f5996b10fe63c2cf95b0af6ab2bf0f0e',true,'s','sql',array[]::text[],array[]::text[]),
    ('public.get_client_object_documents(bigint,integer)','577b3085d41abb9c20c363d76b797bb6',true,'s','plpgsql',
      array['id','object_id','title','description','mime_type','file_size','published_at','total_count'],
      array['bigint','bigint','text','text','text','bigint','timestamp with time zone','bigint']),
    ('public.get_client_object_document_file(bigint,bigint)','746258243525d291361914dab3329779',true,'s','plpgsql',
      array['storage_path','mime_type','client_title'],array['text','text','text']),
    ('public.get_management_client_document_publications(bigint,bigint[])','d93cd12ca7eb6a206049c7580490ddc4',true,'s','plpgsql',
      array['document_id','object_id','is_published','client_title','client_description','sort_order','published_at','unpublished_at','updated_at'],
      array['bigint','bigint','boolean','text','text','integer','timestamp with time zone','timestamp with time zone','timestamp with time zone']),
    ('public.set_client_object_document_publication(bigint,bigint,boolean,text,text,integer)','ab0a145c003c430439f67c9e59b1ba9b',true,'v','plpgsql',
      array['document_id','object_id','is_published','client_title','client_description','sort_order','published_at','unpublished_at','updated_at'],
      array['bigint','bigint','boolean','text','text','integer','timestamp with time zone','timestamp with time zone','timestamp with time zone'])
), functions as materialized (
  select e.*,p.oid,p.proname,p.pronamespace,p.proowner,p.prosecdef,p.proconfig,p.proacl,p.prosrc,p.provolatile,
    p.proretset,p.prorettype,p.proargnames,p.proargmodes,p.proallargtypes,p.pronargdefaults,p.proargdefaults,l.lanname
  from expected_functions e left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'
  left join pg_language l on l.oid=p.prolang
)
$document_functions$;
  v_group record;
  v_group_results jsonb;
  v_results jsonb := '[]'::jsonb;
  v_actual_check_names text[];
  v_sqlstate text;
  v_message text;
begin
  for v_group in
    select * from (values
    (1, 'reviewed_production_evidence',
      array['reviewed_production_evidence']::text[],
      'with ' || v_review_pins_sql || $check$

select 'reviewed_production_evidence',
    r.policy_md5 is not null and r.allow_any_md5 is not null
    and r.policy_md5=(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where ((p.schemaname='storage' and p.tablename='objects')
        or (p.schemaname='public' and p.tablename='object_documents'))
        and not (p.schemaname='storage' and p.policyname='client_object_documents_authenticated_get'))
    and r.allow_any_md5=(select md5(prosrc) from pg_proc where oid=to_regprocedure('storage.allow_any_operation(text[])') and prokind='f'),
    jsonb_build_object('reviewed_policy_md5',r.policy_md5,'reviewed_allow_any_md5',r.allow_any_md5),
    'FAIL until exact production evidence is reviewed and pinned in PRE and audit. Never trust an invented fingerprint.'
  from review_pins r
$check$),
    (2, 'publication_table_boundary',
      array['publication_table_boundary']::text[],
      $check$
select 'publication_table_boundary',exists (select 1 from pg_class t
    where t.oid=to_regclass('public.client_object_document_publications') and t.relkind='r' and t.relrowsecurity
    and not t.relforcerowsecurity and pg_get_userbyid(t.relowner)='postgres'
    and not exists (select 1 from pg_policy p where p.polrelid=t.oid)
    and not has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    and not has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    and not exists (select 1 from aclexplode(case when t.relacl is null then acldefault('r',t.relowner)
      when array_ndims(t.relacl)=1 then t.relacl else null::aclitem[] end) a
      where a.grantee in (0,to_regrole('anon')::oid,to_regrole('authenticated')::oid))
    and not exists (select 1 from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
      and (has_column_privilege('anon',t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')
        or has_column_privilege('authenticated',t.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')
        or exists (select 1 from aclexplode(case when array_ndims(a.attacl)=1 then a.attacl else null::aclitem[] end) acl
          where acl.grantee in (0,to_regrole('anon')::oid,to_regrole('authenticated')::oid))))),
    (select jsonb_build_object('rls',t.relrowsecurity,'owner',pg_get_userbyid(t.relowner),'acl',t.relacl::text)
      from pg_class t where t.oid=to_regclass('public.client_object_document_publications') and t.relkind='r'),
    'RPC-only publication table. All PUBLIC/anon/authenticated table and column privileges absent; no policies.'
$check$),
    (3, 'publication_columns',
      array['column:document_id','column:is_published','column:client_title','column:client_description','column:sort_order','column:published_at','column:unpublished_at','column:created_at','column:updated_at','column:created_by','column:updated_by']::text[],
      $check$
with expected_columns(name,type_name,required,default_value) as (
  values ('document_id','bigint',true,null),('is_published','boolean',true,'false'),
    ('client_title','text',true,null),('client_description','text',false,null),('sort_order','integer',true,'0'),
    ('published_at','timestamp with time zone',false,null),('unpublished_at','timestamp with time zone',false,null),
    ('created_at','timestamp with time zone',true,'now'),('updated_at','timestamp with time zone',true,'now'),
    ('created_by','uuid',false,null),('updated_by','uuid',false,null)
)
select 'column:'||e.name,coalesce(format_type(a.atttypid,a.atttypmod)=e.type_name and a.attnotnull=e.required
    and a.attidentity::text='' and a.attgenerated::text=''
    and regexp_replace(replace(pg_get_expr(d.adbin,d.adrelid),'pg_catalog.',''),'[[:space:]()]','','g')
      is not distinct from e.default_value,false),
    jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)),
    'Exact type, nullable/default contract; no duplicated object/path/name/MIME/size.'
  from expected_columns e left join pg_attribute a on a.attrelid=to_regclass('public.client_object_document_publications')
    and a.attname::text=e.name and a.attnum>0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
$check$),
    (4, 'exact_columns_constraints_and_pk',
      array['exact_columns_constraints_and_pk']::text[],
      $check$
select 'exact_columns_constraints_and_pk',
    (select count(*)=11 from pg_attribute where attrelid=to_regclass('public.client_object_document_publications') and attnum>0 and not attisdropped)
    and (select count(*)=8 from pg_constraint where conrelid=to_regclass('public.client_object_document_publications') and contype<>'n')
    and exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      where c.conrelid=to_regclass('public.client_object_document_publications') and c.contype='p'
        and cardinality(c.conkey)=1 and a.attname='document_id' and c.convalidated and not c.condeferrable),
    '{}'::jsonb,'One source document -> one publication; 1 PK + 3 FKs + 4 CHECKs. No sequence or binary copy.'
$check$),
    (5, 'publication_foreign_keys',
      array['foreign_key:document_id','foreign_key:created_by','foreign_key:updated_by']::text[],
      $check$
with expected_fks(column_name,target,delete_action) as (
  values ('document_id','public.object_documents','c'),('created_by','auth.users','n'),('updated_by','auth.users','n')
)
select 'foreign_key:'||e.column_name,exists (select 1 from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
    where c.conrelid=to_regclass('public.client_object_document_publications') and c.contype='f'
      and c.confrelid=to_regclass(e.target) and cardinality(c.conkey)=1 and cardinality(c.confkey)=1
      and a.attname::text=e.column_name and b.attname='id' and c.confdeltype::text=e.delete_action
      and c.confupdtype='a' and c.convalidated and not c.condeferrable),
    jsonb_build_object('target',e.target,'delete_action',e.delete_action),
    'Original deletion cascades only into publication; actor deletion SET NULL. Never deletes a source document/object.'
  from expected_fks e
$check$),
    (6, 'publication_check_constraints',
      array['constraint:client_document_title_check','constraint:client_document_description_check','constraint:client_document_order_check','constraint:client_document_published_check']::text[],
      $check$
with expected_constraints(name,normalized_expression) as (
  values ('client_document_title_check','client_title=btrimclient_titleandlengthclient_title>=1andlengthclient_title<=150'),
    ('client_document_description_check','client_descriptionisnullorclient_description=btrimclient_descriptionandlengthclient_description>=1andlengthclient_description<=1000'),
    ('client_document_order_check','sort_order>=0'),
    ('client_document_published_check','notis_publishedorpublished_atisnotnull')
)
select 'constraint:'||e.name,coalesce(c.convalidated and
    regexp_replace(replace(replace(lower(pg_get_expr(c.conbin,c.conrelid)),'::text',''),'pg_catalog.',''),
      '[[:space:]()]','','g')=e.normalized_expression,false),
    jsonb_build_object('definition',pg_get_constraintdef(c.oid,true),'expected',e.normalized_expression),
    'Explicit trimmed title 1..150, optional trimmed description 1..1000, nonnegative order, published timestamp.'
  from expected_constraints e left join pg_constraint c on c.conrelid=to_regclass('public.client_object_document_publications')
    and c.contype='c' and c.conname::text=e.name
$check$),
    (7, 'document_functions',
      array['function:private.client_document_is_safe_file(text,text)','function:private.client_can_read_object_document(text)','function:public.get_client_object_documents(bigint,integer)','function:public.get_client_object_document_file(bigint,bigint)','function:public.get_management_client_document_publications(bigint,bigint[])','function:public.set_client_object_document_publication(bigint,bigint,boolean,text,text,integer)']::text[],
      'with ' || v_document_functions_sql || $check$

select 'function:'||f.signature,coalesce(f.oid is not null and f.prosecdef=f.definer
    and pg_get_userbyid(f.proowner)='postgres' and f.proconfig=array['search_path=""']
    and f.provolatile::text=f.volatility and f.lanname::text=f.language and md5(f.prosrc)=f.source_md5
    and has_function_privilege('authenticated',f.oid,'EXECUTE') and not has_function_privilege('anon',f.oid,'EXECUTE')
    and not exists (select 1 from aclexplode(case when f.proacl is null then acldefault('f',f.proowner)
      when array_ndims(f.proacl)=1 then f.proacl else null::aclitem[] end) a
      where a.grantee=0 or (a.grantee=to_regrole('authenticated')::oid and a.is_grantable))
    and (case when cardinality(f.output_names)=0 then not f.proretset and f.prorettype='boolean'::regtype else f.proretset end)
    and array(select f.proargnames[i] from generate_subscripts(f.proallargtypes,1) i where f.proargmodes[i]='t')=f.output_names
    and array(select format_type(f.proallargtypes[i],null) from generate_subscripts(f.proallargtypes,1) i where f.proargmodes[i]='t')=f.output_types
    and case when f.signature='public.get_client_object_documents(bigint,integer)'
      then f.pronargdefaults=1 and pg_get_expr(f.proargdefaults,0)='1' else f.pronargdefaults=0 end,false),
    jsonb_build_object('md5',md5(f.prosrc),'expected',f.source_md5,'config',f.proconfig,'acl',f.proacl::text,'returns',pg_get_function_result(f.oid)),
    'Exact body/return signature/owner/config/ACL. Body pins active identity/live grant, readiness, publication, safe file, pagination and locks.'
  from functions f
$check$),
    (8, 'no_extra_document_function_overloads',
      array['no_extra_document_function_overloads']::text[],
      'with ' || v_document_functions_sql || $check$

select 'no_extra_document_function_overloads',(select count(*)=6 from pg_proc p
    where (p.pronamespace,p.proname) in (select f.pronamespace,f.proname from functions f)),
    '{}'::jsonb,'No unreviewed overload under a new document RPC/helper name.'
$check$),
    (9, 'client_storage_policy',
      array['client_storage_policy']::text[],
      $check$
with client_policy as materialized (
  select p.*,regexp_replace(replace(replace(replace(coalesce(p.qual,''),'::text[]',''),'::text',''),'objects.',''),
    '[[:space:]()]','','g') as normalized_qual
  from pg_policies p where p.schemaname='storage' and p.tablename='objects' and p.policyname='client_object_documents_authenticated_get'
)
select 'client_storage_policy',exists (select 1 from client_policy p where p.cmd='SELECT' and p.permissive='PERMISSIVE'
    and p.roles=array['authenticated'::name] and p.with_check is null
    and p.normalized_qual=$expr$bucket_id='object-documents'ANDstorage.allow_any_operationARRAY['object.get_authenticated_info','object.get_authenticated']ANDprivate.client_document_is_safe_filename,metadata->>'mimetype'ANDprivate.client_can_read_object_documentname$expr$),
    (select jsonb_build_object('roles',roles,'command',cmd,'mode',permissive,'using',qual,'normalized',normalized_qual) from client_policy),
    'Exact bucket, info+GET pair, current-row MIME/path predicate and live authorization. Missing/extra operations, guards or roles fail.'
$check$),
    (10, 'private_document_bucket',
      array['private_document_bucket']::text[],
      $check$
select 'private_document_bucket',exists (select 1 from storage.buckets where id='object-documents' and public=false
    and file_size_limit=26214400 and (select array_agg(m order by m) from unnest(allowed_mime_types) m)=array[
      'application/csv','application/msword','application/pdf','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg','image/png','image/webp','text/csv','text/plain']::text[]),
    (select jsonb_build_object('id',id,'public',public,'limit',file_size_limit,'mime_types',allowed_mime_types) from storage.buckets where id='object-documents'),
    'Private, 25 MiB and exact MIME set; no files enumerated.'
$check$),
    (11, 'original_contracts_preserved',
      array['original_contracts_preserved']::text[],
      'with ' || v_review_pins_sql || $check$
,
-- PRESERVATION BASELINE BEGIN: identical catalog query to PRE.
preserved_functions as materialized (
  select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and (
    (n.nspname='private' and p.proname in ('is_active_user','has_role','is_active_client','client_has_object_access',
      'client_photo_is_safe_raster','client_can_read_object_photo','legacy_internal_signup_enabled','guard_application_identity'))
    or (n.nspname='public' and p.proname in ('get_application_identity','handle_new_user','get_client_objects','get_client_object',
      'get_client_object_progress','get_management_client_object_progress','save_client_object_progress',
      'get_client_object_photos','get_client_object_photo_file','get_management_client_photo_publications','set_client_object_photo_publication'))
    or (n.nspname='storage' and p.proname in ('operation','allow_only_operation','allow_any_operation')))
), preserved_relations as materialized (
  select c.* from pg_class c where c.oid in (to_regclass('public.object_documents'),to_regclass('storage.objects'),
    to_regclass('public.object_photos'),to_regclass('public.client_object_photo_publications')) and c.relkind='r'
), preservation as (
  select jsonb_build_object('version','client-portal-1.0c2b:v1',
    'policies', (select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where ((p.schemaname='storage' and p.tablename='objects')
        or (p.schemaname='public' and p.tablename in ('object_documents','object_photos','client_object_photo_publications')))
        and not (p.schemaname='storage' and p.policyname='client_object_documents_authenticated_get')),
    'functions',(select md5(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner))
      order by p.oid::regprocedure::text)::text) from preserved_functions p),
    'relations',(select md5(jsonb_agg(jsonb_build_object('relation',c.oid::regclass::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
      'columns',(select jsonb_agg(jsonb_build_object('name',a.attname::text,'type',format_type(a.atttypid,a.atttypmod),
        'not_null',a.attnotnull,'identity',a.attidentity::text,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
        from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints',(select jsonb_agg(jsonb_build_object('name',k.conname::text,'definition',pg_get_constraintdef(k.oid),
        'validated',k.convalidated) order by k.conname::text) from pg_constraint k where k.conrelid=c.oid),
      'triggers',(select jsonb_agg(jsonb_build_object('name',t.tgname::text,'enabled',t.tgenabled::text,
        'definition',pg_get_triggerdef(t.oid,true)) order by t.tgname::text) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal))
      order by c.oid::regclass::text)::text) from preserved_relations c),
    'buckets',(select md5(jsonb_agg(jsonb_build_object('id',b.id,'public',b.public,'file_size_limit',b.file_size_limit,
      'allowed_mime_types',b.allowed_mime_types) order by b.id)::text) from storage.buckets b where b.id in ('object-documents','object-photos'))
  ) as fingerprint
)
-- PRESERVATION BASELINE END
select 'original_contracts_preserved',coalesce(obj_description(to_regclass('public.client_object_document_publications'),'pg_class')=
    (p.fingerprint||jsonb_build_object('reviewed_policy_md5',r.policy_md5,'reviewed_allow_any_md5',r.allow_any_md5))::text,false),
    jsonb_build_object('current',p.fingerprint,'recorded',obj_description(to_regclass('public.client_object_document_publications'),'pg_class')),
    'Exact BEFORE catalog baseline, never refreshed to hide drift: ALL old Storage/document/photo policies, schemas/ACLs, buckets, identity/progress/photo functions and ACLs. Includes final Photos hotfix. New unrelated client paths fail.'
  from preservation p cross join review_pins r
$check$),
    (12, 'verified_existing_helpers',
      array['verified_helper:private.is_active_user()','verified_helper:private.has_role(text[])','verified_helper:private.is_active_client()','verified_helper:private.client_has_object_access(bigint)','verified_helper:storage.allow_only_operation(text)','verified_helper:storage.operation()','verified_helper:private.client_photo_is_safe_raster(text,text)','verified_helper:private.client_can_read_object_photo(text)','verified_helper:public.get_client_object_photos(bigint,integer)','verified_helper:public.get_client_object_photo_file(bigint,bigint)','verified_helper:public.get_management_client_photo_publications(bigint,bigint[])','verified_helper:public.set_client_object_photo_publication(bigint,bigint,boolean,text,integer)']::text[],
      $check$
with verified_helpers(signature,hash) as (
  values ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1'),
    ('private.has_role(text[])','53ee6011008695bf5bba95283f571979'),
    ('private.is_active_client()','b220a9950bb96f0f6bd817af5fa20e41'),
    ('private.client_has_object_access(bigint)','a94f372e167d6a9d30ab7db3ff2c698f'),
    ('storage.allow_only_operation(text)','8682c6d323bc2e01e70abf92f4ae85f6'),
    ('storage.operation()','a9b2cc8c1b536867e48f86d3455d4704'),
    ('private.client_photo_is_safe_raster(text,text)','c6d4c2bdf2144d11830096d188dbcc44'),
    ('private.client_can_read_object_photo(text)','42c895b81e36b2a8c46e3621d5bed408'),
    ('public.get_client_object_photos(bigint,integer)','a98f41e73eb71faaa0f40880b5a72d02'),
    ('public.get_client_object_photo_file(bigint,bigint)','d549ad0aca586fe34fef2dc38b733436'),
    ('public.get_management_client_photo_publications(bigint,bigint[])','a89b3288abb08e97b89377ad39b9e6bb'),
    ('public.set_client_object_photo_publication(bigint,bigint,boolean,text,integer)','432adbcbff14ec410d1724ee175a5cb5')
)
select 'verified_helper:'||e.signature,coalesce(md5(p.prosrc)=e.hash,false),
    jsonb_build_object('md5',md5(p.prosrc),'expected',e.hash),'Verified pre-existing helper body; never redefined by Documents.'
  from verified_helpers e left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'
$check$),
    (13, 'definer_storage_metadata_access',
      array['definer_storage_metadata_access']::text[],
      $check$
select 'definer_storage_metadata_access',exists (select 1 from pg_roles r where r.rolname='postgres'
    and (r.rolsuper or r.rolbypassrls) and has_schema_privilege(r.oid,'storage','USAGE')
    and has_table_privilege(r.oid,to_regclass('storage.objects'),'SELECT')),
    '{}'::jsonb,'All new DEFINER owners separately pinned to postgres; Storage metadata reads require proven bypass and SELECT.'
$check$),
    (14, 'storage_rls_and_helper_execution',
      array['storage_rls_and_helper_execution']::text[],
      $check$
select 'storage_rls_and_helper_execution',
    exists (select 1 from pg_class where oid=to_regclass('storage.objects') and relrowsecurity)
    and has_schema_privilege('authenticated','storage','USAGE') and has_schema_privilege('authenticated','private','USAGE')
    and coalesce(has_function_privilege('authenticated',to_regprocedure('storage.allow_any_operation(text[])'),'EXECUTE'),false)
    and coalesce(has_function_privilege('authenticated',to_regprocedure('storage.operation()'),'EXECUTE'),false),
    '{}'::jsonb,'Storage RLS and operation evaluation remain enabled. This does not simulate Storage request context.'
$check$),
    (15, 'no_storage_policy_self_reference',
      array['no_storage_policy_self_reference']::text[],
      'with ' || v_document_functions_sql || $check$

select 'no_storage_policy_self_reference',coalesce((select count(*)=2 and bool_and(md5(f.prosrc)=f.source_md5
    and f.prosrc !~* 'storage[[:space:]]*[.][[:space:]]*objects') from functions f
    where f.signature in ('private.client_document_is_safe_file(text,text)','private.client_can_read_object_document(text)')),false),
    '{}'::jsonb,'Pure file predicate and narrow publication helper never query storage.objects from its own RLS path.'
$check$),
    (16, 'existing_grant_helper_not_broadened',
      array['existing_grant_helper_not_broadened']::text[],
      $check$
select 'existing_grant_helper_not_broadened',coalesce(
    not has_function_privilege('authenticated',to_regprocedure('private.client_has_object_access(bigint)'),'EXECUTE')
    and not has_function_privilege('anon',to_regprocedure('private.client_has_object_access(bigint)'),'EXECUTE'),false),
    '{}'::jsonb,'No new direct EXECUTE on the existing grant helper. Exact prior ACL additionally preserved in baseline.'
$check$)
    ) as audit_groups(group_order,group_name,check_names,query_text)
    order by group_order
  loop
    begin
      -- All query_text values are fixed SELECTs in this file, never external input.
      execute $collect$
        select coalesce(jsonb_agg(jsonb_build_object(
          'check_name',audit_row.check_name,
          'status',case when coalesce(audit_row.matches,false) then 'PASS' else 'FAIL' end,
          'evidence',audit_row.evidence,
          'notes',audit_row.notes
        ) order by audit_row.check_name),'[]'::jsonb)
        from (
      $collect$ || v_group.query_text || $collect$
        ) as audit_row(check_name,matches,evidence,notes)
      $collect$
      into v_group_results;

      -- Missing/duplicate result rows are failures, not successful skipped checks.
      select array_agg(r.check_name order by r.check_name)
      into v_actual_check_names
      from jsonb_to_recordset(v_group_results) as r(check_name text);
      if v_actual_check_names is distinct from
        array(select c.check_name from unnest(v_group.check_names) as c(check_name) order by c.check_name)
      then
        raise exception using errcode='P0001',message='Audit group returned unexpected check names or count.';
      end if;
    exception when others then
      get stacked diagnostics v_sqlstate=returned_sqlstate,v_message=message_text;
      select jsonb_agg(jsonb_build_object(
        'check_name',c.check_name,
        'status','FAIL',
        'evidence',jsonb_build_object('group',v_group.group_name,'sqlstate',v_sqlstate,'message',v_message),
        'notes','Isolated audit group raised an SQL error; this check could not be verified. Other groups continue.'
      ) order by c.check_name)
      into v_group_results
      from unnest(v_group.check_names) as c(check_name);
    end;
    v_results := v_results || v_group_results;
  end loop;

  perform set_config('vicourt.client_portal_1_0c2b_audit_results',v_results::text,true);
end;
$audit$;

-- This final query reads only the completed JSONB results, not the catalog checks.
with checks as (
  select r.*
  from jsonb_to_recordset(current_setting('vicourt.client_portal_1_0c2b_audit_results')::jsonb)
    as r(check_name text,status text,evidence jsonb,notes text)
), results as (
  select check_name,status,evidence,notes,0 as summary_order from checks
  union all
  select 'CLIENT_PORTAL_1_0C2B_STRUCTURAL_SUMMARY',case when bool_and(status='PASS') then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'failed',count(*) filter(where status<>'PASS'),
      'runtime_authorization_tested',false,'requires_storage_session_smoke',true),
    'Structural only, NOT runtime authorization PASS. Smoke admin/manager/worker, assigned/unassigned/inactive/revoked clients, unready/unpublished/unsafe files, both GET operations, and denied list/sign/write. No application RPC executed.',1
  from checks
)
select check_name,status,evidence,notes from results order by summary_order,check_name;
commit;
