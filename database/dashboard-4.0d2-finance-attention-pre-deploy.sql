-- Dashboard 4.0D2 management finance Attention. MANUAL additive PRE; run as postgres.
-- Creates one bounded management-only RPC. No table/RLS/policy/index/data changes.
begin;
set local search_path = pg_catalog;

do $preflight$
declare v_check record; v_ok boolean; v_baseline jsonb; v_existing text;
begin
  if current_user <> 'postgres' then raise exception 'Run Dashboard D2 PRE as postgres.'; end if;
  for v_check in select * from (values
    ('reviewed_guards_and_b1', $check$
select not exists (select 1 from (values
  ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1',array['search_path=""']::text[]),
  ('private.has_role(text[])','53ee6011008695bf5bba95283f571979',array['search_path=""']::text[]),
  ('public.get_report_overview_current_finance(date,bigint)','d12d67564a3b54c9e5208e8f6e56f23b',
    array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash
    or not p.prosecdef or pg_get_userbyid(p.proowner)<>'postgres' or p.proconfig is distinct from e.config)
$check$),
    ('required_columns', $check$
select not exists (select 1 from (values
  ('objects','id',array['int4','int8'],true),('objects','name',array['text','varchar'],false),
  ('object_payments','id',array['int4','int8'],true),('object_payments','object_id',array['int4','int8'],true),
  ('object_payments','amount',array['numeric'],false),
  ('object_payment_schedule','id',array['int4','int8'],true),
  ('object_payment_schedule','object_id',array['int4','int8'],true),
  ('object_payment_schedule','title',array['text','varchar'],false),
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
  and has_table_privilege('postgres','public.object_payments','SELECT')
  and has_table_privilege('postgres','public.object_payment_schedule','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
  and has_function_privilege('postgres','private.has_role(text[])','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Dashboard D2 finance prerequisite failed: %',v_check.check_name; end if;
  end loop;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_dashboard_finance_attention'
      and (p.oid<>coalesce(to_regprocedure('public.get_dashboard_finance_attention(date)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres'
        or md5(p.prosrc)<>'f66d1a1533c26c065096c44218ce5063'))
  then raise exception 'Existing finance Attention RPC drift/overload; review required.'; end if;

-- FINANCE PRESERVATION BEGIN
  select jsonb_build_object(
    'version','dashboard-attention-finance:v1',
    'b1_baseline',obj_description(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),'pg_proc'),
    'functions',(select md5(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
      'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
      order by p.oid::regprocedure::text)::text) from pg_proc p where p.oid in (
        to_regprocedure('private.is_active_user()'),to_regprocedure('private.has_role(text[])'),
        to_regprocedure('public.get_report_overview_current_finance(date,bigint)'))),
    'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)::text,'[]'))
      from pg_policies p where p.schemaname='public' and p.tablename in
        ('objects','object_payments','object_payment_schedule')),
    'relations',(select md5(jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,
      'force_rls',c.relforcerowsecurity) order by c.oid::regclass::text)::text)
      from pg_class c where c.oid in (to_regclass('public.objects'),to_regclass('public.object_payments'),
        to_regclass('public.object_payment_schedule')))
  ) into v_baseline;
-- FINANCE PRESERVATION END
  v_existing:=obj_description(to_regprocedure('public.get_dashboard_finance_attention(date)'),'pg_proc');
  if to_regprocedure('public.get_dashboard_finance_attention(date)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved finance Dashboard contracts drift; do not refresh baseline.'; end if;
  perform set_config('vicourt.dashboard_finance_attention_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_dashboard_finance_attention(p_business_date date)
returns table (
  item_id text, kind text, severity text, timing text, title text, description text,
  entity_type text, entity_id bigint, object_id bigint, relevant_date date, href text, amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
set extra_float_digits = 3
as $function$
begin
  -- MUST precede validation and every finance/domain read.
  if auth.uid() is null
    or private.is_active_user() is distinct from true
    or private.has_role(array['admin','object_manager']::text[]) is distinct from true
  then raise exception 'Недостатньо прав для перегляду фінансових попереджень.' using errcode='42501';
  end if;
  if p_business_date is null or not pg_catalog.isfinite(p_business_date) then
    raise exception 'Некоректна бізнес-дата.' using errcode='22007';
  end if;

  return query
  with money_inputs as (
    select 'payment'::text kind,p.id::bigint row_id,p.object_id::bigint object_id,
      p.amount::double precision amount,null::date due_date,null::timestamptz created_at,
      null::text schedule_title,null::text object_name
    from public.object_payments p
    union all
    select 'schedule',s.id::bigint,s.object_id::bigint,s.amount::double precision,s.due_date,s.created_at,
      s.title::text,o.name::text
    from public.object_payment_schedule s join public.objects o on o.id=s.object_id
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
  ), candidates as (
    select r.*,(case when r.due_date<p_business_date then 'payment_overdue' else 'payment_today' end)::text item_kind
    from remaining_cents r where r.due_date<=p_business_date and r.remaining>0
  )
  select (c.item_kind||':'||c.row_id)::text,c.item_kind,
    (case when c.due_date<p_business_date then 'critical' else 'warning' end)::text,
    (case when c.due_date<p_business_date then 'overdue' else 'today' end)::text,
    (case when c.due_date<p_business_date then 'Прострочений платіж' else 'Платіж сьогодні' end)::text,
    pg_catalog.left(coalesce(c.schedule_title,'Етап')||' · '||coalesce(c.object_name,'Об’єкт'),500)::text,
    'payment_schedule'::text,c.row_id::bigint,c.object_id::bigint,c.due_date,
    ('/objects/'||c.object_id||'?tab=finance#payment-schedule')::text,
    (c.remaining/100::double precision)::text::numeric
  from candidates c
  order by case when c.due_date<p_business_date then 0 else 1 end,c.due_date,c.created_at,c.row_id
  limit 8;
end
$function$;

alter function public.get_dashboard_finance_attention(date) owner to postgres;
revoke all on function public.get_dashboard_finance_attention(date) from public,anon,authenticated,service_role;
grant execute on function public.get_dashboard_finance_attention(date) to authenticated;

do $postflight$
declare v_ok boolean;
begin
  execute format('comment on function public.get_dashboard_finance_attention(date) is %L',
    current_setting('vicourt.dashboard_finance_attention_baseline'));
  select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.get_dashboard_finance_attention(date)') and p.prokind='f'
      and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
      and p.proconfig=array['search_path=""','extra_float_digits=3']::text[] and l.lanname='plpgsql'
      and p.proretset and p.prorettype='record'::regtype and p.pronargs=1 and p.pronargdefaults=0
      and p.proargnames=array['p_business_date','item_id','kind','severity','timing','title','description',
        'entity_type','entity_id','object_id','relevant_date','href','amount']::text[]
      and p.proargmodes=array['i','t','t','t','t','t','t','t','t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['date'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
        'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
        'text'::regtype::oid,'bigint'::regtype::oid,'bigint'::regtype::oid,'date'::regtype::oid,
        'text'::regtype::oid,'numeric'::regtype::oid]
      and md5(p.prosrc)='f66d1a1533c26c065096c44218ce5063'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee not in (p.proowner,to_regrole('authenticated')::oid) or a.is_grantable)
      and obj_description(p.oid,'pg_proc')=current_setting('vicourt.dashboard_finance_attention_baseline')) into v_ok;
  if v_ok is distinct from true then raise exception 'Dashboard D2 finance postflight failed.'; end if;
end
$postflight$;
notify pgrst,'reload schema';
commit;
