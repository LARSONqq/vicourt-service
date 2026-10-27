-- Reports 4.0B2. MANUAL additive PRE, postgres, before app deployment.
-- Creates ONLY the period KPI RPC. No table/RLS/policy/index/material/cutover changes.
-- B1/old full-detail application paths remain intact and rollback-safe.
-- Dependency pins: deployed B1/guards + reviewed management work-log projection.
-- After B2 use this phase's audit: historical B1's closed-world function baseline
-- necessarily sees the added B2 RPC as an addition; do NOT refresh its old baseline.
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
    ('reviewed_work_snapshot_and_b1', $check$
select not exists (
  select 1 from (values
    ('public.get_management_work_logs()','5600ef1df52c5c49a8a6d43a171dbe0e',array['search_path=""']::text[]),
    ('public.get_report_overview_current_finance(date,bigint)','d12d67564a3b54c9e5208e8f6e56f23b',
      array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash or not p.prosecdef
    or p.provolatile<>'s' or pg_get_userbyid(p.proowner)<>'postgres'
    or p.proconfig is distinct from e.config
)
$check$),
    ('required_columns', $check$
select not exists (
  select 1 from (values
    ('objects','id',array['int4','int8'],true),
    ('employees','id',array['int4','int8'],true),
    ('work_logs','id',array['int4','int8'],true),
    ('work_logs','object_id',array['int4','int8'],false),
    ('work_logs','employee_id',array['int4','int8'],false),
    ('work_logs','work_date',array['date'],false),
    ('work_logs','hours',array['numeric'],false),
    ('work_logs','hourly_rate',array['numeric'],false),
    ('object_expenses','id',array['int4','int8'],true),
    ('object_expenses','object_id',array['int4','int8'],false),
    ('object_expenses','expense_date',array['date'],false),
    ('object_expenses','category',array['text','varchar'],false),
    ('object_expenses','amount',array['numeric'],false),
    ('object_payments','id',array['int4','int8'],true),
    ('object_payments','object_id',array['int4','int8'],false),
    ('object_payments','payment_date',array['date'],false),
    ('object_payments','created_at',array['timestamptz'],true),
    ('object_payments','amount',array['numeric'],false),
    ('warehouse_purchases','id',array['int4','int8'],true),
    ('warehouse_purchases','status',array['text','varchar'],false),
    ('warehouse_purchases','purchased_at',array['timestamptz'],false),
    ('warehouse_purchases','quantity',array['numeric'],false),
    ('warehouse_purchases','purchase_price',array['numeric'],false)
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
  and has_table_privilege('postgres','public.employees','SELECT')
  and has_table_privilege('postgres','public.work_logs','SELECT')
  and has_table_privilege('postgres','public.object_expenses','SELECT')
  and has_table_privilege('postgres','public.object_payments','SELECT')
  and has_table_privilege('postgres','public.warehouse_purchases','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
  and has_function_privilege('postgres','private.has_role(text[])','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then raise exception 'Reports B2 prerequisite failed: %',v_check.check_name; end if;
  end loop;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_report_overview_period_totals'
      and (p.oid<>coalesce(to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres' or md5(p.prosrc)<>'b7b83ede0fc3114d40055c4e9e6447af'))
  then raise exception 'Existing period RPC drift/overload; review required.'; end if;
  select snapshot into v_baseline from (
-- REPORTS PRESERVATION BEGIN
select jsonb_build_object(
  'version','reports-period-totals:v1',
  'b1_baseline',obj_description(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),'pg_proc'),
  'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
    order by p.oid::regprocedure::text)::text,'[]'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (
      (n.nspname='public' and (p.proname like 'get_report_%' or p.proname like 'get_management_%')
        and p.proname<>'get_report_overview_period_totals')
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
  v_existing := obj_description(to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)'),'pg_proc');
  if to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then raise exception 'Preserved Reports contracts drift; do not refresh the baseline.'; end if;
  perform set_config('vicourt.reports_period_totals_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_report_overview_period_totals(
  p_date_from date,
  p_date_to date,
  p_object_id bigint default null,
  p_employee_id bigint default null,
  p_expense_category text default null
)
returns table (
  labor_cost numeric,
  other_expenses_cost numeric,
  total_hours numeric,
  purchased_cost numeric,
  payments_received numeric
)
language plpgsql
stable
security definer
set search_path = ''
set extra_float_digits = 3
as $function$
declare
  v_timestamp_from timestamptz;
  v_timestamp_to_exclusive timestamptz;
begin
  -- Same reviewed B1 management boundary; before ANY domain/finance read.
  if auth.uid() is null
    or private.is_active_user() is distinct from true
    or private.has_role(array['admin','object_manager']::text[]) is distinct from true
  then
    raise exception 'Недостатньо прав для перегляду звітів.' using errcode = '42501';
  end if;
  if p_date_from is null or p_date_to is null
    or not pg_catalog.isfinite(p_date_from) or not pg_catalog.isfinite(p_date_to)
    or p_date_from > p_date_to
  then
    raise exception 'Некоректний період звіту.' using errcode = '22007';
  end if;
  if (p_object_id is not null and p_object_id <= 0)
    or (p_employee_id is not null and p_employee_id <= 0)
    or (p_expense_category is not null and p_expense_category <> all(
      array['Доставка','Оренда техніки','Паливо','Послуги','Інше']::text[]))
  then
    raise exception 'Некоректні фільтри звіту.' using errcode = '22023';
  end if;
  if p_object_id is not null and not exists (
    select 1 from public.objects o where o.id = p_object_id
  ) then
    raise exception 'Некоректний об’єкт звіту.' using errcode = '22023';
  end if;
  if p_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = p_employee_id
  ) then
    raise exception 'Некоректний працівник звіту.' using errcode = '22023';
  end if;

  -- Equivalent to getKyivDateStartUtc(dateFrom / addDaysToDateValue(dateTo,1)).
  -- Explicit timezone, independent of session/DB timezone; DST is per boundary.
  v_timestamp_from := p_date_from::timestamp at time zone 'Europe/Kyiv';
  v_timestamp_to_exclusive := (p_date_to + 1)::timestamp at time zone 'Europe/Kyiv';

  return query
  with raw_rows as (
    -- get_management_work_logs() exposes the historical w.hourly_rate snapshot.
    -- TS skips invalid/nonpositive object IDs only for labor and expenses.
    select 'labor'::text as kind, w.id::bigint as row_id,
      w.hours as first_value, w.hourly_rate as second_value,
      null::date as payment_date, null::timestamptz as created_at
    from public.work_logs w
    where w.work_date >= p_date_from and w.work_date <= p_date_to
      and w.object_id > 0
      and (p_object_id is null or w.object_id = p_object_id)
      and (p_employee_id is null or w.employee_id = p_employee_id)
    union all
    select 'expense', e.id::bigint, e.amount, null::numeric, null::date, null::timestamptz
    from public.object_expenses e
    where e.expense_date >= p_date_from and e.expense_date <= p_date_to
      and e.object_id > 0
      and (p_object_id is null or e.object_id = p_object_id)
      and (p_expense_category is null or e.category = p_expense_category)
    union all
    select 'payment', p.id::bigint, p.amount, null::numeric, p.payment_date, p.created_at
    from public.object_payments p
    where p.payment_date >= p_date_from and p.payment_date <= p_date_to
      and (p_object_id is null or p.object_id = p_object_id)
    union all
    -- Purchases intentionally ignore object/employee/category filters.
    select 'purchase', p.id::bigint, p.quantity, p.purchase_price, null::date, null::timestamptz
    from public.warehouse_purchases p
    where p.status = 'Закуплено'
      and p.purchased_at >= v_timestamp_from and p.purchased_at < v_timestamp_to_exclusive
  ),
  normalized_rows as materialized (
    -- Report toSafeNumber(): Number(null/non-finite) contributes zero.
    select r.kind, r.row_id, r.payment_date, r.created_at,
      case when r.first_value is null or r.first_value::text in ('NaN','Infinity','-Infinity')
        then 0::double precision else r.first_value::double precision end as first_value,
      case when r.second_value is null or r.second_value::text in ('NaN','Infinity','-Infinity')
        then 0::double precision else r.second_value::double precision end as second_value
    from raw_rows r
  ),
  cent_inputs as (
    select r.kind, r.row_id, r.payment_date, r.created_at,
      (case when r.kind = 'payment' then r.first_value
        else r.first_value * r.second_value end) * 100::double precision as scaled
    from normalized_rows r where r.kind in ('payment','purchase')
  ),
  rounded_cents as (
    -- Same binary64 Math.round expression as B1; no decimal round(numeric,2).
    select c.*, pg_catalog.floor(c.scaled)
      + case when c.scaled - pg_catalog.floor(c.scaled) >= 0.5::double precision
          then 1::double precision else 0::double precision end as cents
    from cent_inputs c
  )
  select
    -- Labor/hours/expenses deliberately have NO per-row/final cents rounding.
    coalesce((select pg_catalog.sum(r.first_value * r.second_value order by r.row_id)
      from normalized_rows r where r.kind = 'labor'),0::double precision)::text::numeric,
    coalesce((select pg_catalog.sum(r.first_value order by r.row_id)
      from normalized_rows r where r.kind = 'expense'),0::double precision)::text::numeric,
    coalesce((select pg_catalog.sum(r.first_value order by r.row_id)
      from normalized_rows r where r.kind = 'labor'),0::double precision)::text::numeric,
    -- Purchases keep signed per-row cents. Period payments ignore negative cents.
    (coalesce((select pg_catalog.sum(c.cents order by c.row_id)
      from rounded_cents c where c.kind = 'purchase'),0::double precision) / 100::double precision)::text::numeric,
    (coalesce((select pg_catalog.sum(greatest(c.cents,0::double precision)
      order by c.payment_date desc, c.created_at desc, c.row_id desc)
      from rounded_cents c where c.kind = 'payment'),0::double precision) / 100::double precision)::text::numeric;
end
$function$;

alter function public.get_report_overview_period_totals(date,date,bigint,bigint,text) owner to postgres;
revoke all on function public.get_report_overview_period_totals(date,date,bigint,bigint,text) from public, anon, authenticated, service_role;
grant execute on function public.get_report_overview_period_totals(date,date,bigint,bigint,text) to authenticated;
do $postflight$
declare v_check record; v_ok boolean;
begin
  execute format('comment on function public.get_report_overview_period_totals(date,date,bigint,bigint,text) is %L',
    current_setting('vicourt.reports_period_totals_baseline'));
  for v_check in select * from (values
    ('exact_signature_and_return', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_report_overview_period_totals')=1
  and exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
    and p.prokind='f' and p.proretset and p.prorettype='record'::regtype
    and p.pronargs=5 and p.proargnames=array['p_date_from','p_date_to','p_object_id','p_employee_id','p_expense_category',
      'labor_cost','other_expenses_cost','total_hours','purchased_cost','payments_received']::text[]
    and p.proargmodes=array['i','i','i','i','i','t','t','t','t','t']::"char"[]
    and p.proallargtypes=array['date'::regtype::oid,'date'::regtype::oid,'bigint'::regtype::oid,
      'bigint'::regtype::oid,'text'::regtype::oid,'numeric'::regtype::oid,'numeric'::regtype::oid,
      'numeric'::regtype::oid,'numeric'::regtype::oid,'numeric'::regtype::oid]
    and p.pronargdefaults=3 and pg_get_expr(p.proargdefaults,0)='NULL::bigint, NULL::bigint, NULL::text')
$check$),
    ('exact_security_metadata', $check$
select exists (select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
    and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
    and p.proconfig=array['search_path=""','extra_float_digits=3']::text[] and l.lanname='plpgsql'
    and not p.proisstrict and not p.proleakproof and p.proparallel='u')
$check$),
    ('exact_execute_acl', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
  and has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE')
  and not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
      or a.privilege_type<>'EXECUTE' or a.is_grantable))
$check$),
    ('exact_reviewed_body', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
  and md5(p.prosrc)='b7b83ede0fc3114d40055c4e9e6447af')
$check$),
    ('guards_before_finance_reads', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
  and position('auth.uid() is null' in p.prosrc)>0
  and position('private.is_active_user() is distinct from true' in p.prosrc)>0
  and position($text$private.has_role(array['admin','object_manager']::text[]) is distinct from true$text$ in p.prosrc)>0
  and position($text$using errcode = '42501'$text$ in p.prosrc)<position('from public.objects' in p.prosrc)
  and position($text$'worker'$text$ in p.prosrc)=0)
$check$),
    ('explicit_input_validation', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
  and position('p_date_from is null or p_date_to is null' in p.prosrc)>0
  and position('not pg_catalog.isfinite(p_date_from) or not pg_catalog.isfinite(p_date_to)' in p.prosrc)>0
  and position('p_date_from > p_date_to' in p.prosrc)>0
  and position('p_object_id is not null and p_object_id <= 0' in p.prosrc)>0
  and position('p_employee_id is not null and p_employee_id <= 0' in p.prosrc)>0
  and position('select 1 from public.objects o where o.id = p_object_id' in p.prosrc)>0
  and position('select 1 from public.employees e where e.id = p_employee_id' in p.prosrc)>0
  and position($text$array['Доставка','Оренда техніки','Паливо','Послуги','Інше']::text[]$text$ in p.prosrc)>0)
$check$),
    ('date_and_filter_contract', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
  and position($text$p_date_from::timestamp at time zone 'Europe/Kyiv'$text$ in p.prosrc)>0
  and position($text$(p_date_to + 1)::timestamp at time zone 'Europe/Kyiv'$text$ in p.prosrc)>0
  and position('w.work_date >= p_date_from and w.work_date <= p_date_to' in p.prosrc)>0
  and position('e.expense_date >= p_date_from and e.expense_date <= p_date_to' in p.prosrc)>0
  and position('p.payment_date >= p_date_from and p.payment_date <= p_date_to' in p.prosrc)>0
  and position('p.purchased_at >= v_timestamp_from and p.purchased_at < v_timestamp_to_exclusive' in p.prosrc)>0
  and position('p_employee_id is null or w.employee_id = p_employee_id' in p.prosrc)>0
  and position('p_expense_category is null or e.category = p_expense_category' in p.prosrc)>0
  and position($text$p.status = 'Закуплено'$text$ in p.prosrc)>0
  and position('current_date' in lower(p.prosrc))=0 and position('now()' in lower(p.prosrc))=0)
$check$),
    ('numeric_contract', $check$
select exists (select 1 from pg_proc p where p.oid=to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)')
  and position('w.hours as first_value, w.hourly_rate as second_value' in p.prosrc)>0
  and position('r.first_value * r.second_value order by r.row_id' in p.prosrc)>0
  and position('c.scaled - pg_catalog.floor(c.scaled) >= 0.5::double precision' in p.prosrc)>0
  and position('sum(c.cents order by c.row_id)' in p.prosrc)>0
  and position('sum(greatest(c.cents,0::double precision)' in p.prosrc)>0
  and position('order by c.payment_date desc, c.created_at desc, c.row_id desc' in p.prosrc)>0
  and position('::text::numeric' in p.prosrc)>0)
$check$),
    ('preserved_reports_contracts', $check$
select obj_description(to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)'),'pg_proc') is not null
  and obj_description(to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)'),'pg_proc')=snapshot::text
from (
-- REPORTS PRESERVATION BEGIN
select jsonb_build_object(
  'version','reports-period-totals:v1',
  'b1_baseline',obj_description(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),'pg_proc'),
  'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
    order by p.oid::regprocedure::text)::text,'[]'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (
      (n.nspname='public' and (p.proname like 'get_report_%' or p.proname like 'get_management_%')
        and p.proname<>'get_report_overview_period_totals')
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
    if v_ok is distinct from true then raise exception 'Reports B2 postflight failed: %',v_check.check_name; end if;
  end loop;
end
$postflight$;
notify pgrst, 'reload schema';
commit;

