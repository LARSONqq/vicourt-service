-- Dashboard 4.0D2 operational Attention. MANUAL additive PRE; run as postgres.
-- Creates one bounded worker-safe operational RPC. No table/RLS/policy/index/data changes.
begin;
set local search_path = pg_catalog;

do $preflight$
declare v_check record; v_ok boolean; v_baseline jsonb; v_existing text;
begin
  if current_user <> 'postgres' then raise exception 'Run Dashboard D2 PRE as postgres.'; end if;
  for v_check in select * from (values
    ('reviewed_identity_guard', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('private.is_active_user()') and p.prokind='f'
    and md5(p.prosrc)='9bbc898ebc01d7371aae4e8c5de61da1'
    and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
    and p.proconfig=array['search_path=""']::text[])
$check$),
    ('required_columns', $check$
select not exists (
  select 1 from (values
    ('profiles','id',array['uuid'],true),('profiles','role',array['text','varchar','user_role'],false),
    ('profiles','employee_id',array['int4','int8'],false),('profiles','is_active',array['bool'],false),
    ('object_tasks','id',array['int4','int8'],true),('object_tasks','title',array['text','varchar'],false),
    ('object_tasks','status',array['text','varchar'],false),('object_tasks','task_source',array['text','varchar'],false),
    ('object_tasks','due_date',array['date'],false),('object_tasks','object_id',array['int4','int8'],false),
    ('object_tasks','assigned_employee_id',array['int4','int8'],false),
    ('objects','id',array['int4','int8'],true),('objects','name',array['text','varchar'],false),
    ('objects','status',array['text','varchar'],false),('objects','responsible_employee_id',array['int4','int8'],false),
    ('objects','next_supervision_date',array['date'],false),
    ('warehouse_items','id',array['int4','int8'],true),('warehouse_items','name',array['text','varchar'],false),
    ('warehouse_items','quantity',array['numeric'],false),('warehouse_items','unit',array['text','varchar'],false),
    ('warehouse_items','min_quantity',array['numeric'],false),
    ('equipment','id',array['int4','int8'],true),('equipment','name',array['text','varchar'],false),
    ('equipment','maintenance_interval_days',array['int4'],false),('equipment','next_service_date',array['date'],false),
    ('equipment','usage_type',array['text','varchar','equipment_usage_type'],false),
    ('equipment','current_usage',array['numeric'],false),('equipment','maintenance_interval_usage',array['numeric'],false),
    ('equipment','next_maintenance_usage',array['numeric'],false)
  ) e(relation,column_name,types,required_not_null)
  left join pg_class c on c.oid=to_regclass('public.'||e.relation) and c.relkind='r'
  left join pg_attribute a on a.attrelid=c.oid and a.attname=e.column_name and a.attnum>0 and not a.attisdropped
  left join pg_type t on t.oid=a.atttypid
  where a.attname is null or not (t.typname::text=any(e.types))
    or (e.required_not_null and not a.attnotnull)
)
$check$),
    ('definer_read_prerequisites', $check$
select exists(select 1 from pg_roles where rolname='postgres' and (rolsuper or rolbypassrls))
  and has_schema_privilege('postgres','public','USAGE')
  and has_schema_privilege('postgres','private','USAGE')
  and has_schema_privilege('postgres','auth','USAGE')
  and has_table_privilege('postgres','public.profiles','SELECT')
  and has_table_privilege('postgres','public.object_tasks','SELECT')
  and has_table_privilege('postgres','public.objects','SELECT')
  and has_table_privilege('postgres','public.warehouse_items','SELECT')
  and has_table_privilege('postgres','public.equipment','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Dashboard D2 operational prerequisite failed: %',v_check.check_name; end if;
  end loop;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_dashboard_operational_attention'
      and (p.oid<>coalesce(to_regprocedure('public.get_dashboard_operational_attention(date)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres'
        or md5(p.prosrc)<>'84b68bbb2972bba102c5ca846a80ec22'))
  then raise exception 'Existing operational Attention RPC drift/overload; review required.'; end if;

-- OPERATIONAL PRESERVATION BEGIN
  select jsonb_build_object(
    'version','dashboard-attention-operational:v1',
    'guards',(select md5(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text) from pg_proc p
      where p.oid=to_regprocedure('private.is_active_user()')),
    'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text,'[]')) from pg_proc p where p.oid in (
        to_regprocedure('public.get_warehouse_stock_summary()'),
        to_regprocedure('public.get_equipment_maintenance_summary(date)'))),
    'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where p.schemaname='public' and p.tablename in
        ('profiles','object_tasks','objects','warehouse_items','equipment')),
    'relations',(select md5(jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,
      'force_rls',c.relforcerowsecurity) order by c.oid::regclass::text)::text)
      from pg_class c where c.oid in (to_regclass('public.profiles'),to_regclass('public.object_tasks'),
        to_regclass('public.objects'),to_regclass('public.warehouse_items'),to_regclass('public.equipment')))
  ) into v_baseline;
