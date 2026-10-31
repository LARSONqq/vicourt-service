-- Dashboard 4.0D3A worker Object Watchlist. MANUAL additive PRE; run as postgres.
-- Creates one bounded worker-only operational RPC. No table/RLS/policy/index/data changes.
begin;
set local search_path = pg_catalog;

do $preflight$
declare v_check record; v_ok boolean; v_baseline jsonb; v_existing text;
begin
  if current_user <> 'postgres' then raise exception 'Run Dashboard D3A PRE as postgres.'; end if;
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
  ('profiles','employee_id',array['int4','int8'],false),('profiles','is_active',array['bool'],false),
  ('objects','id',array['int4','int8'],true),('objects','name',array['text','varchar'],false),
  ('objects','status',array['text','varchar'],false),('objects','responsible_employee_id',array['int4','int8'],false),
  ('objects','next_supervision_date',array['date'],false),
  ('object_tasks','id',array['int4','int8'],true),('object_tasks','object_id',array['int4','int8'],false),
  ('object_tasks','status',array['text','varchar'],false),('object_tasks','task_source',array['text','varchar'],false),
  ('object_tasks','due_date',array['date'],false),('object_tasks','assigned_employee_id',array['int4','int8'],false),
  ('employees','id',array['int4','int8'],true),('employees','first_name',array['text','varchar'],false),
  ('employees','last_name',array['text','varchar'],false)
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
  and has_table_privilege('postgres','public.objects','SELECT')
  and has_table_privilege('postgres','public.object_tasks','SELECT')
  and has_table_privilege('postgres','public.employees','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Dashboard D3A worker prerequisite failed: %',v_check.check_name; end if;
  end loop;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_dashboard_worker_object_watchlist'
      and (p.oid<>coalesce(to_regprocedure('public.get_dashboard_worker_object_watchlist(date)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres'
        or md5(p.prosrc)<>'375c13b6a13c81bf03369c4dd3d3779b'))
  then raise exception 'Existing worker Object Watchlist RPC drift/overload; review required.'; end if;

-- WORKER WATCHLIST PRESERVATION BEGIN
  select jsonb_build_object(
    'version','dashboard-worker-object-watchlist:v1',
    'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text,'[]')) from pg_proc p where p.oid in (
        to_regprocedure('private.is_active_user()'),
        to_regprocedure('public.get_dashboard_operational_attention(date)'),
        to_regprocedure('public.get_dashboard_finance_attention(date)'))),
    'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where p.schemaname='public' and p.tablename in
        ('profiles','objects','object_tasks','employees')),
    'relations',(select md5(jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,
      'force_rls',c.relforcerowsecurity) order by c.oid::regclass::text)::text)
      from pg_class c where c.oid in (to_regclass('public.profiles'),to_regclass('public.objects'),
        to_regclass('public.object_tasks'),to_regclass('public.employees')))
  ) into v_baseline;
