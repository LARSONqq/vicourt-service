-- Dashboard 4.0D3B operational widgets structural audit. MANUAL and strictly READ ONLY.
-- Catalog/baseline evidence only; runtime role/data parity smoke is still required.
begin;
set transaction read only;
set local search_path = pg_catalog;

do $audit$
declare v_check record; v_ok boolean; v_results jsonb:='[]'::jsonb; v_state text; v_message text;
begin
  for v_check in select * from (values
    ('reviewed_dependencies', $check$
select not exists(select 1 from (values
  ('private.is_active_user()','9bbc898ebc01d7371aae4e8c5de61da1',array['search_path=""']::text[]),
  ('public.get_dashboard_operational_attention(date)','84b68bbb2972bba102c5ca846a80ec22',array['search_path=""']::text[]),
  ('public.get_dashboard_finance_attention(date)','f66d1a1533c26c065096c44218ce5063',array['search_path=""','extra_float_digits=3']::text[]),
  ('public.get_dashboard_worker_object_watchlist(date)','375c13b6a13c81bf03369c4dd3d3779b',array['search_path=""']::text[]),
  ('public.get_dashboard_management_object_watchlist(date)','45b54fb2471f832aa8d52b818dceb9ea',array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash or not p.prosecdef
    or pg_get_userbyid(p.proowner)<>'postgres' or p.proconfig is distinct from e.config)
$check$),
    ('required_columns', $check$
select not exists(select 1 from (values
  ('profiles','id',array['uuid'],true),('profiles','role',array['text','varchar','user_role'],false),
  ('profiles','is_active',array['bool'],false),
  ('warehouse_items','id',array['int4','int8'],true),('warehouse_items','name',array['text','varchar'],false),
  ('warehouse_items','quantity',array['numeric'],false),('warehouse_items','min_quantity',array['numeric'],false),
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
  and has_table_privilege('postgres','public.warehouse_items','SELECT')
  and has_table_privilege('postgres','public.equipment','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
$check$),
    ('warehouse_exact_signature_return', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_dashboard_warehouse_attention_items')=1
  and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_warehouse_attention_items()')
    and p.prokind='f' and p.proretset and p.prorettype='record'::regtype
    and p.pronargs=0 and p.pronargdefaults=0
    and p.proargnames=array['item_id','name','quantity','min_quantity','stock_state']::text[]
    and p.proargmodes=array['t','t','t','t','t']::"char"[]
    and p.proallargtypes=array['bigint'::regtype::oid,'text'::regtype::oid,'numeric'::regtype::oid,
      'numeric'::regtype::oid,'text'::regtype::oid])
$check$),
    ('warehouse_security_acl', $check$
select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_dashboard_warehouse_attention_items()')
    and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
    and p.proconfig=array['search_path=""']::text[] and l.lanname='plpgsql'
    and not p.proisstrict and not p.proleakproof and p.proparallel='u'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE')
    and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
        or a.privilege_type<>'EXECUTE' or a.is_grantable))
$check$),
    ('warehouse_exact_body', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_warehouse_attention_items()')
  and md5(p.prosrc)='40cad7bc056198450ee0407df79b9689')
$check$),
    ('warehouse_rules_projection_and_bound', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_warehouse_attention_items()')
  and position('auth.uid() is null or private.is_active_user() is distinct from true' in p.prosrc)>0
  and position($text$v_role not in ('admin','object_manager','worker')$text$ in p.prosrc)>0
  and position($text$using errcode='42501'$text$ in p.prosrc)<position('from public.warehouse_items' in p.prosrc)
  and position('w.quantity<=0 or (w.quantity>0 and w.min_quantity is not null and w.quantity<=w.min_quantity)' in p.prosrc)>0
  and position($text$(case when w.quantity<=0 then 'out' else 'low' end)::text$text$ in p.prosrc)>0
  and position('order by (case when w.quantity<=0 then 0 else 1 end),w.quantity,w.id' in p.prosrc)>0
  and position('limit 5' in p.prosrc)>0
  and p.prosrc !~* $regex$select[[:space:]]+(distinct[[:space:]]+)?(p|w)[[:space:]]*\.[[:space:]]*\*$regex$
  and position('purchase_price' in p.prosrc)=0 and position('unit_price' in p.prosrc)=0
  and position('object_payments' in p.prosrc)=0 and position('service_cost' in p.prosrc)=0
  and position('hourly_rate' in p.prosrc)=0)
$check$),
    ('equipment_exact_signature_return', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_dashboard_equipment_attention_items')=1
  and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_equipment_attention_items(date)')
    and p.prokind='f' and p.proretset and p.prorettype='record'::regtype
    and p.pronargs=1 and p.pronargdefaults=0
    and p.proargnames=array['p_business_date','equipment_id','name','next_service_date','attention_state','usage_due']::text[]
    and p.proargmodes=array['i','t','t','t','t','t']::"char"[]
    and p.proallargtypes=array['date'::regtype::oid,'bigint'::regtype::oid,'text'::regtype::oid,
      'date'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid])
$check$),
    ('equipment_security_acl', $check$
select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_dashboard_equipment_attention_items(date)')
    and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
    and p.proconfig=array['search_path=""']::text[] and l.lanname='plpgsql'
    and not p.proisstrict and not p.proleakproof and p.proparallel='u'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE')
    and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
        or a.privilege_type<>'EXECUTE' or a.is_grantable))
$check$),
    ('equipment_exact_body', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_equipment_attention_items(date)')
  and md5(p.prosrc)='8e48f5499d8107c8ac985afac132506a')
