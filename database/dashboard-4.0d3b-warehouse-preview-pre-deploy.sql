-- Dashboard 4.0D3B warehouse preview. MANUAL additive PRE; run as postgres.
-- Creates one bounded worker-safe operational RPC. No table/RLS/policy/index/data changes.
begin;
set local search_path = pg_catalog;

do $preflight$
declare v_check record; v_ok boolean; v_baseline jsonb; v_existing text;
begin
  if current_user <> 'postgres' then raise exception 'Run Dashboard D3B warehouse PRE as postgres.'; end if;
  for v_check in select * from (values
    ('reviewed_identity_guard', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('private.is_active_user()')
  and p.prokind='f' and md5(p.prosrc)='9bbc898ebc01d7371aae4e8c5de61da1'
  and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
  and p.proconfig=array['search_path=""']::text[])
$check$),
    ('required_columns', $check$
select not exists(select 1 from (values
  ('profiles','id',array['uuid'],true),('profiles','role',array['text','varchar','user_role'],false),
  ('profiles','is_active',array['bool'],false),
  ('warehouse_items','id',array['int4','int8'],true),('warehouse_items','name',array['text','varchar'],false),
  ('warehouse_items','quantity',array['numeric'],false),('warehouse_items','min_quantity',array['numeric'],false)
  ) e(relation,column_name,types,required_not_null)
  left join pg_class c on c.oid=to_regclass('public.'||e.relation) and c.relkind='r'
  left join pg_attribute a on a.attrelid=c.oid and a.attname=e.column_name and a.attnum>0 and not a.attisdropped
  left join pg_type t on t.oid=a.atttypid
  where a.attname is null or not (t.typname::text=any(e.types))
    or (e.required_not_null and not a.attnotnull))
$check$),
    ('definer_read_prerequisites', $check$
select exists(select 1 from pg_roles where rolname='postgres' and (rolsuper or rolbypassrls))
  and has_schema_privilege('postgres','public','USAGE')
  and has_schema_privilege('postgres','private','USAGE')
  and has_schema_privilege('postgres','auth','USAGE')
  and has_table_privilege('postgres','public.profiles','SELECT')
  and has_table_privilege('postgres','public.warehouse_items','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Dashboard D3B warehouse prerequisite failed: %',v_check.check_name; end if;
  end loop;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_dashboard_warehouse_attention_items'
      and (p.oid<>coalesce(to_regprocedure('public.get_dashboard_warehouse_attention_items()'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres'
        or md5(p.prosrc)<>'40cad7bc056198450ee0407df79b9689'))
  then raise exception 'Existing Dashboard warehouse preview RPC drift/overload; review required.'; end if;

-- WAREHOUSE PREVIEW PRESERVATION BEGIN
  select jsonb_build_object(
    'version','dashboard-warehouse-preview:v1',
    'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text,'[]')) from pg_proc p where p.oid in (
        to_regprocedure('private.is_active_user()'),to_regprocedure('public.get_warehouse_stock_summary()'),
        to_regprocedure('public.get_dashboard_operational_attention(date)'),
        to_regprocedure('public.get_dashboard_worker_object_watchlist(date)'),
        to_regprocedure('public.get_dashboard_management_object_watchlist(date)'))),
    'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where p.schemaname='public' and p.tablename in ('profiles','warehouse_items')),
    'relations',(select md5(jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,
      'force_rls',c.relforcerowsecurity) order by c.oid::regclass::text)::text)
      from pg_class c where c.oid in (to_regclass('public.profiles'),to_regclass('public.warehouse_items')))
  ) into v_baseline;
-- WAREHOUSE PREVIEW PRESERVATION END
  v_existing:=obj_description(to_regprocedure('public.get_dashboard_warehouse_attention_items()'),'pg_proc');
  if to_regprocedure('public.get_dashboard_warehouse_attention_items()') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved warehouse Dashboard contracts drift; do not refresh baseline.'; end if;
  perform set_config('vicourt.dashboard_warehouse_preview_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_dashboard_warehouse_attention_items()
returns table (item_id bigint, name text, quantity numeric, min_quantity numeric, stock_state text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_role text;
begin
  if auth.uid() is null or private.is_active_user() is distinct from true then
    raise exception 'Недостатньо прав для перегляду залишків складу.' using errcode='42501';
  end if;
  select p.role::text into v_role from public.profiles p where p.id=auth.uid() and p.is_active=true;
  if v_role is null or v_role not in ('admin','object_manager','worker') then
    raise exception 'Недостатньо прав для перегляду залишків складу.' using errcode='42501';
  end if;

  return query
  select w.id::bigint,pg_catalog.left(coalesce(w.name,'Матеріал'),500)::text,
    w.quantity::numeric,w.min_quantity::numeric,
    (case when w.quantity<=0 then 'out' else 'low' end)::text
  from public.warehouse_items w
  where w.quantity<=0 or (w.quantity>0 and w.min_quantity is not null and w.quantity<=w.min_quantity)
  order by (case when w.quantity<=0 then 0 else 1 end),w.quantity,w.id
  limit 5;
end
$function$;

alter function public.get_dashboard_warehouse_attention_items() owner to postgres;
revoke all on function public.get_dashboard_warehouse_attention_items() from public,anon,authenticated,service_role;
grant execute on function public.get_dashboard_warehouse_attention_items() to authenticated;

do $postflight$
declare v_ok boolean;
begin
  execute format('comment on function public.get_dashboard_warehouse_attention_items() is %L',
    current_setting('vicourt.dashboard_warehouse_preview_baseline'));
  select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.get_dashboard_warehouse_attention_items()') and p.prokind='f'
      and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
      and p.proconfig=array['search_path=""']::text[] and l.lanname='plpgsql'
      and p.proretset and p.prorettype='record'::regtype and p.pronargs=0 and p.pronargdefaults=0
      and p.proargnames=array['item_id','name','quantity','min_quantity','stock_state']::text[]
      and p.proargmodes=array['t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['bigint'::regtype::oid,'text'::regtype::oid,'numeric'::regtype::oid,
        'numeric'::regtype::oid,'text'::regtype::oid]
      and md5(p.prosrc)='40cad7bc056198450ee0407df79b9689'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
          or a.privilege_type<>'EXECUTE' or a.is_grantable)
      and obj_description(p.oid,'pg_proc')=current_setting('vicourt.dashboard_warehouse_preview_baseline')) into v_ok;
  if v_ok is distinct from true then raise exception 'Dashboard D3B warehouse postflight failed.'; end if;
end
$postflight$;
notify pgrst,'reload schema';
commit;