-- WORKER WATCHLIST PRESERVATION END
  v_existing:=obj_description(to_regprocedure('public.get_dashboard_worker_object_watchlist(date)'),'pg_proc');
  if to_regprocedure('public.get_dashboard_worker_object_watchlist(date)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved worker Dashboard contracts drift; do not refresh baseline.'; end if;
  perform set_config('vicourt.dashboard_worker_watchlist_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_dashboard_worker_object_watchlist(p_business_date date)
returns table (
  object_id bigint, name text, status text, responsible_employee_name text,
  overdue_task_count bigint, supervision_overdue boolean
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
  -- Identity scope is derived here; callers cannot supply another employee.
  if auth.uid() is null or private.is_active_user() is distinct from true then
    raise exception 'Недостатньо прав для перегляду об’єктів під контролем.' using errcode='42501';
  end if;
  select p.role::text,p.employee_id::bigint into v_role,v_employee_id
  from public.profiles p where p.id=auth.uid() and p.is_active=true;
  if v_role is distinct from 'worker' then
    raise exception 'Недостатньо прав для перегляду об’єктів під контролем.' using errcode='42501';
  end if;
  if p_business_date is null or not pg_catalog.isfinite(p_business_date) then
    raise exception 'Некоректна бізнес-дата.' using errcode='22007';
  end if;
  if v_employee_id is null then return; end if;

  return query
  with active_objects as materialized (
    select o.id::bigint object_id,pg_catalog.left(coalesce(o.name,'Об’єкт'),500)::text name,
      o.status::text status,o.next_supervision_date,
      nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ',e.first_name,e.last_name)),'')::text responsible_name
    from public.objects o left join public.employees e on e.id=o.responsible_employee_id
    where o.responsible_employee_id=v_employee_id
      and o.status in ('В роботі','На постійному обслуговуванні','Під періодичним наглядом')
  ), overdue_tasks as (
    select t.object_id::bigint object_id,pg_catalog.count(*)::bigint overdue_count,
      pg_catalog.min(t.due_date)::date oldest_due_date
    from public.object_tasks t join active_objects o on o.object_id=t.object_id
    where t.task_source='manual' and t.status<>'Виконано' and t.due_date<p_business_date
      and t.assigned_employee_id=v_employee_id
    group by t.object_id
  ), candidates as (
    select o.object_id,o.name,o.status,o.responsible_name,o.next_supervision_date,
      coalesce(t.overdue_count,0)::bigint overdue_count,
      coalesce(o.status='Під періодичним наглядом'
        and o.next_supervision_date<p_business_date,false)::boolean supervision_overdue,
      case
        when o.status='Під періодичним наглядом' and o.next_supervision_date<p_business_date
          then least(o.next_supervision_date,t.oldest_due_date)
        else t.oldest_due_date
      end oldest_relevant_date
    from active_objects o left join overdue_tasks t on t.object_id=o.object_id
  )
  select c.object_id,c.name,c.status,c.responsible_name,c.overdue_count,c.supervision_overdue
  from candidates c
  order by c.supervision_overdue desc,(c.overdue_count>0) desc,c.overdue_count desc,
    c.oldest_relevant_date nulls last,c.object_id
  limit 5;
end
$function$;

alter function public.get_dashboard_worker_object_watchlist(date) owner to postgres;
revoke all on function public.get_dashboard_worker_object_watchlist(date) from public,anon,authenticated,service_role;
grant execute on function public.get_dashboard_worker_object_watchlist(date) to authenticated;

do $postflight$
declare v_ok boolean;
begin
  execute format('comment on function public.get_dashboard_worker_object_watchlist(date) is %L',
    current_setting('vicourt.dashboard_worker_watchlist_baseline'));
  select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.get_dashboard_worker_object_watchlist(date)') and p.prokind='f'
      and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
      and p.proconfig=array['search_path=""']::text[] and l.lanname='plpgsql'
      and p.proretset and p.prorettype='record'::regtype and p.pronargs=1 and p.pronargdefaults=0
      and p.proargnames=array['p_business_date','object_id','name','status','responsible_employee_name',
        'overdue_task_count','supervision_overdue']::text[]
      and p.proargmodes=array['i','t','t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['date'::regtype::oid,'bigint'::regtype::oid,'text'::regtype::oid,
        'text'::regtype::oid,'text'::regtype::oid,'bigint'::regtype::oid,'boolean'::regtype::oid]
      and md5(p.prosrc)='375c13b6a13c81bf03369c4dd3d3779b'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
          or a.privilege_type<>'EXECUTE' or a.is_grantable)
      and obj_description(p.oid,'pg_proc')=current_setting('vicourt.dashboard_worker_watchlist_baseline')) into v_ok;
  if v_ok is distinct from true then raise exception 'Dashboard D3A worker postflight failed.'; end if;
end
$postflight$;
notify pgrst,'reload schema';
commit;
