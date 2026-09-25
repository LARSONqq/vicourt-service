-- Client Portal 1.0C2b: additive Documents foundation. No UI and no backfill.
-- Existing policy and Storage-helper fingerprints are pinned from the
-- reviewed catalog-only production discovery.
-- Existing internal policy definitions are NOT present in repository source.
-- Manual transaction as postgres -> structural audit -> future app UI -> smoke.
begin;
set local search_path = pg_catalog;

do $preflight$
declare
-- Production fingerprints pinned from reviewed catalog-only discovery.
  v_reviewed_policy_md5 constant text := '19d78281b49a8e3e347b0536840c88d2';
  v_reviewed_allow_any_md5 constant text := '407da87238d42a76d764c6f273ce99a8';
  v_policy_md5 text;
  v_baseline jsonb;
  v_existing text;
  v_signature text;
begin
  if current_user <> 'postgres' then raise exception 'Run document PRE as postgres.'; end if;
  if v_reviewed_policy_md5 is null or v_reviewed_allow_any_md5 is null then
    raise exception 'BLOCKED: exact reviewed production policy and allow_any_operation fingerprints are required before execution.';
  end if;
  if not exists (select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
    or not has_schema_privilege(current_user,'storage','USAGE')
    or not has_table_privilege(current_user,'storage.objects','SELECT')
  then raise exception 'Document RPC owner requires proven Storage SELECT and BYPASSRLS/superuser.'; end if;
  if not exists (select 1 from pg_class where oid=to_regclass('public.object_documents') and relkind='r' and relrowsecurity)
    or not exists (select 1 from pg_class where oid=to_regclass('storage.objects') and relkind='r' and relrowsecurity)
  then raise exception 'Reviewed document and Storage RLS tables required.'; end if;
  if (select count(*) from pg_attribute where attrelid='public.object_documents'::regclass and attnum>0 and not attisdropped)<>14
    or exists (select 1 from (values
      ('id','bigint'),('object_id','bigint'),('title','text'),('category','text'),('access_level','text'),
      ('original_file_name','text'),('storage_path','text'),('mime_type','text'),('file_size','bigint'),
      ('note','text'),('created_by','uuid'),('is_ready','boolean'),
      ('created_at','timestamp with time zone'),('updated_at','timestamp with time zone')
    ) e(name,type_name) left join pg_attribute a on a.attrelid='public.object_documents'::regclass
      and a.attname::text=e.name and a.attnum>0 and not a.attisdropped
      where a.attnum is null or format_type(a.atttypid,a.atttypmod)<>e.type_name)
  then raise exception 'Document column contract differs from reviewed discovery.'; end if;
  if not exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.conrelid='public.object_documents'::regclass and c.contype='p' and cardinality(c.conkey)=1
      and a.attname='id' and c.convalidated)
    or not exists (select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
      where i.indrelid='public.object_documents'::regclass and a.attname='storage_path'
        and i.indisunique and i.indisvalid and i.indisready and i.indnkeyatts=1 and i.indpred is null and i.indexprs is null)
    or not exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
      where c.conrelid='public.object_documents'::regclass and c.contype='f' and c.convalidated
        and cardinality(c.conkey)=1 and a.attname='object_id' and b.attname='id' and c.confrelid=to_regclass('public.objects'))
  then raise exception 'Reviewed document PK, object FK and globally unique storage path required.'; end if;
  if not exists (select 1 from storage.buckets where id='object-documents' and public=false and file_size_limit=26214400
    and (select array_agg(m order by m) from unnest(allowed_mime_types) m)=array[
      'application/csv','application/msword','application/pdf','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg','image/png','image/webp','text/csv','text/plain']::text[])
  then raise exception 'Private 25 MiB document bucket with exact supported MIME allowlist required.'; end if;
  if exists (select 1 from (values ('name','text'),('bucket_id','text'),('metadata','jsonb')) e(name,type_name)
    left join pg_attribute a on a.attrelid='storage.objects'::regclass and a.attname::text=e.name
      and a.attnum>0 and not a.attisdropped where a.attnum is null or format_type(a.atttypid,a.atttypmod)<>e.type_name)
  then raise exception 'Storage metadata contract differs.'; end if;
  if exists (select 1 from (values
    ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1'),
    ('private.has_role(text[])','53ee6011008695bf5bba95283f571979'),
    ('private.is_active_client()','b220a9950bb96f0f6bd817af5fa20e41'),
    ('private.client_has_object_access(bigint)','a94f372e167d6a9d30ab7db3ff2c698f'),
    ('storage.allow_only_operation(text)','8682c6d323bc2e01e70abf92f4ae85f6'),
    ('storage.operation()','a9b2cc8c1b536867e48f86d3455d4704'),
    ('storage.allow_any_operation(text[])',v_reviewed_allow_any_md5),
    ('private.client_photo_is_safe_raster(text,text)','c6d4c2bdf2144d11830096d188dbcc44'),
    ('private.client_can_read_object_photo(text)','42c895b81e36b2a8c46e3621d5bed408'),
    ('public.get_client_object_photos(bigint,integer)','a98f41e73eb71faaa0f40880b5a72d02'),
    ('public.get_client_object_photo_file(bigint,bigint)','d549ad0aca586fe34fef2dc38b733436'),
    ('public.get_management_client_photo_publications(bigint,bigint[])','a89b3288abb08e97b89377ad39b9e6bb'),
    ('public.set_client_object_photo_publication(bigint,bigint,boolean,text,integer)','432adbcbff14ec410d1724ee175a5cb5')
  ) e(signature,hash) left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'
    where p.oid is null or md5(p.prosrc)<>e.hash)
  then raise exception 'Reviewed identity/Storage/photo helper fingerprint mismatch.'; end if;
  foreach v_signature in array array['private.is_active_user()','private.has_role(text[])',
    'private.is_active_client()','private.client_has_object_access(bigint)'] loop
    if not exists (select 1 from pg_proc p where p.oid=to_regprocedure(v_signature) and p.prosecdef
      and pg_get_userbyid(p.proowner)='postgres' and p.proconfig=array['search_path=""'])
    then raise exception 'Required canonical identity helper drifted: %',v_signature; end if;
  end loop;
  if has_function_privilege('authenticated','private.client_has_object_access(bigint)','EXECUTE')
    or has_function_privilege('anon','private.client_has_object_access(bigint)','EXECUTE')
  then raise exception 'Existing grant helper must remain non-API-executable.'; end if;
  foreach v_signature in array array['storage.operation()','storage.allow_only_operation(text)','storage.allow_any_operation(text[])',
    'private.is_active_user()','private.has_role(text[])','private.is_active_client()'] loop
    if not has_function_privilege('authenticated',v_signature,'EXECUTE')
    then raise exception 'Required helper EXECUTE missing: %',v_signature; end if;
  end loop;
  if not has_schema_privilege('authenticated','storage','USAGE') or not has_schema_privilege('authenticated','private','USAGE')
  then raise exception 'Existing schema USAGE required.'; end if;

  select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)::text,'[]')) into v_policy_md5
  from pg_policies p where ((p.schemaname='storage' and p.tablename='objects')
    or (p.schemaname='public' and p.tablename='object_documents'))
    and not (p.schemaname='storage' and p.policyname='client_object_documents_authenticated_get');
  if v_policy_md5<>v_reviewed_policy_md5 then raise exception 'Reviewed original document/Storage policies drifted.'; end if;
  -- Do not replace existing policy bodies, including UPDATE/DELETE or unrelated buckets.
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='object_documents_storage_select' and cmd='SELECT')
  then raise exception 'Discovered internal document Storage SELECT policy missing.'; end if;

  -- PRESERVATION BASELINE BEGIN: shared verbatim with the read-only audit.
  with preserved_functions as materialized (
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
  select fingerprint into v_baseline from preservation;
  v_baseline := v_baseline || jsonb_build_object('reviewed_policy_md5',v_reviewed_policy_md5,'reviewed_allow_any_md5',v_reviewed_allow_any_md5);
  if to_regclass('public.client_object_document_publications') is not null then
    v_existing := obj_description(to_regclass('public.client_object_document_publications'),'pg_class');
    if v_existing is distinct from v_baseline::text then raise exception 'Existing document baseline missing/drifted; review before rerun.'; end if;
  end if;
  if exists (select 1 from pg_proc p where p.oid in (
    to_regprocedure('private.client_document_is_safe_file(text,text)'),to_regprocedure('private.client_can_read_object_document(text)'),
    to_regprocedure('public.get_client_object_documents(bigint,integer)'),to_regprocedure('public.get_client_object_document_file(bigint,bigint)'),
    to_regprocedure('public.get_management_client_document_publications(bigint,bigint[])'),
    to_regprocedure('public.set_client_object_document_publication(bigint,bigint,boolean,text,text,integer)'))
    and pg_get_userbyid(p.proowner)<>'postgres')
  then raise exception 'Existing document function owner differs; review before rerun.'; end if;
  perform set_config('vicourt.client_document_baseline',v_baseline::text,true);
end
$preflight$;

create table if not exists public.client_object_document_publications (
  document_id bigint primary key references public.object_documents(id) on delete cascade,
  is_published boolean not null default false,
  client_title text not null,
  client_description text,
  sort_order integer not null default 0,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_document_title_check check (client_title=pg_catalog.btrim(client_title) and pg_catalog.length(client_title) between 1 and 150),
  constraint client_document_description_check check (client_description is null or
    (client_description=pg_catalog.btrim(client_description) and pg_catalog.length(client_description) between 1 and 1000)),
  constraint client_document_order_check check (sort_order>=0),
  constraint client_document_published_check check (not is_published or published_at is not null)
);
alter table public.client_object_document_publications enable row level security;
revoke all on table public.client_object_document_publications from public, anon, authenticated;
do $column_acl$
declare v_columns text;
begin
  select string_agg(quote_ident(attname),',' order by attnum) into v_columns from pg_attribute
    where attrelid='public.client_object_document_publications'::regclass and attnum>0 and not attisdropped;
  execute format('revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on public.client_object_document_publications from public, anon, authenticated',v_columns);
  if exists (select 1 from pg_policy where polrelid='public.client_object_document_publications'::regclass)
  then raise exception 'RPC-only publication table must have no policies.'; end if;
end
$column_acl$;

create or replace function private.client_document_is_safe_file(p_path text, p_mime text)
returns boolean language sql immutable security invoker set search_path = ''
as $function$
  select coalesce(case p_mime
    when 'application/pdf' then pg_catalog.lower(p_path) ~ '\.pdf$'
    when 'application/msword' then pg_catalog.lower(p_path) ~ '\.doc$'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then pg_catalog.lower(p_path) ~ '\.docx$'
    when 'application/vnd.ms-excel' then pg_catalog.lower(p_path) ~ '\.(xls|csv)$'
    when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then pg_catalog.lower(p_path) ~ '\.xlsx$'
    when 'text/csv' then pg_catalog.lower(p_path) ~ '\.csv$'
    when 'application/csv' then pg_catalog.lower(p_path) ~ '\.csv$'
    when 'text/plain' then pg_catalog.lower(p_path) ~ '\.(txt|csv)$'
    when 'image/jpeg' then pg_catalog.lower(p_path) ~ '\.(jpg|jpeg)$'
    when 'image/png' then pg_catalog.lower(p_path) ~ '\.png$'
    when 'image/webp' then pg_catalog.lower(p_path) ~ '\.webp$'
    else false end, false)
$function$;

create or replace function private.client_can_read_object_document(p_storage_path text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select auth.uid() is not null and coalesce(private.is_active_client(),false) and exists (
    select 1 from public.object_documents d
    join public.client_object_document_publications pub on pub.document_id=d.id and pub.is_published
    where d.storage_path=p_storage_path and d.is_ready=true
      and private.client_has_object_access(d.object_id)
  )
$function$;

create or replace function public.get_client_object_documents(p_object_id bigint, p_page integer default 1)
returns table(id bigint, object_id bigint, title text, description text, mime_type text, file_size bigint, published_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_client(),false)
    or not coalesce(private.client_has_object_access(p_object_id),false)
  then raise exception 'Object access denied.' using errcode='42501'; end if;
  if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page.' using errcode='22023'; end if;
  return query select d.id,d.object_id,pub.client_title,pub.client_description,d.mime_type,d.file_size,pub.published_at,count(*) over ()
  from public.object_documents d
  join public.client_object_document_publications pub on pub.document_id=d.id and pub.is_published
  join storage.objects file on file.bucket_id='object-documents' and file.name=d.storage_path
  where d.object_id=p_object_id and d.is_ready=true and d.file_size between 1 and 26214400
    and private.client_document_is_safe_file(d.storage_path,d.mime_type)
    and file.metadata->>'mimetype'=d.mime_type
    and private.client_document_is_safe_file(file.name,file.metadata->>'mimetype')
  order by pub.sort_order asc,pub.published_at desc,d.id desc
  limit 20 offset ((p_page-1)*20);
end
$function$;

-- Authenticated callers can technically invoke this RPC through PostgREST.
-- The returned path is only a delivery reference, never an access token;
-- Storage independently checks the live client, grant and publication again.
create or replace function public.get_client_object_document_file(p_object_id bigint, p_document_id bigint)
returns table(storage_path text, mime_type text, client_title text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_client(),false)
    or not coalesce(private.client_has_object_access(p_object_id),false)
  then raise exception 'Document access denied.' using errcode='42501'; end if;
  return query select d.storage_path,d.mime_type,pub.client_title from public.object_documents d
  join public.client_object_document_publications pub on pub.document_id=d.id and pub.is_published
  join storage.objects file on file.bucket_id='object-documents' and file.name=d.storage_path
  where d.id=p_document_id and d.object_id=p_object_id and d.is_ready=true and d.file_size between 1 and 26214400
    and private.client_can_read_object_document(d.storage_path)
    and private.client_document_is_safe_file(d.storage_path,d.mime_type)
    and file.metadata->>'mimetype'=d.mime_type
    and private.client_document_is_safe_file(file.name,file.metadata->>'mimetype');
  if not found then raise exception 'Document access denied.' using errcode='42501'; end if;
end
$function$;

create or replace function public.get_management_client_document_publications(p_object_id bigint, p_document_ids bigint[])
returns table(document_id bigint, object_id bigint, is_published boolean, client_title text, client_description text,
  sort_order integer, published_at timestamptz, unpublished_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_user(),false)
    or not coalesce(private.has_role(array['admin','object_manager']::text[]),false)
  then raise exception 'Document publication management denied.' using errcode='42501'; end if;
  if p_object_id is null or p_object_id<=0 or p_document_ids is null or cardinality(p_document_ids)>100
    or coalesce(array_ndims(p_document_ids),1)<>1
    or exists (select 1 from unnest(p_document_ids) id where id is null or id<=0)
  then raise exception 'Invalid document selection.' using errcode='22023'; end if;
  return query select d.id,d.object_id,coalesce(pub.is_published,false),pub.client_title,pub.client_description,
    coalesce(pub.sort_order,0),pub.published_at,pub.unpublished_at,pub.updated_at
  from public.object_documents d left join public.client_object_document_publications pub on pub.document_id=d.id
  where d.object_id=p_object_id and d.id=any(p_document_ids) order by d.id;
end
$function$;

create or replace function public.set_client_object_document_publication(
  p_object_id bigint, p_document_id bigint, p_is_published boolean, p_client_title text, p_client_description text, p_sort_order integer
)
returns table(document_id bigint, object_id bigint, is_published boolean, client_title text, client_description text,
  sort_order integer, published_at timestamptz, unpublished_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_document public.object_documents%rowtype;
  v_title text := pg_catalog.btrim(p_client_title);
  v_description text := nullif(pg_catalog.btrim(p_client_description),'');
  v_now timestamptz;
begin
  if auth.uid() is null or not coalesce(private.is_active_user(),false)
    or not coalesce(private.has_role(array['admin','object_manager']::text[]),false)
  then raise exception 'Document publication management denied.' using errcode='42501'; end if;
  if p_object_id is null or p_object_id<=0 or p_document_id is null or p_document_id<=0
    or p_is_published is null or p_sort_order is null or p_sort_order<0
    or v_title is null or pg_catalog.length(v_title) not between 1 and 150 or pg_catalog.length(v_description)>1000
  then raise exception 'Invalid publication metadata.' using errcode='22023'; end if;
  -- Serializes first publication, edits, unpublish, original deletion/readiness changes.
  select d.* into v_document from public.object_documents d
    where d.id=p_document_id and d.object_id=p_object_id for update;
  if not found then raise exception 'Document not found.' using errcode='P0002'; end if;
  if p_is_published and (not coalesce(v_document.is_ready,false)
    or v_document.file_size is null or v_document.file_size not between 1 and 26214400
    or not private.client_document_is_safe_file(v_document.storage_path,v_document.mime_type)
    or not exists (select 1 from storage.objects file where file.bucket_id='object-documents' and file.name=v_document.storage_path
      and file.metadata->>'mimetype'=v_document.mime_type
      and private.client_document_is_safe_file(file.name,file.metadata->>'mimetype')))
  then raise exception 'Document is not ready or its format cannot be published.' using errcode='22023'; end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.client_object_document_publications as existing (
    document_id,is_published,client_title,client_description,sort_order,published_at,unpublished_at,created_at,updated_at,created_by,updated_by
  ) values (p_document_id,p_is_published,v_title,v_description,p_sort_order,
    case when p_is_published then v_now end,null,v_now,v_now,auth.uid(),auth.uid())
  on conflict on constraint client_object_document_publications_pkey do update set
    is_published=excluded.is_published,client_title=excluded.client_title,client_description=excluded.client_description,sort_order=excluded.sort_order,
    published_at=case when excluded.is_published and not existing.is_published then v_now else existing.published_at end,
    unpublished_at=case when excluded.is_published then null when existing.is_published then v_now else existing.unpublished_at end,
    updated_at=v_now,updated_by=auth.uid();
  return query select * from public.get_management_client_document_publications(p_object_id,array[p_document_id]);
end
$function$;

revoke all on function private.client_document_is_safe_file(text,text),private.client_can_read_object_document(text),
  public.get_client_object_documents(bigint,integer),public.get_client_object_document_file(bigint,bigint),
  public.get_management_client_document_publications(bigint,bigint[]),
  public.set_client_object_document_publication(bigint,bigint,boolean,text,text,integer) from public, anon, authenticated;
grant execute on function private.client_document_is_safe_file(text,text),private.client_can_read_object_document(text),
  public.get_client_object_documents(bigint,integer),public.get_client_object_document_file(bigint,bigint),
  public.get_management_client_document_publications(bigint,bigint[]),
  public.set_client_object_document_publication(bigint,bigint,boolean,text,text,integer) to authenticated;

do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='client_object_documents_authenticated_get') then
    create policy client_object_documents_authenticated_get on storage.objects
    as permissive for select to authenticated using (
      bucket_id='object-documents'
      and storage.allow_any_operation(array['object.get_authenticated_info','object.get_authenticated']::text[])
      and private.client_document_is_safe_file(objects.name,metadata->>'mimetype')
      and private.client_can_read_object_document(objects.name)
    );
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname='storage' and p.tablename='objects'
    and p.policyname='client_object_documents_authenticated_get' and p.cmd='SELECT' and p.permissive='PERMISSIVE'
    and p.roles=array['authenticated'::name] and p.with_check is null
    and regexp_replace(replace(replace(replace(coalesce(p.qual,''),'::text[]',''),'::text',''),'objects.',''),'[[:space:]()]','','g')=
      $expr$bucket_id='object-documents'ANDstorage.allow_any_operationARRAY['object.get_authenticated_info','object.get_authenticated']ANDprivate.client_document_is_safe_filename,metadata->>'mimetype'ANDprivate.client_can_read_object_documentname$expr$)
  then raise exception 'Client document Storage policy differs from reviewed contract.'; end if;
  execute format('comment on table public.client_object_document_publications is %L',current_setting('vicourt.client_document_baseline'));
end
$policy$;

notify pgrst, 'reload schema';
commit;
