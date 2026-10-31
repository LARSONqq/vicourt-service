-- Dashboard 4.0D3B equipment preview. MANUAL additive PRE; run as postgres.
-- Creates one bounded worker-safe operational RPC. No table/RLS/policy/index/data changes.
begin;
set local search_path = pg_catalog;

do $preflight$
declare v_check record; v_ok boolean; v_baseline jsonb; v_existing text;
begin
  if current_user <> 'postgres' then raise exception 'Run Dashboard D3B equipment PRE as postgres.'; end if;
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
  ('equipment','id',array['int4','int8'],true),('equipment','name',array['text','varchar'],false),
  ('equipment','status',array['text','varchar'],false),
  ('equipment','maintenance_interval_days',array['int4'],false),('equipment','next_service_date',array['date'],false),
  ('equipment','usage_type',array['text','varchar','equipment_usage_type'],false),
  ('equipment','current_usage',array['numeric'],false),('equipment','maintenance_interval_usage',array['numeric'],false),
  ('equipment','next_maintenance_usage',array['numeric'],false)
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
  and has_table_privilege('postgres','public.equipment','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Dashboard D3B equipment prerequisite failed: %',v_check.check_name; end if;
  end loop;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_dashboard_equipment_attention_items'
      and (p.oid<>coalesce(to_regprocedure('public.get_dashboard_equipment_attention_items(date)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres'
        or md5(p.prosrc)<>'8e48f5499d8107c8ac985afac132506a'))
  then raise exception 'Existing Dashboard equipment preview RPC drift/overload; review required.'; end if;

-- EQUIPMENT PREVIEW PRESERVATION BEGIN
  select jsonb_build_object(
    'version','dashboard-equipment-preview:v1',
    'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text,'[]')) from pg_proc p where p.oid in (
        to_regprocedure('private.is_active_user()'),to_regprocedure('public.get_equipment_maintenance_summary(date)'),
        to_regprocedure('public.get_dashboard_operational_attention(date)'),
        to_regprocedure('public.get_dashboard_worker_object_watchlist(date)'),
        to_regprocedure('public.get_dashboard_management_object_watchlist(date)'))),
    'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where p.schemaname='public' and p.tablename in ('profiles','equipment')),
    'relations',(select md5(jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,
      'force_rls',c.relforcerowsecurity) order by c.oid::regclass::text)::text)
      from pg_class c where c.oid in (to_regclass('public.profiles'),to_regclass('public.equipment')))
  ) into v_baseline;
-- EQUIPMENT PREVIEW PRESERVATION END
  v_existing:=obj_description(to_regprocedure('public.get_dashboard_equipment_attention_items(date)'),'pg_proc');
  if to_regprocedure('public.get_dashboard_equipment_attention_items(date)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved equipment Dashboard contracts drift; do not refresh baseline.'; end if;
  perform set_config('vicourt.dashboard_equipment_preview_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_dashboard_equipment_attention_items(p_business_date date)
returns table (equipment_id bigint, name text, next_service_date date, attention_state text, usage_due boolean)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_role text;
begin
  if auth.uid() is null or private.is_active_user() is distinct from true then
    raise exception 'Недостатньо прав для перегляду стану техніки.' using errcode='42501';
  end if;
  select p.role::text into v_role from public.profiles p where p.id=auth.uid() and p.is_active=true;
  if v_role is null or v_role not in ('admin','object_manager','worker') then
    raise exception 'Недостатньо прав для перегляду стану техніки.' using errcode='42501';
  end if;
  if p_business_date is null or not pg_catalog.isfinite(p_business_date) then
    raise exception 'Некоректна бізнес-дата.' using errcode='22007';
  end if;

  return query
  with maintenance_state as materialized (
    select e.id::bigint equipment_id,pg_catalog.left(coalesce(e.name,'Техніка'),500)::text name,
      e.next_service_date,e.status::text equipment_status,
      coalesce(e.maintenance_interval_days>0 and e.next_service_date<p_business_date,false) date_overdue,
      coalesce(e.maintenance_interval_days>0 and e.next_service_date=p_business_date,false) date_today,
      coalesce(e.maintenance_interval_days>0 and e.next_service_date>p_business_date
        and e.next_service_date<=p_business_date+7,false) date_upcoming,
      coalesce(e.usage_type::text in ('hours','km') and e.maintenance_interval_usage is not null
        and e.maintenance_interval_usage>0 and e.next_maintenance_usage is not null
        and e.next_maintenance_usage>=0 and e.current_usage is not null and e.current_usage>=0
        and e.current_usage>=e.next_maintenance_usage,false) usage_due
    from public.equipment e
  ), classified as (
    select s.equipment_id,s.name,s.next_service_date,s.usage_due,
      case when s.date_overdue then 'overdue'
        when not s.date_overdue and (s.usage_due or s.date_today) then 'due_now'
        when s.equipment_status='Потребує ремонту' then 'repair_required'
        when s.equipment_status='На ремонті' then 'in_repair'
        when not s.date_overdue and not s.usage_due and s.date_upcoming then 'upcoming'
        else null end::text attention_state
    from maintenance_state s
  )
  select c.equipment_id,c.name,c.next_service_date,c.attention_state,c.usage_due
  from classified c
  where c.attention_state is not null
  order by case c.attention_state when 'overdue' then 0 when 'due_now' then 1
    when 'repair_required' then 2 when 'in_repair' then 3 else 4 end,
    c.next_service_date nulls last,c.equipment_id
  limit 5;
end
$function$;

alter function public.get_dashboard_equipment_attention_items(date) owner to postgres;
revoke all on function public.get_dashboard_equipment_attention_items(date) from public,anon,authenticated,service_role;
grant execute on function public.get_dashboard_equipment_attention_items(date) to authenticated;

do $postflight$
declare v_ok boolean;
begin
  execute format('comment on function public.get_dashboard_equipment_attention_items(date) is %L',
    current_setting('vicourt.dashboard_equipment_preview_baseline'));
  select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.get_dashboard_equipment_attention_items(date)') and p.prokind='f'
      and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
      and p.proconfig=array['search_path=""']::text[] and l.lanname='plpgsql'
      and p.proretset and p.prorettype='record'::regtype and p.pronargs=1 and p.pronargdefaults=0
      and p.proargnames=array['p_business_date','equipment_id','name','next_service_date','attention_state','usage_due']::text[]
      and p.proargmodes=array['i','t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['date'::regtype::oid,'bigint'::regtype::oid,'text'::regtype::oid,
        'date'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid]
      and md5(p.prosrc)='8e48f5499d8107c8ac985afac132506a'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
          or a.privilege_type<>'EXECUTE' or a.is_grantable)
      and obj_description(p.oid,'pg_proc')=current_setting('vicourt.dashboard_equipment_preview_baseline')) into v_ok;
  if v_ok is distinct from true then raise exception 'Dashboard D3B equipment postflight failed.'; end if;
end
$postflight$;
notify pgrst,'reload schema';
commit;
