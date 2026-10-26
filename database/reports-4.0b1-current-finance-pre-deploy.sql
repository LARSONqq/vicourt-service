-- Reports 4.0B1. MANUAL additive PRE; run as postgres before app deploy.
-- No table/RLS/index/old RPC changes. Old application remains rollback-safe.
-- Scope and guard source pins are reviewed repository/production contracts.
begin;
set local search_path = pg_catalog;

do $preflight$
declare v_check record; v_ok boolean; v_baseline jsonb; v_existing text;
begin
  if current_user <> 'postgres' then raise exception 'Run Reports PRE as postgres.'; end if;
  for v_check in select * from (values
    ('reviewed_guard_bodies', $check$
select not exists (
  select 1 from (values
    ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1'),
    ('private.has_role(text[])','53ee6011008695bf5bba95283f571979')
  ) e(signature,hash) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash
    or not p.prosecdef or pg_get_userbyid(p.proowner)<>'postgres'
    or p.proconfig is distinct from array['search_path=""']::text[]
    or not has_function_privilege('authenticated',p.oid,'EXECUTE')
)
$check$),
    ('reviewed_management_object_scope', $check$
select exists (
  select 1 from pg_proc p where p.oid=to_regprocedure('public.get_management_objects()')
    and p.prokind='f' and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
    and p.proconfig=array['search_path=""']::text[]
    and md5(p.prosrc)='560eee0c68a2e9373a0afcc35dac4217'
)
$check$),
    ('required_columns', $check$
select not exists (
  select 1 from (values
    ('objects','id',array['int4','int8'],true),
    ('objects','client_price',array['numeric'],false),
    ('object_payments','id',array['int4','int8'],true),
    ('object_payments','object_id',array['int4','int8'],true),
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
  where a.attname is null or t.typnamespace<>'pg_catalog'::regnamespace
    or not (t.typname::text=any(e.types)) or (e.required_not_null and not a.attnotnull)
)
$check$),
    ('definer_read_prerequisites', $check$
select exists (select 1 from pg_roles where rolname='postgres' and (rolsuper or rolbypassrls))
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
    if v_ok is distinct from true then raise exception 'Reports prerequisite failed: %',v_check.check_name; end if;
  end loop;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_report_overview_current_finance'
      and (p.oid<>coalesce(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres' or md5(p.prosrc)<>'d12d67564a3b54c9e5208e8f6e56f23b'))
  then raise exception 'Existing current-finance RPC drift/overload; review required.'; end if;
  select snapshot into v_baseline from (
-- REPORTS PRESERVATION BEGIN
select jsonb_build_object(
  'version','reports-current-finance:v1',
  'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
    order by p.oid::regprocedure::text)::text,'[]'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (
      (n.nspname='public' and (p.proname like 'get_report_%' or p.proname like 'get_management_%')
        and p.proname<>'get_report_overview_current_finance')
      or (n.nspname='private' and p.proname in ('is_active_user','has_role')))),
  'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p)
    order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
    from pg_policies p where p.schemaname='public' and p.tablename in (
      'objects','object_payments','object_payment_schedule','object_expenses','work_logs',
      'employees','materials','warehouse_items','warehouse_movements','warehouse_purchases')),
  'relations',(select md5(coalesce(jsonb_agg(jsonb_build_object(
    'name',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object(
      'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
      'acl',a.attacl::text,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid))
      order by a.attnum) from pg_attribute a
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname)
      from pg_constraint k where k.conrelid=c.oid),
    'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by i.indexrelid::regclass::text)
      from pg_index i where i.indrelid=c.oid),
    'triggers',(select jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),
      'enabled',t.tgenabled) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal))
    order by c.oid::regclass::text)::text,'[]'))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname in (
      'objects','object_payments','object_payment_schedule','object_expenses','work_logs',
      'employees','materials','warehouse_items','warehouse_movements','warehouse_purchases'))
)
-- REPORTS PRESERVATION END
  ) b(snapshot);
  v_existing := obj_description(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),'pg_proc');
  if to_regprocedure('public.get_report_overview_current_finance(date,bigint)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved Reports contracts drift; do not refresh the baseline.'; end if;
  perform set_config('vicourt.reports_current_finance_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_report_overview_current_finance(
  p_business_date date,
  p_object_id bigint default null
)
returns table (
  outstanding_receivables numeric,
  objects_without_client_price bigint,
  overdue_schedule_amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
set extra_float_digits = 3
as $function$
begin
  -- MUST precede validation/object existence and every finance read.
  if auth.uid() is null
    or private.is_active_user() is distinct from true
    or private.has_role(array['admin','object_manager']::text[]) is distinct from true
  then
    raise exception 'Недостатньо прав для перегляду звітів.' using errcode = '42501';
  end if;
  if p_business_date is null or not pg_catalog.isfinite(p_business_date) then
    raise exception 'Некоректна бізнес-дата звіту.' using errcode = '22007';
  end if;
  if p_object_id is not null and p_object_id <= 0 then
    raise exception 'Некоректний об’єкт звіту.' using errcode = '22023';
  end if;
  -- Reviewed get_management_objects() domain: all objects, management only.
  if p_object_id is not null and not exists (
    select 1 from public.objects o where o.id = p_object_id
  ) then
    raise exception 'Некоректний об’єкт звіту.' using errcode = '22023';
  end if;

  return query
  with scoped_objects as materialized (
    select o.id, o.client_price
    from public.objects o where p_object_id is null or o.id = p_object_id
  ),
  money_inputs as (
    select 'price'::text as kind, o.id::bigint as row_id, o.id::bigint as object_id,
      o.client_price::double precision as amount, null::date as due_date, null::timestamptz as created_at
    from scoped_objects o
    union all
    select 'payment', p.id::bigint, p.object_id::bigint, p.amount::double precision, null::date, null::timestamptz
    from public.object_payments p join scoped_objects o on o.id = p.object_id
    union all
    select 'schedule', s.id::bigint, s.object_id::bigint, s.amount::double precision, s.due_date, s.created_at
    from public.object_payment_schedule s join scoped_objects o on o.id = s.object_id
  ),
  scaled_money as (
    select m.*, case when m.amount is null
      or m.amount in ('NaN'::double precision,'Infinity'::double precision,'-Infinity'::double precision)
      then 0::double precision else m.amount * 100::double precision end as scaled
    from money_inputs m
  ),
  cents as materialized (
    -- Canonical JS Math.round(Number(amount) * 100), including binary64 edges
    -- (1.005 -> 100 cents). NOT numeric round(), nor floor(scaled + 0.5),
    -- whose addition itself may round. Ties go toward positive infinity.
    select m.*, pg_catalog.floor(m.scaled)
      + case when m.scaled - pg_catalog.floor(m.scaled) >= 0.5::double precision
          then 1::double precision else 0::double precision end as value
    from scaled_money m
  ),
  payments as (
    select c.object_id, pg_catalog.sum(greatest(c.value,0::double precision) order by c.row_id) as paid
    from cents c where c.kind = 'payment' group by c.object_id
  ),
  roundtrip_inputs as (
    -- TS converts price and summed payment cents / 100, then back into cents.
    select c.object_id, 'price'::text as kind, (c.value / 100::double precision) * 100::double precision as scaled
    from cents c where c.kind = 'price'
    union all
    select p.object_id, 'paid', (p.paid / 100::double precision) * 100::double precision from payments p
  ),
  roundtrip_cents as (
    select r.object_id, r.kind, pg_catalog.floor(r.scaled)
      + case when r.scaled - pg_catalog.floor(r.scaled) >= 0.5::double precision
          then 1::double precision else 0::double precision end as value
    from roundtrip_inputs r
  ),
  object_balances as (
    select o.id, o.client_price,
      case when o.client_price is null
        or o.client_price::text in ('NaN','Infinity','-Infinity') then 0::double precision
        else greatest(price.value - coalesce(paid.value,0::double precision),0::double precision)
      end as remaining
    from scoped_objects o
    join roundtrip_cents price on price.object_id=o.id and price.kind='price'
    left join roundtrip_cents paid on paid.object_id=o.id and paid.kind='paid'
  ),
  ordered_schedule as (
    select c.*, greatest(c.value,0::double precision) as planned,
      pg_catalog.min(c.row_id) over (partition by c.object_id) as object_first_id,
      coalesce(pg_catalog.sum(greatest(c.value,0::double precision)) over (
        partition by c.object_id order by c.due_date, c.created_at, c.row_id
        rows between unbounded preceding and 1 preceding
      ),0::double precision) as planned_before
    from cents c where c.kind = 'schedule'
  ),
  overdue as (
    select s.object_first_id, s.due_date, s.created_at, s.row_id,
      ((s.planned - least(greatest(coalesce(p.value,0::double precision) - s.planned_before,
        0::double precision),s.planned)) / 100::double precision) * 100::double precision as scaled
    from ordered_schedule s
    left join roundtrip_cents p on p.object_id=s.object_id and p.kind='paid'
    where s.due_date < p_business_date
  ),
  overdue_cents as (
    -- TS re-normalizes each remainingAmount/overdueAmount into integer cents.
    select o.object_first_id, o.due_date, o.created_at, o.row_id, pg_catalog.floor(o.scaled)
      + case when o.scaled - pg_catalog.floor(o.scaled) >= 0.5::double precision
          then 1::double precision else 0::double precision end as value
    from overdue o
  )
  -- Preserve JS Number on the numeric wire (including large safe-cent values).
  -- Direct float8::numeric rounds to DBL_DIG; float8::text with the fixed
  -- extra_float_digits setting is round-trip precise. See PostgreSQL numeric types.
  -- The schedule map in TS visits objects by first schedule id, then sorted rows.
  select
    coalesce((select pg_catalog.sum(b.remaining / 100::double precision order by b.id)
      from object_balances b),0::double precision)::text::numeric,
    (select pg_catalog.count(*) from scoped_objects o where o.client_price is null),
    (coalesce((select pg_catalog.sum(o.value order by o.object_first_id,o.due_date,o.created_at,o.row_id)
      from overdue_cents o),0::double precision) / 100::double precision)::text::numeric;
end
$function$;

alter function public.get_report_overview_current_finance(date,bigint) owner to postgres;
revoke all on function public.get_report_overview_current_finance(date,bigint) from public, anon, authenticated, service_role;
grant execute on function public.get_report_overview_current_finance(date,bigint) to authenticated;

do $postflight$
declare v_check record; v_ok boolean;
begin
  execute format('comment on function public.get_report_overview_current_finance(date,bigint) is %L',
    current_setting('vicourt.reports_current_finance_baseline'));
  for v_check in select * from (values
    ('exact_signature_and_return', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_report_overview_current_finance')=1
  and exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_current_finance(date,bigint)')
    and p.prokind='f' and p.proretset and p.prorettype='record'::regtype
    and p.pronargs=2 and p.proargnames=array['p_business_date','p_object_id',
      'outstanding_receivables','objects_without_client_price','overdue_schedule_amount']::text[]
    and p.proargmodes=array['i','i','t','t','t']::"char"[]
    and p.proallargtypes=array['date'::regtype::oid,'bigint'::regtype::oid,'numeric'::regtype::oid,
      'bigint'::regtype::oid,'numeric'::regtype::oid]
    and p.pronargdefaults=1 and pg_get_expr(p.proargdefaults,0)='NULL::bigint')
$check$),
    ('exact_security_metadata', $check$
select exists (select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_report_overview_current_finance(date,bigint)')
    and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
    and p.proconfig=array['search_path=""','extra_float_digits=3']::text[] and l.lanname='plpgsql'
    and not p.proisstrict and not p.proleakproof and p.proparallel='u')
$check$),
    ('exact_execute_acl', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_current_finance(date,bigint)')
  and has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE')
  and not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
      or a.privilege_type<>'EXECUTE' or a.is_grantable))
$check$),
    ('exact_reviewed_body', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_current_finance(date,bigint)')
  and md5(p.prosrc)='d12d67564a3b54c9e5208e8f6e56f23b')
