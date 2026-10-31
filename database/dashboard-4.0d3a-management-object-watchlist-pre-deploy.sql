-- Dashboard 4.0D3A management Object Watchlist. MANUAL additive PRE; run as postgres.
-- Creates one bounded management-only RPC. No table/RLS/policy/index/data changes.
begin;
set local search_path = pg_catalog;

do $preflight$
declare v_check record; v_ok boolean; v_baseline jsonb; v_existing text;
begin
  if current_user <> 'postgres' then raise exception 'Run Dashboard D3A PRE as postgres.'; end if;
  for v_check in select * from (values
    ('reviewed_guards_and_d2', $check$
select not exists(select 1 from (values
  ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1',array['search_path=""']::text[]),
  ('private.has_role(text[])','53ee6011008695bf5bba95283f571979',array['search_path=""']::text[]),
  ('public.get_dashboard_operational_attention(date)','84b68bbb2972bba102c5ca846a80ec22',array['search_path=""']::text[]),
  ('public.get_dashboard_finance_attention(date)','f66d1a1533c26c065096c44218ce5063',
    array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash or not p.prosecdef
    or pg_get_userbyid(p.proowner)<>'postgres' or p.proconfig is distinct from e.config)
$check$),
    ('required_columns', $check$
select not exists(select 1 from (values
  ('objects','id',array['int4','int8'],true),('objects','name',array['text','varchar'],false),
  ('objects','status',array['text','varchar'],false),('objects','responsible_employee_id',array['int4','int8'],false),
  ('objects','next_supervision_date',array['date'],false),('objects','client_price',array['numeric'],false),
  ('object_tasks','id',array['int4','int8'],true),('object_tasks','object_id',array['int4','int8'],false),
  ('object_tasks','status',array['text','varchar'],false),('object_tasks','task_source',array['text','varchar'],false),
  ('object_tasks','due_date',array['date'],false),
  ('employees','id',array['int4','int8'],true),('employees','first_name',array['text','varchar'],false),
  ('employees','last_name',array['text','varchar'],false),
  ('object_payments','id',array['int4','int8'],true),('object_payments','object_id',array['int4','int8'],true),
  ('object_payments','amount',array['numeric'],false),
  ('object_payment_schedule','id',array['int4','int8'],true),
  ('object_payment_schedule','object_id',array['int4','int8'],true),
  ('object_payment_schedule','amount',array['numeric'],false),
  ('object_payment_schedule','due_date',array['date'],true),
  ('object_payment_schedule','created_at',array['timestamptz'],true)
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
  and has_table_privilege('postgres','public.objects','SELECT')
  and has_table_privilege('postgres','public.object_tasks','SELECT')
  and has_table_privilege('postgres','public.employees','SELECT')
  and has_table_privilege('postgres','public.object_payments','SELECT')
  and has_table_privilege('postgres','public.object_payment_schedule','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
  and has_function_privilege('postgres','private.has_role(text[])','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Dashboard D3A management prerequisite failed: %',v_check.check_name; end if;
  end loop;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_dashboard_management_object_watchlist'
      and (p.oid<>coalesce(to_regprocedure('public.get_dashboard_management_object_watchlist(date)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres'
        or md5(p.prosrc)<>'45b54fb2471f832aa8d52b818dceb9ea'))
  then raise exception 'Existing management Object Watchlist RPC drift/overload; review required.'; end if;

-- MANAGEMENT WATCHLIST PRESERVATION BEGIN
  select jsonb_build_object(
    'version','dashboard-management-object-watchlist:v1',
    'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text,'[]')) from pg_proc p where p.oid in (
        to_regprocedure('private.is_active_user()'),to_regprocedure('private.has_role(text[])'),
        to_regprocedure('public.get_dashboard_operational_attention(date)'),
        to_regprocedure('public.get_dashboard_finance_attention(date)'))),
    'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where p.schemaname='public' and p.tablename in
        ('objects','object_tasks','employees','object_payments','object_payment_schedule')),
    'relations',(select md5(jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,
      'force_rls',c.relforcerowsecurity) order by c.oid::regclass::text)::text)
      from pg_class c where c.oid in (to_regclass('public.objects'),to_regclass('public.object_tasks'),
        to_regclass('public.employees'),to_regclass('public.object_payments'),
        to_regclass('public.object_payment_schedule')))
  ) into v_baseline;
-- MANAGEMENT WATCHLIST PRESERVATION END
  v_existing:=obj_description(to_regprocedure('public.get_dashboard_management_object_watchlist(date)'),'pg_proc');
  if to_regprocedure('public.get_dashboard_management_object_watchlist(date)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved management Dashboard contracts drift; do not refresh baseline.'; end if;
  perform set_config('vicourt.dashboard_management_watchlist_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_dashboard_management_object_watchlist(p_business_date date)
returns table (
  object_id bigint, name text, status text, responsible_employee_name text,
  overdue_task_count bigint, supervision_overdue boolean,
  has_overdue_payment boolean, overdue_payment_amount numeric, missing_client_price boolean
)
language plpgsql
stable
security definer
set search_path = ''
set extra_float_digits = 3
as $function$
begin
  -- MUST precede validation and every domain/finance read.
  if auth.uid() is null
    or private.is_active_user() is distinct from true
    or private.has_role(array['admin','object_manager']::text[]) is distinct from true
  then raise exception 'Недостатньо прав для перегляду об’єктів під контролем.' using errcode='42501';
  end if;
  if p_business_date is null or not pg_catalog.isfinite(p_business_date) then
    raise exception 'Некоректна бізнес-дата.' using errcode='22007';
  end if;

  return query
  with active_objects as materialized (
    select o.id::bigint object_id,pg_catalog.left(coalesce(o.name,'Об’єкт'),500)::text name,
      o.status::text status,o.next_supervision_date,o.client_price,
      nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ',e.first_name,e.last_name)),'')::text responsible_name
    from public.objects o left join public.employees e on e.id=o.responsible_employee_id
    where o.status in ('В роботі','На постійному обслуговуванні','Під періодичним наглядом')
  ), overdue_tasks as (
    select t.object_id::bigint object_id,pg_catalog.count(*)::bigint overdue_count,
      pg_catalog.min(t.due_date)::date oldest_due_date
    from public.object_tasks t join active_objects o on o.object_id=t.object_id
    where t.task_source='manual' and t.status<>'Виконано' and t.due_date<p_business_date
    group by t.object_id
  ), money_inputs as (
    select 'payment'::text kind,p.id::bigint row_id,p.object_id::bigint object_id,
      p.amount::double precision amount,null::date due_date,null::timestamptz created_at
    from public.object_payments p join active_objects o on o.object_id=p.object_id
    union all
    select 'schedule',s.id::bigint,s.object_id::bigint,s.amount::double precision,s.due_date,s.created_at
    from public.object_payment_schedule s join active_objects o on o.object_id=s.object_id
  ), scaled_money as (
    select m.*,case when m.amount is null
      or m.amount in ('NaN'::double precision,'Infinity'::double precision,'-Infinity'::double precision)
      then 0::double precision else m.amount*100::double precision end scaled
    from money_inputs m
  ), cents as materialized (
    select m.*,pg_catalog.floor(m.scaled)+case
      when m.scaled-pg_catalog.floor(m.scaled)>=0.5::double precision then 1::double precision
      else 0::double precision end value
    from scaled_money m
  ), payments as (
    select c.object_id,pg_catalog.sum(greatest(c.value,0::double precision) order by c.row_id) paid
    from cents c where c.kind='payment' group by c.object_id
  ), payment_roundtrip as (
    select p.object_id,pg_catalog.floor((p.paid/100::double precision)*100::double precision)
      +case when ((p.paid/100::double precision)*100::double precision)
        -pg_catalog.floor((p.paid/100::double precision)*100::double precision)>=0.5::double precision
        then 1::double precision else 0::double precision end value
    from payments p
  ), ordered_schedule as (
    select c.*,greatest(c.value,0::double precision) planned,
      coalesce(pg_catalog.sum(greatest(c.value,0::double precision)) over (
        partition by c.object_id order by c.due_date,c.created_at,c.row_id
        rows between unbounded preceding and 1 preceding),0::double precision) planned_before
    from cents c where c.kind='schedule'
  ), remaining_inputs as (
    select s.*,((s.planned-least(greatest(coalesce(p.value,0::double precision)-s.planned_before,
      0::double precision),s.planned))/100::double precision)*100::double precision scaled_remaining
    from ordered_schedule s left join payment_roundtrip p on p.object_id=s.object_id
  ), remaining_cents as (
    select r.*,pg_catalog.floor(r.scaled_remaining)+case
      when r.scaled_remaining-pg_catalog.floor(r.scaled_remaining)>=0.5::double precision
      then 1::double precision else 0::double precision end remaining
    from remaining_inputs r
  ), overdue_payments as (
    select r.object_id,(pg_catalog.sum(r.remaining order by r.row_id)/100::double precision)::text::numeric amount,
      pg_catalog.min(r.due_date)::date oldest_due_date
    from remaining_cents r
    where r.due_date<p_business_date and r.remaining>0
    group by r.object_id
  ), candidates as (
    select o.*,coalesce(t.overdue_count,0)::bigint overdue_count,
      coalesce(o.status='Під періодичним наглядом'
        and o.next_supervision_date<p_business_date,false)::boolean supervision_overdue,
      coalesce(p.amount,0::numeric)::numeric overdue_amount,(o.client_price is null)::boolean missing_price,
      least(p.oldest_due_date,
        case when o.status='Під періодичним наглядом' and o.next_supervision_date<p_business_date
          then o.next_supervision_date end,t.oldest_due_date) oldest_relevant_date
    from active_objects o left join overdue_tasks t on t.object_id=o.object_id
      left join overdue_payments p on p.object_id=o.object_id
  )
  select c.object_id,c.name,c.status,c.responsible_name,c.overdue_count,c.supervision_overdue,
    (c.overdue_amount>0)::boolean,c.overdue_amount,c.missing_price
  from candidates c
  order by (c.overdue_amount>0) desc,c.supervision_overdue desc,(c.overdue_count>0) desc,
    c.missing_price desc,c.overdue_count desc,c.oldest_relevant_date nulls last,c.object_id
  limit 5;
end
$function$;

alter function public.get_dashboard_management_object_watchlist(date) owner to postgres;
revoke all on function public.get_dashboard_management_object_watchlist(date) from public,anon,authenticated,service_role;
grant execute on function public.get_dashboard_management_object_watchlist(date) to authenticated;

do $postflight$
declare v_ok boolean;
begin
  execute format('comment on function public.get_dashboard_management_object_watchlist(date) is %L',
    current_setting('vicourt.dashboard_management_watchlist_baseline'));
  select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.get_dashboard_management_object_watchlist(date)') and p.prokind='f'
      and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
      and p.proconfig=array['search_path=""','extra_float_digits=3']::text[] and l.lanname='plpgsql'
      and p.proretset and p.prorettype='record'::regtype and p.pronargs=1 and p.pronargdefaults=0
      and p.proargnames=array['p_business_date','object_id','name','status','responsible_employee_name',
        'overdue_task_count','supervision_overdue','has_overdue_payment','overdue_payment_amount',
        'missing_client_price']::text[]
      and p.proargmodes=array['i','t','t','t','t','t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['date'::regtype::oid,'bigint'::regtype::oid,'text'::regtype::oid,
        'text'::regtype::oid,'text'::regtype::oid,'bigint'::regtype::oid,'boolean'::regtype::oid,
        'boolean'::regtype::oid,'numeric'::regtype::oid,'boolean'::regtype::oid]
      and md5(p.prosrc)='45b54fb2471f832aa8d52b818dceb9ea'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
          or a.privilege_type<>'EXECUTE' or a.is_grantable)
      and obj_description(p.oid,'pg_proc')=current_setting('vicourt.dashboard_management_watchlist_baseline')) into v_ok;
  if v_ok is distinct from true then raise exception 'Dashboard D3A management postflight failed.'; end if;
end
$postflight$;
notify pgrst,'reload schema';
commit;
