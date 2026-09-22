-- Client Portal 1.0C1a. Manual PRE as postgres; no backfill or UI required.
-- PRE -> structural audit -> app deploy -> actual-session Storage smoke.
-- Existing policies/functions are not replaced. A catalog-only baseline in the
-- new table's comment lets the audit verify their exact preservation on reruns.
begin;
set local search_path = pg_catalog;

do $preflight$
declare
  v_baseline text;
  v_signature text;
  v_policy_issues jsonb;
begin
  if current_user <> 'postgres' then raise exception 'Run photo PRE as postgres.'; end if;
  if exists (select 1 from pg_proc p where p.oid in (
    to_regprocedure('private.client_photo_is_safe_raster(text,text)'),
    to_regprocedure('private.client_can_read_object_photo(text)'),
    to_regprocedure('public.get_client_object_photos(bigint,integer)'),
    to_regprocedure('public.get_client_object_photo_file(bigint,bigint)'),
    to_regprocedure('public.get_management_client_photo_publications(bigint,bigint[])'),
    to_regprocedure('public.set_client_object_photo_publication(bigint,bigint,boolean,text,integer)'))
    and pg_get_userbyid(p.proowner)<>'postgres')
  then raise exception 'Existing photo function owner differs from postgres; review before rerun.'; end if;
  if not exists (select 1 from pg_class where oid = to_regclass('public.object_photos') and relkind = 'r' and relrowsecurity)
    or not exists (select 1 from pg_class where oid = to_regclass('storage.objects') and relkind = 'r' and relrowsecurity)
  then raise exception 'Reviewed photo/Storage tables with RLS are required.'; end if;
  if exists (
    select 1 from (values ('id','bigint',true,'a'), ('object_id','bigint',true,''),
      ('storage_path','text',true,''), ('caption','text',false,''),
      ('created_at','timestamp with time zone',false,'')) e(name,type_name,required,identity_kind)
    left join pg_attribute a on a.attrelid = 'public.object_photos'::regclass
      and a.attname::text = e.name and a.attnum > 0 and not a.attisdropped
    where a.attnum is null or format_type(a.atttypid,a.atttypmod) <> e.type_name
      or a.attnotnull <> e.required or a.attidentity::text <> e.identity_kind
  ) then raise exception 'object_photos columns differ from reviewed production.'; end if;
  if not exists (select 1 from pg_constraint c join pg_attribute a
    on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.conrelid='public.object_photos'::regclass and c.contype='p'
      and cardinality(c.conkey)=1 and a.attname='id' and c.convalidated)
    or not exists (select 1 from pg_constraint c
      join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
      where c.conrelid='public.object_photos'::regclass and c.contype='f'
        and c.confrelid=to_regclass('public.objects') and cardinality(c.conkey)=1
        and a.attname='object_id' and b.attname='id' and c.confdeltype='c' and c.convalidated)
    or not exists (select 1 from pg_index i join pg_attribute a
      on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
      where i.indrelid='public.object_photos'::regclass and a.attname='storage_path'
        and i.indisunique and i.indisvalid and i.indisready and i.indnkeyatts=1
        and i.indpred is null and i.indexprs is null)
  then raise exception 'Reviewed photo PK/FK/global storage_path uniqueness required.'; end if;
  if not exists (select 1 from pg_attribute where attrelid='storage.objects'::regclass
    and attname='metadata' and atttypid='jsonb'::regtype and not attisdropped)
    or not exists (select 1 from pg_attribute where attrelid='storage.objects'::regclass
      and attname='name' and atttypid='text'::regtype and not attisdropped)
    or not exists (select 1 from pg_attribute where attrelid='storage.objects'::regclass
      and attname='bucket_id' and atttypid='text'::regtype and not attisdropped)
  then raise exception 'Storage name/bucket text and metadata jsonb contract required.'; end if;
  -- Metadata-reading DEFINER RPCs execute as postgres, not the request role.
  -- BYPASSRLS/superuser is a role attribute, not implied by the role's name.
  if not exists (select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
    or not has_schema_privilege(current_user,'storage','USAGE')
    or not has_table_privilege(current_user,'storage.objects','SELECT')
  then raise exception 'Photo RPC owner requires proven Storage SELECT and BYPASSRLS/superuser.'; end if;
  if not exists (select 1 from storage.buckets where id='object-photos' and public=false)
  then raise exception 'Private object-photos bucket required.'; end if;

  -- Shared with the read-only audit; exact guards, roles, commands and clauses.
  -- Scalar SELECT wrappers are equivalent, but extra OR/roles/clauses fail closed.
  with reviewed_policy_contracts(schema_name, table_name, command, expressions) as (
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
  )
  select jsonb_agg(jsonb_build_object('check',check_name,'evidence',evidence))
    into v_policy_issues from internal_policy_results where not matches;
  if v_policy_issues is not null then
    raise exception 'Internal photo policy contract differs from reviewed production.'
      using detail=v_policy_issues::text;
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and permissive<>'PERMISSIVE')
  then raise exception 'Reviewed permissive Storage policy contract required.'; end if;

  foreach v_signature in array array['private.is_active_user()', 'private.has_role(text[])',
    'private.is_active_client()', 'private.client_has_object_access(bigint)'] loop
    if not exists (select 1 from pg_proc p where p.oid=to_regprocedure(v_signature) and p.prokind='f'
      and p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and p.proconfig @> array['search_path=""'])
    then raise exception 'Reviewed private guard missing/drifted: %', v_signature; end if;
  end loop;
  if has_function_privilege('authenticated','private.client_has_object_access(bigint)','EXECUTE')
    or has_function_privilege('anon','private.client_has_object_access(bigint)','EXECUTE')
  then raise exception 'Existing object-grant helper must not be directly API-executable.'; end if;
  if exists (select 1 from (values
    ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1'),
    ('private.has_role(text[])','53ee6011008695bf5bba95283f571979'),
    ('private.is_active_client()','b220a9950bb96f0f6bd817af5fa20e41'),
    ('private.client_has_object_access(bigint)','a94f372e167d6a9d30ab7db3ff2c698f'),
    ('storage.allow_only_operation(text)','8682c6d323bc2e01e70abf92f4ae85f6'),
    ('storage.operation()','a9b2cc8c1b536867e48f86d3455d4704')
  ) e(signature,hash) left join pg_proc p on p.oid=to_regprocedure(e.signature) and p.prokind='f'
    where p.oid is null or md5(p.prosrc)<>e.hash)
  then raise exception 'Verified internal/client/Storage helper body fingerprint mismatch.'; end if;
  foreach v_signature in array array['storage.allow_only_operation(text)', 'storage.allow_any_operation(text[])', 'storage.operation()'] loop
    if to_regprocedure(v_signature) is null then raise exception 'Storage operation helper missing: %', v_signature; end if;
    if not has_function_privilege('authenticated',v_signature,'EXECUTE')
    then raise exception 'Storage operation helper is not callable: %', v_signature; end if;
  end loop;
  if not has_schema_privilege('authenticated','storage','USAGE')
    or not has_schema_privilege('authenticated','private','USAGE')
  then raise exception 'Existing Storage/private schema USAGE required.'; end if;
  if exists (select 1 from (values
    ('public.get_client_object_progress(bigint)','0278ed74776b14da44d557f707ed85cf'),
    ('public.get_management_client_object_progress(bigint)','5ad888337069ef0c5fe1e1fda92ea7e8'),
    ('public.save_client_object_progress(bigint,smallint,text,text,jsonb,bigint)','755dc1a4506b49fa44f358182976f669')
  ) e(signature,hash) left join pg_proc p on p.oid=to_regprocedure(e.signature)
    where p.oid is null or md5(p.prosrc)<>e.hash)
  then raise exception 'Reviewed 1.0B progress foundation required.'; end if;

  -- Baseline all policies (including other buckets), not only name matches.
  -- This is catalog metadata, never an auth/user/business-row snapshot.
  select 'client-portal-1.0c1a:v1;policies=' || md5(coalesce(jsonb_agg(to_jsonb(p)
    order by p.schemaname,p.tablename,p.policyname)::text,'[]')) into v_baseline
  from pg_policies p where ((p.schemaname='storage' and p.tablename='objects')
    or (p.schemaname='public' and p.tablename='object_photos'))
    and not (p.schemaname='storage' and p.policyname='client_object_photos_authenticated_get');
  select v_baseline || ';guards=' || md5(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)
    order by p.oid::regprocedure::text)::text) into v_baseline
  from pg_proc p where p.prokind='f' and p.oid in (
    to_regprocedure('private.is_active_user()'),to_regprocedure('private.has_role(text[])'),
    to_regprocedure('private.is_active_client()'),to_regprocedure('private.client_has_object_access(bigint)'),
    to_regprocedure('storage.allow_only_operation(text)'),to_regprocedure('storage.allow_any_operation(text[])'),to_regprocedure('storage.operation()'),
    to_regprocedure('public.get_client_object_progress(bigint)'),to_regprocedure('public.get_management_client_object_progress(bigint)'),
    to_regprocedure('public.save_client_object_progress(bigint,smallint,text,text,jsonb,bigint)'));
  if to_regclass('public.client_object_photo_publications') is not null and
    obj_description(to_regclass('public.client_object_photo_publications'),'pg_class') is distinct from v_baseline
  then raise exception 'Existing photo foundation baseline missing/drifted; review before rerun.'; end if;
  perform set_config('vicourt.client_photo_baseline',v_baseline,true);