$check$),
    ('guards_before_finance_reads', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_current_finance(date,bigint)')
  and position('auth.uid() is null' in p.prosrc)>0
  and position('private.is_active_user() is distinct from true' in p.prosrc)>0
  and position($text$private.has_role(array['admin','object_manager']::text[]) is distinct from true$text$ in p.prosrc)>0
  and position($text$using errcode = '42501'$text$ in p.prosrc)<position('from public.objects' in p.prosrc)
  and position($text$'worker'$text$ in p.prosrc)=0)
$check$),
    ('explicit_date_and_object_validation', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_current_finance(date,bigint)')
  and position('p_business_date is null or not pg_catalog.isfinite(p_business_date)' in p.prosrc)>0
  and position('p_object_id is not null and p_object_id <= 0' in p.prosrc)>0
  and position('select 1 from public.objects o where o.id = p_object_id' in p.prosrc)>0
  and position('current_date' in lower(p.prosrc))=0 and position('now()' in lower(p.prosrc))=0)
$check$),
    ('cents_and_allocation_contract', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_current_finance(date,bigint)')
  and position('m.amount * 100::double precision' in p.prosrc)>0
  and position('m.scaled - pg_catalog.floor(m.scaled) >= 0.5::double precision' in p.prosrc)>0
  and position('order by c.due_date, c.created_at, c.row_id' in p.prosrc)>0
  and position('rows between unbounded preceding and 1 preceding' in p.prosrc)>0
  and position('where s.due_date < p_business_date' in p.prosrc)>0)