$check$),
    ('equipment_rules_projection_and_bound', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_equipment_attention_items(date)')
  and position('auth.uid() is null or private.is_active_user() is distinct from true' in p.prosrc)>0
  and position($text$v_role not in ('admin','object_manager','worker')$text$ in p.prosrc)>0
  and position($text$using errcode='42501'$text$ in p.prosrc)<position('from public.equipment' in p.prosrc)
  and position('p_business_date is null or not pg_catalog.isfinite(p_business_date)' in p.prosrc)>0
  and position('e.next_service_date<=p_business_date+7' in p.prosrc)>0
  and position('e.current_usage>=e.next_maintenance_usage' in p.prosrc)>0
  and position($text$when not s.date_overdue and (s.usage_due or s.date_today) then 'due_now'$text$ in p.prosrc)>0
  and position($text$when s.equipment_status='Потребує ремонту' then 'repair_required'$text$ in p.prosrc)>0
  and position($text$when s.equipment_status='На ремонті' then 'in_repair'$text$ in p.prosrc)>0
  and position($text$when not s.date_overdue and not s.usage_due and s.date_upcoming then 'upcoming'$text$ in p.prosrc)>0
  and position($text$order by case c.attention_state when 'overdue' then 0 when 'due_now' then 1
    when 'repair_required' then 2 when 'in_repair' then 3 else 4 end,
    c.next_service_date nulls last,c.equipment_id$text$ in p.prosrc)>0
  and position('limit 5' in p.prosrc)>0
  and p.prosrc !~* $regex$select[[:space:]]+(distinct[[:space:]]+)?(p|e|s|c)[[:space:]]*\.[[:space:]]*\*$regex$
  and position('purchase_price' in p.prosrc)=0 and position('unit_price' in p.prosrc)=0
  and position('object_payments' in p.prosrc)=0 and position('service_cost' in p.prosrc)=0
  and position('hourly_rate' in p.prosrc)=0)
$check$),
    ('warehouse_preservation_baseline', $check$
select obj_description(to_regprocedure('public.get_dashboard_warehouse_attention_items()'),'pg_proc')=snapshot::text
from (select jsonb_build_object(
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
) snapshot) b
$check$),
    ('equipment_preservation_baseline', $check$
select obj_description(to_regprocedure('public.get_dashboard_equipment_attention_items(date)'),'pg_proc')=snapshot::text
from (select jsonb_build_object(
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
) snapshot) b
$check$),
    ('d2_d3a_reports_preserved', $check$
select not exists(select 1 from (values
  ('public.get_dashboard_operational_attention(date)','84b68bbb2972bba102c5ca846a80ec22',array['search_path=""']::text[]),
  ('public.get_dashboard_finance_attention(date)','f66d1a1533c26c065096c44218ce5063',array['search_path=""','extra_float_digits=3']::text[]),
  ('public.get_dashboard_worker_object_watchlist(date)','375c13b6a13c81bf03369c4dd3d3779b',array['search_path=""']::text[]),
  ('public.get_dashboard_management_object_watchlist(date)','45b54fb2471f832aa8d52b818dceb9ea',array['search_path=""','extra_float_digits=3']::text[]),
  ('public.get_report_overview_current_finance(date,bigint)','d12d67564a3b54c9e5208e8f6e56f23b',array['search_path=""','extra_float_digits=3']::text[]),
  ('public.get_report_overview_period_totals(date,date,bigint,bigint,text)','b7b83ede0fc3114d40055c4e9e6447af',array['search_path=""','extra_float_digits=3']::text[]),
  ('public.get_report_overview_material_totals(date,date,bigint)','12ac36c5e65ffcf130187d0ab09f2da1',array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash or not p.prosecdef
    or p.provolatile<>'s' or pg_get_userbyid(p.proowner)<>'postgres'
    or p.proconfig is distinct from e.config)
$check$)
  ) c(check_name,query) loop
    begin
      v_ok:=null; execute v_check.query into v_ok;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('check_name',v_check.check_name,
        'status',case when coalesce(v_ok,false) then 'PASS' else 'FAIL' end,
        'evidence',jsonb_build_object('matched',coalesce(v_ok,false)),
        'notes','Structural only; no application RPC/helper execution or business/auth row reads.'));
    exception when others then
      get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('check_name',v_check.check_name,'status','FAIL',
        'evidence',jsonb_build_object('sqlstate',v_state,'message',v_message),
        'notes','Isolated catalog check failed; never skipped.'));
    end;
  end loop;
  perform set_config('vicourt.dashboard_operational_widgets_audit',v_results::text,true);
end
$audit$;

with checks as (
  select * from jsonb_to_recordset(current_setting('vicourt.dashboard_operational_widgets_audit')::jsonb)
    as r(check_name text,status text,evidence jsonb,notes text)
), output as (
  select check_name,status,evidence,notes,0 summary_order from checks
  union all
  select 'DASHBOARD_4_0D3B_OPERATIONAL_WIDGETS_STRUCTURAL_SUMMARY',
    case when count(*)=14 and bool_and(status='PASS') then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'failed',count(*) filter(where status<>'PASS'),
      'expected_checks',14,'runtime_authorization_tested',false,'requires_session_smoke',true),
    'Smoke admin/manager/worker warehouse and equipment parity; inactive/client denied; usage-only due included; both previews bounded to 5.',1
  from checks
)
select check_name,status,evidence,notes from output order by summary_order,check_name;
commit;
