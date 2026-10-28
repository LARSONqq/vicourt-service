-- Reports 4.0B3. MANUAL additive PRE, postgres, before app deployment.
-- Creates ONLY the compact Overview material-total RPC. No data/table/RLS/policy/index changes.
-- Existing material detail RPCs and application paths remain intact and rollback-safe.
begin;
set local search_path = pg_catalog;

do $preflight$
declare
  v_check record;
  v_ok boolean;
  v_baseline jsonb;
  v_existing text;
begin
  if current_user <> 'postgres' then
    raise exception 'Run Reports PRE as postgres.';
  end if;

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
    ('reviewed_report_dependencies', $check$
select not exists (
  select 1 from (values
    ('public.get_management_objects()','560eee0c68a2e9373a0afcc35dac4217',array['search_path=""']::text[]),
    ('public.get_management_materials()','da483c30d763d4fc679756f59157617a',array['search_path=""']::text[]),
    ('public.get_report_material_ledger_cutover()','d44103fa9e49df644ca45c46d8e2f161',array['search_path=""']::text[]),
    ('public.get_report_object_material_costs(timestamptz,timestamptz,bigint)','f1e1f1f065faf020deb7577d4fe3ce07',array['search_path=""']::text[]),
    ('public.get_report_overview_current_finance(date,bigint)','d12d67564a3b54c9e5208e8f6e56f23b',array['search_path=""','extra_float_digits=3']::text[]),
    ('public.get_report_overview_period_totals(date,date,bigint,bigint,text)','b7b83ede0fc3114d40055c4e9e6447af',array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash
    or not p.prosecdef or p.provolatile<>'s' or pg_get_userbyid(p.proowner)<>'postgres'
    or p.proconfig is distinct from e.config
)
$check$),
    ('required_columns', $check$
select not exists (
  select 1 from (values
    ('objects','id',array['int4','int8'],true),
    ('warehouse_ledger_cutovers','ledger_version',array['int2'],true),
    ('warehouse_ledger_cutovers','boundary_movement_id',array['int8'],true),
    ('warehouse_ledger_cutovers','cutover_at',array['timestamptz'],true),
    ('materials','id',array['int4','int8'],true),
    ('materials','object_id',array['int4','int8'],true),
    ('materials','quantity',array['numeric'],false),
    ('materials','price',array['numeric'],false),
    ('materials','created_at',array['timestamptz'],false),
    ('warehouse_movements','id',array['int4','int8'],true),
    ('warehouse_movements','object_id',array['int4','int8'],false),
    ('warehouse_movements','movement_code',array['text','varchar'],true),
    ('warehouse_movements','ledger_version',array['int2'],true),
    ('warehouse_movements','total_cost',array['numeric'],false),
    ('warehouse_movements','created_at',array['timestamptz'],false)
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
  and has_table_privilege('postgres','public.warehouse_ledger_cutovers','SELECT')
  and has_table_privilege('postgres','public.materials','SELECT')
  and has_table_privilege('postgres','public.warehouse_movements','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
  and has_function_privilege('postgres','private.has_role(text[])','EXECUTE')
$check$)
  ) c(check_name,query) loop
    execute v_check.query into v_ok;
    if v_ok is distinct from true then
      raise exception 'Reports B3 prerequisite failed: %',v_check.check_name;
    end if;
  end loop;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_report_overview_material_totals'
      and (p.oid<>coalesce(to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)'),0::oid)
        or p.prokind<>'f' or pg_get_userbyid(p.proowner)<>'postgres'
        or md5(p.prosrc)<>'12ac36c5e65ffcf130187d0ab09f2da1')
  ) then
    raise exception 'Existing material-total RPC drift/overload; review required.';
  end if;

  select snapshot into v_baseline from (
-- REPORTS PRESERVATION BEGIN
select jsonb_build_object(
  'version','reports-material-totals:v1',
  'b1_baseline',obj_description(to_regprocedure('public.get_report_overview_current_finance(date,bigint)'),'pg_proc'),
  'b2_baseline',obj_description(to_regprocedure('public.get_report_overview_period_totals(date,date,bigint,bigint,text)'),'pg_proc'),
  'functions',(select md5(coalesce(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
    order by p.oid::regprocedure::text)::text,'[]'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (
      (n.nspname='public' and (p.proname like 'get_report_%' or p.proname like 'get_management_%')
        and p.proname<>'get_report_overview_material_totals')
      or (n.nspname='private' and p.proname in ('is_active_user','has_role')))),
  'policies',(select md5(coalesce(jsonb_agg(to_jsonb(p)
    order by p.schemaname,p.tablename,p.policyname)::text,'[]'))
    from pg_policies p where p.schemaname='public' and p.tablename in (
      'objects','materials','warehouse_ledger_cutovers','warehouse_movements')),
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
      'objects','materials','warehouse_ledger_cutovers','warehouse_movements'))
)
-- REPORTS PRESERVATION END
  ) b(snapshot);

  v_existing := obj_description(
    to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)'),
    'pg_proc'
  );
  if to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)') is not null
    and (v_existing is null or v_existing<>v_baseline::text)
  then
    raise exception 'Preserved Reports contracts drift; do not refresh the baseline.';
  end if;
  perform set_config('vicourt.reports_material_totals_baseline',v_baseline::text,true);
end
$preflight$;