end
$preflight$;

create table if not exists public.client_object_photo_publications (
  photo_id bigint primary key references public.object_photos(id) on delete cascade,
  is_published boolean not null default false,
  client_caption text,
  sort_order integer not null default 0,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_photo_caption_check check (client_caption is null or
    (client_caption=pg_catalog.btrim(client_caption) and pg_catalog.length(client_caption) between 1 and 500)),
  constraint client_photo_order_check check (sort_order>=0),
  constraint client_photo_published_check check (not is_published or published_at is not null)
);
alter table public.client_object_photo_publications enable row level security;
revoke all on table public.client_object_photo_publications from public, anon, authenticated;

-- Pure input-only MIME/extension predicate, callable for Storage RLS evaluation.
-- Exact metadata allowlist, including MIME/extension agreement, fails closed.
create or replace function private.client_photo_is_safe_raster(p_path text, p_mime text)
returns boolean language sql immutable security invoker set search_path = ''
as $function$
  select coalesce(case p_mime
    when 'image/jpeg' then pg_catalog.lower(p_path) ~ '\.(jpg|jpeg)$'
    when 'image/png' then pg_catalog.lower(p_path) ~ '\.png$'
    when 'image/webp' then pg_catalog.lower(p_path) ~ '\.webp$'
    when 'image/gif' then pg_catalog.lower(p_path) ~ '\.gif$'
    when 'image/avif' then pg_catalog.lower(p_path) ~ '\.avif$'
    else false end, false)