$check$),
    ('preserved_reports_contracts', $check$
select obj_description(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),'pg_proc') is not null
  and obj_description(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),'pg_proc')=snapshot::text
from (
-- REPORTS PRESERVATION BEGIN
select jsonb_build_object(
  'version','reports-current-finance:v1',
  'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
    order by p.oid::regprocedure::text)::text,'[]'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (
      (n.nspname='public' and (p.proname like 'get_report_%' or p.proname like 'get_management_%')
        and p.proname<>'get_report_overview_current_finance')
      or (n.nspname='private' and p.proname in ('is_active_user','has_role')))),
  'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p)
    order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
    from pg_policies p where p.schemaname='public' and p.tablename in (
      'objects','object_payments','object_payment_schedule','object_expenses','work_logs',
      'employees','materials','warehouse_items','warehouse_movements','warehouse_purchases')),
  'relations',(select md5(coalesce(jsonb_agg(jsonb_build_object(
    'name',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object(
      'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
      'acl',a.attacl::text,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid))
      order by a.attnum) from pg_attribute a
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname)
      from pg_constraint k where k.conrelid=c.oid),
    'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by i.indexrelid::regclass::text)
      from pg_index i where i.indrelid=c.oid),
    'triggers',(select jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),
      'enabled',t.tgenabled) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal))
    order by c.oid::regclass::text)::text,'[]'))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname in (
      'objects','object_payments','object_payment_schedule','object_expenses','work_logs',
      'employees','materials','warehouse_items','warehouse_movements','warehouse_purchases'))
)
-- REPORTS PRESERVATION END
) b(snapshot)
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Reports postflight failed: %',v_check.check_name; end if;
  end loop;
end
$postflight$;
notify pgrst, 'reload schema';
commit;