create or replace function public.get_report_overview_material_totals(
  p_date_from date,
  p_date_to date,
  p_object_id bigint default null
)
returns table (
  materials_cost numeric,
  exact_cost numeric,
  legacy_approximate_cost numeric,
  period_mode text,
  cutover_at timestamptz
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
  v_boundary_movement_id bigint;
  v_cutover_at timestamptz;
  v_period_mode text;
  v_exact_cost numeric := 0;
  v_legacy_cost numeric := 0;
begin
  -- Same reviewed B1/B2 management boundary; before ANY domain/material read.
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
  if p_object_id is not null and p_object_id <= 0 then
    raise exception 'Некоректний об’єкт звіту.' using errcode = '22023';
  end if;
  if p_object_id is not null and not exists (
    select 1 from public.objects o where o.id = p_object_id
  ) then
    raise exception 'Некоректний об’єкт звіту.' using errcode = '22023';
  end if;

  -- Explicit Kyiv boundaries match getKyivDateStartUtc(dateFrom/dateTo+1).
  v_timestamp_from := p_date_from::timestamp at time zone 'Europe/Kyiv';
  v_timestamp_to_exclusive := (p_date_to + 1)::timestamp at time zone 'Europe/Kyiv';

  select c.boundary_movement_id, c.cutover_at
  into v_boundary_movement_id, v_cutover_at
  from public.warehouse_ledger_cutovers c
  where c.ledger_version = 3;

  if v_cutover_at is null or v_timestamp_to_exclusive <= v_cutover_at then
    v_period_mode := 'legacy';
  elsif v_timestamp_from >= v_cutover_at then
    v_period_mode := 'exact';
  else
    v_period_mode := 'mixed';
  end if;

  if v_period_mode in ('exact','mixed') then
    select coalesce(sum(case
      when wm.movement_code in ('issue_to_object','direct_to_object') then wm.total_cost
      when wm.movement_code in ('return_from_object','direct_object_reversal') then -wm.total_cost
      else 0::numeric
    end order by wm.id),0::numeric)
    into v_exact_cost
    from public.warehouse_movements wm
    where wm.ledger_version = 3
      and wm.id > v_boundary_movement_id
      and wm.object_id is not null
      and wm.created_at >= v_timestamp_from
      and wm.created_at < v_timestamp_to_exclusive
      and wm.movement_code in (
        'issue_to_object','return_from_object','direct_to_object','direct_object_reversal')
      and (p_object_id is null or wm.object_id = p_object_id);
  end if;

  if v_period_mode = 'legacy' then
    with normalized_rows as materialized (
      select m.id::bigint as row_id,
        case when m.quantity is null or m.quantity::text in ('NaN','Infinity','-Infinity')
          then 0::double precision else m.quantity::double precision end as quantity,
        case when m.price is null or m.price::text in ('NaN','Infinity','-Infinity')
          then 0::double precision else m.price::double precision end as price
      from public.materials m
      where m.object_id > 0
        and m.created_at >= v_timestamp_from
        and m.created_at < v_timestamp_to_exclusive
        and (p_object_id is null or m.object_id = p_object_id)
    ), cent_inputs as (
      select r.row_id, r.quantity * r.price * 100::double precision as scaled
      from normalized_rows r
    ), rounded_rows as (
      select c.row_id, case
        when c.scaled - pg_catalog.floor(c.scaled) >= 0.5::double precision
          then pg_catalog.floor(c.scaled) + 1::double precision
        else pg_catalog.floor(c.scaled)
      end as cents
      from cent_inputs c
    )
    select (coalesce(sum(r.cents order by r.row_id),0::double precision)
      / 100::double precision)::text::numeric
    into v_legacy_cost
    from rounded_rows r;
  end if;

  return query select
    case when v_period_mode = 'legacy' then v_legacy_cost else v_exact_cost end,
    v_exact_cost,
    case when v_period_mode = 'mixed' then null::numeric else v_legacy_cost end,
    v_period_mode,
    v_cutover_at;
end
$function$;

alter function public.get_report_overview_material_totals(date,date,bigint) owner to postgres;
revoke all on function public.get_report_overview_material_totals(date,date,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.get_report_overview_material_totals(date,date,bigint)
  to authenticated;

do $postflight$
declare v_ok boolean;
begin
  execute format(
    'comment on function public.get_report_overview_material_totals(date,date,bigint) is %L',
    current_setting('vicourt.reports_material_totals_baseline')
  );
  select exists (
    select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
      and p.prokind='f' and pg_get_userbyid(p.proowner)='postgres'
      and p.prosecdef and p.provolatile='s' and l.lanname='plpgsql'
      and p.proconfig=array['search_path=""','extra_float_digits=3']::text[]
      and p.proretset and p.prorettype='record'::regtype
      and p.pronargs=3 and p.pronargdefaults=1
      and p.proargnames=array['p_date_from','p_date_to','p_object_id','materials_cost',
        'exact_cost','legacy_approximate_cost','period_mode','cutover_at']::text[]
      and p.proargmodes=array['i','i','i','t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['date'::regtype::oid,'date'::regtype::oid,'bigint'::regtype::oid,
        'numeric'::regtype::oid,'numeric'::regtype::oid,'numeric'::regtype::oid,
        'text'::regtype::oid,'timestamptz'::regtype::oid]
      and pg_get_expr(p.proargdefaults,0)='NULL::bigint'
      and md5(p.prosrc)='12ac36c5e65ffcf130187d0ab09f2da1'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists (
        select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
          or a.privilege_type<>'EXECUTE' or a.is_grantable
      )
      and obj_description(p.oid,'pg_proc')=current_setting('vicourt.reports_material_totals_baseline')
  ) into v_ok;
  if v_ok is distinct from true then
    raise exception 'Reports B3 postflight contract failed.';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
commit;