-- OPERATIONAL PRESERVATION END
  v_existing:=obj_description(to_regprocedure('public.get_dashboard_operational_attention(date)'),'pg_proc');
  if to_regprocedure('public.get_dashboard_operational_attention(date)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved operational Dashboard contracts drift; do not refresh baseline.'; end if;
  perform set_config('vicourt.dashboard_operational_attention_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_dashboard_operational_attention(p_business_date date)
returns table (
  item_id text, kind text, severity text, timing text, title text, description text,
  entity_type text, entity_id bigint, object_id bigint, relevant_date date, href text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_employee_id bigint;
begin
  -- Identity and role are derived here; the caller cannot supply an employee scope.
  if auth.uid() is null or private.is_active_user() is distinct from true then
    raise exception 'Недостатньо прав для перегляду оперативних попереджень.' using errcode='42501';
  end if;
  select p.role::text, p.employee_id::bigint into v_role, v_employee_id
  from public.profiles p where p.id=auth.uid() and p.is_active=true;
  if v_role is null or v_role not in ('admin','object_manager','worker') then
    raise exception 'Недостатньо прав для перегляду оперативних попереджень.' using errcode='42501';
  end if;
  if p_business_date is null or not pg_catalog.isfinite(p_business_date) then
    raise exception 'Некоректна бізнес-дата.' using errcode='22007';
  end if;

  return query
  with task_items as (
    select ('task_'||case when t.due_date<p_business_date then 'overdue' else 'today' end||':'||t.id)::text item_id,
      ('task_'||case when t.due_date<p_business_date then 'overdue' else 'today' end)::text kind,
      (case when t.due_date<p_business_date then 'critical' else 'warning' end)::text severity,
      (case when t.due_date<p_business_date then 'overdue' else 'today' end)::text timing,
      (case when t.due_date<p_business_date then 'Прострочене завдання' else 'Завдання на сьогодні' end)::text title,
      pg_catalog.left(coalesce(t.title,'Завдання'),500)::text description,
      'task'::text entity_type,t.id::bigint entity_id,t.object_id::bigint object_id,
      t.due_date relevant_date,('/tasks/'||t.id)::text href
    from public.object_tasks t
    where t.task_source='manual' and t.status<>'Виконано' and t.due_date<=p_business_date
      and (v_role<>'worker' or (v_employee_id is not null and t.assigned_employee_id=v_employee_id))
  ), supervision_items as (
    select ('supervision_'||case when o.next_supervision_date<p_business_date then 'overdue' else 'today' end||':'||o.id)::text,
      ('supervision_'||case when o.next_supervision_date<p_business_date then 'overdue' else 'today' end)::text,
      (case when o.next_supervision_date<p_business_date then 'critical' else 'warning' end)::text,
      (case when o.next_supervision_date<p_business_date then 'overdue' else 'today' end)::text,
      (case when o.next_supervision_date<p_business_date then 'Періодичний огляд прострочено' else 'Періодичний огляд сьогодні' end)::text,
      pg_catalog.left(coalesce(o.name,'Об’єкт'),500)::text,'object'::text,o.id::bigint,o.id::bigint,
      o.next_supervision_date,('/objects/'||o.id)::text
    from public.objects o
    where o.status='Під періодичним наглядом' and o.next_supervision_date<=p_business_date
      and (v_role<>'worker' or (v_employee_id is not null and o.responsible_employee_id=v_employee_id))
  ), warehouse_items as (
    select ('warehouse_'||case when w.quantity<=0 then 'out' else 'low' end||':'||w.id)::text,
      ('warehouse_'||case when w.quantity<=0 then 'out' else 'low' end)::text,
      (case when w.quantity<=0 then 'critical' else 'warning' end)::text,'current'::text,
      (case when w.quantity<=0 then 'Закінчився на складі' else 'Низький залишок' end)::text,
      pg_catalog.left(coalesce(w.name,'Матеріал')||': '||coalesce(w.quantity::text,'0')||' '||coalesce(w.unit,''),500)::text,
      'warehouse_item'::text,w.id::bigint,null::bigint,null::date,('/warehouse/'||w.id)::text
    from public.warehouse_items w
    where w.quantity<=0 or (w.quantity>0 and w.min_quantity is not null and w.quantity<=w.min_quantity)
  ), equipment_state as (
    select e.id,e.name,e.next_service_date,
      coalesce(e.maintenance_interval_days>0 and e.next_service_date<p_business_date,false) date_overdue,
      coalesce(e.maintenance_interval_days>0 and e.next_service_date=p_business_date,false) date_today,
      coalesce(e.maintenance_interval_days>0 and e.next_service_date>p_business_date
        and e.next_service_date<=p_business_date+7,false) date_upcoming,
      coalesce(e.usage_type::text in ('hours','km') and e.maintenance_interval_usage is not null
        and e.maintenance_interval_usage>0 and e.next_maintenance_usage is not null
        and e.next_maintenance_usage>=0 and e.current_usage is not null and e.current_usage>=0
        and e.current_usage>=e.next_maintenance_usage,false) usage_due
    from public.equipment e
  ), equipment_items as (
    select ('equipment_'||case when e.date_overdue then 'overdue'
        when e.date_today and e.usage_due then 'today_usage_due' when e.date_today then 'today'
        when e.usage_due then 'usage_due' else 'upcoming' end||':'||e.id)::text,
      ('equipment_'||case when e.date_overdue then 'overdue'
        when e.date_today and e.usage_due then 'today_usage_due' when e.date_today then 'today'
        when e.usage_due then 'usage_due' else 'upcoming' end)::text,
      (case when e.date_overdue or e.usage_due then 'critical'
        when e.date_today then 'warning' else 'info' end)::text,
      (case when e.date_overdue then 'overdue' when e.date_today then 'today'
        when e.usage_due then 'current' else 'upcoming' end)::text,
      (case when e.date_overdue then 'ТО техніки прострочено'
        when e.date_today and e.usage_due then 'ТО сьогодні та за напрацюванням'
        when e.date_today then 'ТО техніки сьогодні'
        when e.usage_due then 'ТО потрібне за напрацюванням' else 'ТО протягом 7 днів' end)::text,
      pg_catalog.left(coalesce(e.name,'Техніка'),500)::text,'equipment'::text,e.id::bigint,null::bigint,
      (case when e.date_overdue or e.date_today or e.date_upcoming then e.next_service_date else p_business_date end)::date,
      ('/equipment/'||e.id)::text
    from equipment_state e where e.date_overdue or e.date_today or e.usage_due or e.date_upcoming
  ), all_items as (
    select * from task_items union all select * from supervision_items
    union all select * from warehouse_items union all select * from equipment_items
  )
  select a.* from all_items a
  order by case a.timing when 'overdue' then 0 when 'today' then 1 when 'current' then 2 else 3 end,
    case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
    a.relevant_date nulls last,a.kind,a.entity_id,a.item_id
  limit 8;
end
$function$;

alter function public.get_dashboard_operational_attention(date) owner to postgres;
revoke all on function public.get_dashboard_operational_attention(date) from public,anon,authenticated,service_role;
grant execute on function public.get_dashboard_operational_attention(date) to authenticated;

do $postflight$
declare v_ok boolean;
begin
  execute format('comment on function public.get_dashboard_operational_attention(date) is %L',
    current_setting('vicourt.dashboard_operational_attention_baseline'));
  select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.get_dashboard_operational_attention(date)') and p.prokind='f'
      and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
      and p.proconfig=array['search_path=""']::text[] and l.lanname='plpgsql'
      and p.proretset and p.prorettype='record'::regtype and p.pronargs=1 and p.pronargdefaults=0
      and p.proargnames=array['p_business_date','item_id','kind','severity','timing','title','description',
        'entity_type','entity_id','object_id','relevant_date','href']::text[]
      and p.proargmodes=array['i','t','t','t','t','t','t','t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['date'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
        'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
        'text'::regtype::oid,'bigint'::regtype::oid,'bigint'::regtype::oid,'date'::regtype::oid,
        'text'::regtype::oid]
      and md5(p.prosrc)='84b68bbb2972bba102c5ca846a80ec22'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee not in (p.proowner,to_regrole('authenticated')::oid) or a.is_grantable)
      and obj_description(p.oid,'pg_proc')=current_setting('vicourt.dashboard_operational_attention_baseline')) into v_ok;
  if v_ok is distinct from true then raise exception 'Dashboard D2 operational postflight failed.'; end if;
end
$postflight$;
notify pgrst,'reload schema';
commit;
