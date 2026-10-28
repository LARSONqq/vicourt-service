-- Reports 4.0B3 structural audit. MANUAL, strictly read-only.
-- Catalog inspection only: no application RPC/helper execution or business/auth row reads.
-- Structural PASS is not runtime authorization or monetary parity proof.
begin;
set transaction read only;
set local search_path = pg_catalog;

do $audit$
declare
  v_check record;
  v_ok boolean;
  v_results jsonb := '[]'::jsonb;
  v_state text;
  v_message text;
begin
  for v_check in select * from (values
    ('reviewed_dependencies', $check$
select not exists (
  select 1 from (values
    ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1',array['search_path=""']::text[]),
    ('private.has_role(text[])','53ee6011008695bf5bba95283f571979',array['search_path=""']::text[]),
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
$check$),
    ('exact_signature_and_return', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_report_overview_material_totals')=1
  and exists (select 1 from pg_proc p
    where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
      and p.prokind='f' and p.proretset and p.prorettype='record'::regtype
      and p.pronargs=3 and p.pronargdefaults=1
      and p.proargnames=array['p_date_from','p_date_to','p_object_id','materials_cost',
        'exact_cost','legacy_approximate_cost','period_mode','cutover_at']::text[]
      and p.proargmodes=array['i','i','i','t','t','t','t','t']::"char"[]
      and p.proallargtypes=array['date'::regtype::oid,'date'::regtype::oid,'bigint'::regtype::oid,
        'numeric'::regtype::oid,'numeric'::regtype::oid,'numeric'::regtype::oid,
        'text'::regtype::oid,'timestamptz'::regtype::oid]
      and pg_get_expr(p.proargdefaults,0)='NULL::bigint')
$check$),
    ('exact_security_metadata', $check$
select exists (select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
    and p.proconfig=array['search_path=""','extra_float_digits=3']::text[] and l.lanname='plpgsql'
    and not p.proisstrict and not p.proleakproof and p.proparallel='u')
$check$),
    ('exact_execute_acl', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE')
    and not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
        or a.privilege_type<>'EXECUTE' or a.is_grantable))
$check$),
    ('exact_reviewed_body', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and md5(p.prosrc)='12ac36c5e65ffcf130187d0ab09f2da1')
$check$),
    ('guards_before_domain_reads', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and position('auth.uid() is null' in p.prosrc)>0
    and position('private.is_active_user() is distinct from true' in p.prosrc)>0
    and position($text$private.has_role(array['admin','object_manager']::text[]) is distinct from true$text$ in p.prosrc)>0
    and position($text$using errcode = '42501'$text$ in p.prosrc)<position('from public.objects' in p.prosrc)
    and position($text$'worker'$text$ in p.prosrc)=0)
$check$),
    ('explicit_input_and_kyiv_boundaries', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and position('p_date_from is null or p_date_to is null' in p.prosrc)>0
    and position('not pg_catalog.isfinite(p_date_from) or not pg_catalog.isfinite(p_date_to)' in p.prosrc)>0
    and position('p_date_from > p_date_to' in p.prosrc)>0
    and position('p_object_id is not null and p_object_id <= 0' in p.prosrc)>0
    and position('select 1 from public.objects o where o.id = p_object_id' in p.prosrc)>0
    and position($text$p_date_from::timestamp at time zone 'Europe/Kyiv'$text$ in p.prosrc)>0
    and position($text$(p_date_to + 1)::timestamp at time zone 'Europe/Kyiv'$text$ in p.prosrc)>0
    and position('current_date' in lower(p.prosrc))=0 and position('now()' in lower(p.prosrc))=0)
$check$),
    ('mode_and_cutover_contract', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and position('where c.ledger_version = 3' in p.prosrc)>0
    and position('v_timestamp_to_exclusive <= v_cutover_at' in p.prosrc)>0
    and position('v_timestamp_from >= v_cutover_at' in p.prosrc)>0
    and position($text$case when v_period_mode = 'mixed' then null::numeric else v_legacy_cost end$text$ in p.prosrc)>0)
$check$),
    ('exact_movement_contract', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and position('wm.ledger_version = 3' in p.prosrc)>0
    and position('wm.id > v_boundary_movement_id' in p.prosrc)>0
    and position($text$wm.movement_code in ('issue_to_object','direct_to_object')$text$ in p.prosrc)>0
    and position($text$wm.movement_code in ('return_from_object','direct_object_reversal')$text$ in p.prosrc)>0
    and position('wm.created_at >= v_timestamp_from' in p.prosrc)>0
    and position('wm.created_at < v_timestamp_to_exclusive' in p.prosrc)>0
    and position('greatest(' in lower(p.prosrc))=0)
$check$),
    ('legacy_binary64_contract', $check$
select exists (select 1 from pg_proc p
  where p.oid=to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)')
    and position('r.quantity * r.price * 100::double precision as scaled' in p.prosrc)>0
    and position('c.scaled - pg_catalog.floor(c.scaled) >= 0.5::double precision' in p.prosrc)>0
    and position('sum(r.cents order by r.row_id)' in p.prosrc)>0
    and position('::text::numeric' in p.prosrc)>0
    and position('round(m.quantity * m.price' in lower(p.prosrc))=0)
$check$),
    ('preserved_reports_contracts', $check$
select obj_description(to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)'),'pg_proc') is not null
  and obj_description(to_regprocedure('public.get_report_overview_material_totals(date,date,bigint)'),'pg_proc')=snapshot::text
from (
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
) b(snapshot)
$check$)
  ) c(check_name,query) loop
    begin
      v_ok := null;
      execute v_check.query into v_ok;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'check_name',v_check.check_name,
        'status',case when coalesce(v_ok,false) then 'PASS' else 'FAIL' end,
        'evidence',jsonb_build_object('matched',coalesce(v_ok,false)),
        'notes','Structural only; no business/auth rows read or application helper/RPC executed.'));
    exception when others then
      get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'check_name',v_check.check_name,'status','FAIL',
        'evidence',jsonb_build_object('sqlstate',v_state,'message',v_message),
        'notes','Isolated catalog check failed; never skipped.'));
    end;
  end loop;
  perform set_config('vicourt.reports_material_totals_audit',v_results::text,true);
end
$audit$;

with checks as (
  select * from jsonb_to_recordset(current_setting('vicourt.reports_material_totals_audit')::jsonb)
    as r(check_name text,status text,evidence jsonb,notes text)
), output as (
  select check_name,status,evidence,notes,0 as summary_order from checks
  union all
  select 'REPORTS_4_0B3_MATERIAL_TOTALS_STRUCTURAL_SUMMARY',
    case when count(*)=13 and bool_and(status='PASS') then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'failed',count(*) filter(where status<>'PASS'),
      'expected_checks',13,'runtime_authorization_tested',false,'requires_session_smoke',true),
    'Smoke admin/manager legacy/exact/mixed parity and Kyiv/DST bounds; worker/client/inactive denied 42501; invalid inputs denied; Overview/summary compact while detail/Excel rollback paths remain intact.',1
  from checks
)
select check_name,status,evidence,notes from output order by summary_order,check_name;
commit;