$function$;

create or replace function private.client_can_read_object_photo(p_storage_path text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select auth.uid() is not null and coalesce(private.is_active_client(),false) and exists (
    select 1 from public.object_photos ph
    join public.client_object_photo_publications pub on pub.photo_id=ph.id and pub.is_published
    where ph.storage_path=p_storage_path
      and private.client_has_object_access(ph.object_id)
  )
$function$;

create or replace function public.get_client_object_photos(p_object_id bigint, p_page integer default 1)
returns table(id bigint, object_id bigint, caption text, published_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_client(),false)
    or not coalesce(private.client_has_object_access(p_object_id),false)
  then raise exception 'Object access denied.' using errcode='42501'; end if;
  if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page.' using errcode='22023'; end if;
  return query select ph.id, ph.object_id, pub.client_caption, pub.published_at, count(*) over ()
  from public.object_photos ph
  join public.client_object_photo_publications pub on pub.photo_id=ph.id and pub.is_published
  join storage.objects file on file.bucket_id='object-photos' and file.name=ph.storage_path
  where ph.object_id=p_object_id and private.client_photo_is_safe_raster(file.name,file.metadata->>'mimetype')
  order by pub.sort_order asc, pub.published_at desc, ph.id desc
  limit 12 offset ((p_page-1)*12);
end
$function$;

create or replace function public.get_client_object_photo_file(p_object_id bigint, p_photo_id bigint)
returns table(storage_path text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_client(),false)
    or not coalesce(private.client_has_object_access(p_object_id),false)
  then raise exception 'Photo access denied.' using errcode='42501'; end if;
  return query select ph.storage_path from public.object_photos ph
  join storage.objects file on file.bucket_id='object-photos' and file.name=ph.storage_path
  where ph.id=p_photo_id and ph.object_id=p_object_id
    and private.client_can_read_object_photo(ph.storage_path)
    and private.client_photo_is_safe_raster(file.name,file.metadata->>'mimetype');
  if not found then raise exception 'Photo access denied.' using errcode='42501'; end if;
end
$function$;

create or replace function public.get_management_client_photo_publications(p_object_id bigint, p_photo_ids bigint[])
returns table(photo_id bigint, object_id bigint, is_published boolean, client_caption text,
  sort_order integer, published_at timestamptz, unpublished_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not coalesce(private.is_active_user(),false)
    or not coalesce(private.has_role(array['admin','object_manager']::text[]),false)
  then raise exception 'Photo publication management denied.' using errcode='42501'; end if;
  if p_object_id is null or p_object_id<=0 or p_photo_ids is null or cardinality(p_photo_ids)>100
    or coalesce(array_ndims(p_photo_ids),1)<>1
    or exists (select 1 from unnest(p_photo_ids) id where id is null or id<=0)
  then raise exception 'Invalid photo selection.' using errcode='22023'; end if;
  return query select ph.id, ph.object_id, coalesce(pub.is_published,false), pub.client_caption,
    coalesce(pub.sort_order,0), pub.published_at, pub.unpublished_at, pub.updated_at
  from public.object_photos ph left join public.client_object_photo_publications pub on pub.photo_id=ph.id
  where ph.object_id=p_object_id and ph.id=any(p_photo_ids) order by ph.id;
end
$function$;

create or replace function public.set_client_object_photo_publication(
  p_object_id bigint, p_photo_id bigint, p_is_published boolean, p_client_caption text, p_sort_order integer
)
returns table(photo_id bigint, object_id bigint, is_published boolean, client_caption text,
  sort_order integer, published_at timestamptz, unpublished_at timestamptz, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_path text;
  v_caption text := nullif(pg_catalog.btrim(p_client_caption),'');
  v_now timestamptz;
begin
  if auth.uid() is null or not coalesce(private.is_active_user(),false)
    or not coalesce(private.has_role(array['admin','object_manager']::text[]),false)
  then raise exception 'Photo publication management denied.' using errcode='42501'; end if;
  if p_object_id is null or p_object_id<=0 or p_photo_id is null or p_photo_id<=0
    or p_is_published is null or p_sort_order is null or p_sort_order<0 or pg_catalog.length(v_caption)>500
  then raise exception 'Invalid publication.' using errcode='22023'; end if;
  -- Parent lock also serializes concurrent FIRST publications and original deletion.
  select ph.storage_path into v_path from public.object_photos ph
    where ph.id=p_photo_id and ph.object_id=p_object_id for update;
  if not found then raise exception 'Photo not found.' using errcode='P0002'; end if;
  if p_is_published and not exists (select 1 from storage.objects file
    where file.bucket_id='object-photos' and file.name=v_path
      and private.client_photo_is_safe_raster(file.name,file.metadata->>'mimetype'))
  then raise exception 'Photo format cannot be published.' using errcode='22023'; end if;
  v_now := pg_catalog.clock_timestamp();
  insert into public.client_object_photo_publications as existing (
    photo_id,is_published,client_caption,sort_order,published_at,unpublished_at,created_at,updated_at,created_by,updated_by
  ) values (p_photo_id,p_is_published,v_caption,p_sort_order,
    case when p_is_published then v_now end,case when not p_is_published then v_now end,
    v_now,v_now,auth.uid(),auth.uid())
  on conflict on constraint client_object_photo_publications_pkey do update set
    is_published=excluded.is_published,client_caption=excluded.client_caption,sort_order=excluded.sort_order,
    published_at=case when excluded.is_published and not existing.is_published then v_now else existing.published_at end,
    unpublished_at=case when excluded.is_published then null else v_now end,
    updated_at=v_now,updated_by=auth.uid();
  return query select * from public.get_management_client_photo_publications(p_object_id,array[p_photo_id]);
end
$function$;

revoke all on function private.client_photo_is_safe_raster(text,text) from public, anon, authenticated;
revoke all on function private.client_can_read_object_photo(text),
  public.get_client_object_photos(bigint,integer), public.get_client_object_photo_file(bigint,bigint),
  public.get_management_client_photo_publications(bigint,bigint[]),
  public.set_client_object_photo_publication(bigint,bigint,boolean,text,integer) from public, anon, authenticated;
grant execute on function private.client_photo_is_safe_raster(text,text), private.client_can_read_object_photo(text),
  public.get_client_object_photos(bigint,integer), public.get_client_object_photo_file(bigint,bigint),
  public.get_management_client_photo_publications(bigint,bigint[]),
  public.set_client_object_photo_publication(bigint,bigint,boolean,text,integer) to authenticated;

do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='client_object_photos_authenticated_get') then
    create policy client_object_photos_authenticated_get on storage.objects
    as permissive for select to authenticated using (
      bucket_id='object-photos'
      and storage.allow_only_operation('object.get_authenticated')
      and private.client_photo_is_safe_raster(objects.name,metadata->>'mimetype')
      and private.client_can_read_object_photo(objects.name)
    );
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname='storage' and p.tablename='objects'
    and p.policyname='client_object_photos_authenticated_get' and p.cmd='SELECT'
    and p.permissive='PERMISSIVE' and p.roles=array['authenticated'::name] and p.with_check is null
    and regexp_replace(replace(replace(replace(coalesce(p.qual,''),
      '::text[]',''),'::text',''),'objects.',''),'[[:space:]()]','','g')=
      $expr$bucket_id='object-photos'ANDstorage.allow_only_operation'object.get_authenticated'ANDprivate.client_photo_is_safe_rastername,metadata->>'mimetype'ANDprivate.client_can_read_object_photoname$expr$)
  then raise exception 'Client photo Storage policy differs from the reviewed contract.'; end if;
  -- Keep the exact BEFORE fingerprint; never refresh it to hide later drift.
  execute format('comment on table public.client_object_photo_publications is %L',
    current_setting('vicourt.client_photo_baseline'));
end
$policy$;

notify pgrst, 'reload schema';
commit;
