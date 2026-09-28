-- Client Portal 1.0C2d file-reference hotfix: supplemental structural audit.
-- Supersedes ONLY C2b's old file-RPC ACL expectation; historical audit is unchanged.
-- No application helper/RPC execution, auth/business rows or stored file enumeration.
-- Catalog fingerprints are not a substitute for real client/Storage session smoke.
begin;
set transaction read only;
set local search_path = pg_catalog;

do $audit$
declare
  v_check record;
  v_ok boolean;
  v_results jsonb := '[]'::jsonb;
  v_evidence jsonb;
  v_state text;
  v_message text;
begin
  -- Independent planning/execution: an error names its exact failed check.
  for v_check in select * from (values
    (1, 'reviewed_dependency_bodies', $check$
select not exists (
  select 1 from (values
    ('private.is_active_client()','b220a9950bb96f0f6bd817af5fa20e41'),
    ('private.client_has_object_access(bigint)','a94f372e167d6a9d30ab7db3ff2c698f'),
    ('private.client_document_is_safe_file(text,text)','87c400a8272562ec559ad567c5e7e7e0'),
    ('private.client_can_read_object_document(text)','f5996b10fe63c2cf95b0af6ab2bf0f0e'),
    ('public.get_client_object_documents(bigint,integer)','577b3085d41abb9c20c363d76b797bb6'),
    ('public.get_client_object_document_file(bigint,bigint)','746258243525d291361914dab3329779'),
    ('public.get_management_client_document_publications(bigint,bigint[])','d93cd12ca7eb6a206049c7580490ddc4'),
    ('public.set_client_object_document_publication(bigint,bigint,boolean,text,text,integer)','ab0a145c003c430439f67c9e59b1ba9b'),
    ('storage.allow_any_operation(text[])','407da87238d42a76d764c6f273ce99a8'),
    ('storage.operation()','a9b2cc8c1b536867e48f86d3455d4704')
  ) e(signature,hash)
  left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'
  where p.oid is null or md5(p.prosrc)<>e.hash
)
$check$),
    (2, 'finalized_identity_gate', $check$
select exists (
  select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('private.legacy_internal_signup_enabled()') and p.prokind='f'
    and pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef and l.lanname='sql'
    and p.provolatile='s' and p.proconfig=array['search_path=""']::text[]
    and p.prorettype='boolean'::regtype and not p.proretset and p.pronargs=0
    and p.prosrc='select false'
)
$check$),
    (3, 'definer_storage_access', $check$
select exists (
  select 1 from pg_roles where rolname='postgres' and (rolsuper or rolbypassrls)
) and has_schema_privilege('postgres','storage','USAGE')
  and has_table_privilege('postgres','storage.objects','SELECT')
  and has_schema_privilege('postgres','auth','USAGE')
  and has_schema_privilege('postgres','public','USAGE')
  and has_table_privilege('postgres','auth.users','SELECT')
  and has_table_privilege('postgres','public.client_profiles','SELECT')
  and has_table_privilege('postgres','public.profiles','SELECT')
  and has_table_privilege('postgres','public.client_object_access','SELECT')
  and has_table_privilege('postgres','public.object_documents','SELECT')
  and has_table_privilege('postgres','public.client_object_document_publications','SELECT')
$check$),
    (4, 'original_internal_policies', $check$
select '19d78281b49a8e3e347b0536840c88d2'=
  md5(coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
from pg_policies p where ((p.schemaname='storage' and p.tablename='objects')
  or (p.schemaname='public' and p.tablename='object_documents'))
  and not (p.schemaname='storage' and p.policyname='client_object_documents_authenticated_get')
$check$),
    (5, 'exact_client_storage_policy', $check$
select exists (
  select 1 from pg_policies p where p.schemaname='storage' and p.tablename='objects'
    and p.policyname='client_object_documents_authenticated_get'
    and p.cmd='SELECT' and p.permissive='PERMISSIVE' and p.roles=array['authenticated'::name]
    and p.with_check is null
    and regexp_replace(replace(replace(replace(p.qual,'::text[]',''),'::text',''),'objects.',''),'[[:space:]()]','','g')
      =$expr$bucket_id='object-documents'ANDstorage.allow_any_operationARRAY['object.get_authenticated_info','object.get_authenticated']ANDprivate.client_document_is_safe_filename,metadata->>'mimetype'ANDprivate.client_can_read_object_documentname$expr$
)
$check$),
    (6, 'storage_rls_prerequisites', $check$
select exists (
  select 1 from pg_class where oid=to_regclass('storage.objects') and relkind='r' and relrowsecurity
) and has_schema_privilege('authenticated','storage','USAGE')
  and has_schema_privilege('authenticated','private','USAGE')
  and has_table_privilege('authenticated','storage.objects','SELECT')
  and has_function_privilege('authenticated','storage.allow_any_operation(text[])','EXECUTE')
  and has_function_privilege('authenticated','storage.operation()','EXECUTE')
  and has_function_privilege('authenticated','private.client_document_is_safe_file(text,text)','EXECUTE')
  and has_function_privilege('authenticated','private.client_can_read_object_document(text)','EXECUTE')
  and not has_function_privilege('authenticated','private.client_has_object_access(bigint)','EXECUTE')
  and not has_function_privilege('anon','private.client_has_object_access(bigint)','EXECUTE')
$check$),
    (7, 'private_bucket', $check$
select exists (
  select 1 from storage.buckets where id='object-documents' and public=false and file_size_limit=26214400
    and (select array_agg(m order by m) from unnest(allowed_mime_types) m)=array[
      'application/csv','application/msword','application/pdf','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg','image/png','image/webp','text/csv','text/plain']::text[]
)
$check$),
    (8, 'file_function_signatures', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('get_client_object_document_file','get_client_object_document_file_server'))=2
  and to_regprocedure('public.get_client_object_document_file(bigint,bigint)') is not null
  and to_regprocedure('public.get_client_object_document_file_server(uuid,bigint,bigint)') is not null
$check$),
    (9, 'old_file_execute_denied', $check$
select exists (
  select 1 from pg_proc p where p.oid=to_regprocedure('public.get_client_object_document_file(bigint,bigint)') and p.prokind='f'
    and pg_get_userbyid(p.proowner)='postgres'
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE')
    and not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee<>p.proowner or a.is_grantable)
)
$check$),
    (10, 'server_resolver_execute_service_only', $check$
select exists (
  select 1 from pg_proc p where p.oid=to_regprocedure('public.get_client_object_document_file_server(uuid,bigint,bigint)') and p.prokind='f'
    and has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in (p.proowner,to_regrole('service_role')::oid) or a.is_grantable)
)
$check$),
    (11, 'server_resolver_exact_definition', $check$
select exists (
  select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_client_object_document_file_server(uuid,bigint,bigint)')
    and p.prokind='f' and pg_get_userbyid(p.proowner)='postgres'
    and p.prosecdef and p.proconfig=array['search_path=""']::text[]
    and p.provolatile='s' and not p.proisstrict and not p.proleakproof and p.proparallel='u'
    and l.lanname='plpgsql' and p.proretset and p.prorettype='record'::regtype
    and p.pronargs=3 and p.pronargdefaults=0 and p.proargdefaults is null
    and p.proargnames=array['p_client_user_id','p_object_id','p_document_id','storage_path','mime_type','client_title']::text[]
    and p.proargmodes=array['i','i','i','t','t','t']::"char"[]
    and p.proallargtypes=array['uuid'::regtype::oid,'bigint'::regtype::oid,'bigint'::regtype::oid,
      'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid]
    and md5(p.prosrc)='12e5769e8ba312309b0fbf51134463c5'
)
$check$),
    (12, 'preserved_contracts', $check$
select obj_description(to_regprocedure('public.get_client_object_document_file_server(uuid,bigint,bigint)'),'pg_proc')
  is not null and obj_description(to_regprocedure('public.get_client_object_document_file_server(uuid,bigint,bigint)'),'pg_proc')=snapshot::text
from (
-- HOTFIX PRESERVATION BEGIN: identical deploy/audit query; excludes ONLY changed file ACL/new resolver.
select jsonb_build_object(
  'version','client-document-file-hotfix:v1',
  'functions',(select md5(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),
    'acl',case when p.oid=to_regprocedure('public.get_client_object_document_file(bigint,bigint)') then null else p.proacl::text end)
    order by p.oid::regprocedure::text)::text)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (
      (n.nspname='private' and p.proname in ('is_active_user','has_role','is_active_client','client_has_object_access',
        'legacy_internal_signup_enabled','guard_application_identity','client_document_is_safe_file','client_can_read_object_document',
        'client_photo_is_safe_raster','client_can_read_object_photo'))
      or (n.nspname='public' and p.proname in ('get_application_identity','handle_new_user','get_client_objects','get_client_object',
        'get_client_object_progress','get_client_object_photos','get_client_object_photo_file',
        'get_client_object_documents','get_client_object_document_file',
        'get_management_client_document_publications','set_client_object_document_publication'))
      or (n.nspname='storage' and p.proname in ('allow_any_operation','allow_only_operation','operation')))),
  'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
    from pg_policies p where (p.schemaname='storage' and p.tablename='objects')
      or (p.schemaname='public' and p.tablename in ('object_documents','client_object_document_publications'))),
  'relations',(select md5(jsonb_agg(jsonb_build_object(
    'name',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'acl',a.attacl::text,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_constraint k where k.conrelid=c.oid),
    'triggers',(select jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)
      order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal))
    order by c.oid::regclass::text)::text)
    from pg_class c where c.oid in (to_regclass('public.object_documents'),
      to_regclass('public.client_object_document_publications'),to_regclass('storage.objects')) and c.relkind='r'),
  'foundation_baseline',obj_description(to_regclass('public.client_object_document_publications'),'pg_class')
)
-- HOTFIX PRESERVATION END
) b(snapshot)
$check$)
  ) c(ordinal,check_name,query) order by ordinal loop
    begin
      v_ok := null;
      execute v_check.query into v_ok;
      v_evidence := jsonb_build_object('matched',coalesce(v_ok,false));
      if v_check.check_name in ('old_file_execute_denied','server_resolver_execute_service_only','server_resolver_exact_definition') then
        select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
          'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,
          'raw_acl',p.proacl::text,'source_md5',md5(p.prosrc),'result',pg_get_function_result(p.oid),
          'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
          'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
          'service_role_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
          'public_execute',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0))
          order by p.oid::regprocedure::text) into v_evidence
        from pg_proc p where p.prokind='f' and p.oid in (
          to_regprocedure('public.get_client_object_document_file(bigint,bigint)'),
          to_regprocedure('public.get_client_object_document_file_server(uuid,bigint,bigint)'));
      end if;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'check_name',v_check.check_name,'status',case when coalesce(v_ok,false) then 'PASS' else 'FAIL' end,
        'evidence',v_evidence,'notes','Structural only; no client authorization or Storage request executed.'));
    exception when others then
      get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'check_name',v_check.check_name,'status','FAIL',
        'evidence',jsonb_build_object('sqlstate',v_state,'message',v_message),
        'notes','Unexpected catalog inspection error in this isolated check; never skipped.'));
    end;
  end loop;
  perform set_config('vicourt.client_document_file_hotfix_audit',v_results::text,true);
end
$audit$;

with checks as (
  select * from jsonb_to_recordset(current_setting('vicourt.client_document_file_hotfix_audit')::jsonb)
    as r(check_name text,status text,evidence jsonb,notes text)
), output as (
  select check_name,status,evidence,notes,0 as summary_order from checks
  union all
  select 'CLIENT_PORTAL_1_0C2D_FILE_HOTFIX_STRUCTURAL_SUMMARY',
    case when count(*)=12 and bool_and(status='PASS') then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'failed',count(*) filter(where status<>'PASS'),'expected_checks',12,
      'runtime_authorization_tested',false,'requires_storage_session_smoke',true),
    'Smoke both file RPCs denied for browser JWT; same-origin assigned client download; unassigned/cross-object/inactive/internal/dual/revoked/unpublished/unready/unsafe denied; revoke between lookup/download denied by USER Storage; list/sign/write remain denied.',1
  from checks
)
select check_name,status,evidence,notes from output order by summary_order,check_name;
commit;
