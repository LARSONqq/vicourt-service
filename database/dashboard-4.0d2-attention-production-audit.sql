-- Dashboard 4.0D2 Attention structural audit. MANUAL and strictly READ ONLY.
-- Catalog/baseline evidence only; runtime role/data/allocation smoke is still required.
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
  ('private.has_role(text[])','53ee6011008695bf5bba95283f571979',array['search_path=""']::text[]),
  ('public.get_report_overview_current_finance(date,bigint)','d12d67564a3b54c9e5208e8f6e56f23b',
    array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash or not p.prosecdef
    or pg_get_userbyid(p.proowner)<>'postgres' or p.proconfig is distinct from e.config)
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
    ('equipment','next_maintenance_usage',array['numeric'],false),
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
    or (e.required_not_null and not a.attnotnull)
)
$check$),
    ('operational_exact_signature_return', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_dashboard_operational_attention')=1
  and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_operational_attention(date)')
    and p.prokind='f' and p.proretset and p.prorettype='record'::regtype and p.pronargs=1 and p.pronargdefaults=0
    and p.proargnames=array['p_business_date','item_id','kind','severity','timing','title','description',
      'entity_type','entity_id','object_id','relevant_date','href']::text[]
    and p.proargmodes=array['i','t','t','t','t','t','t','t','t','t','t','t']::"char"[]
    and p.proallargtypes=array['date'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
      'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
      'text'::regtype::oid,'bigint'::regtype::oid,'bigint'::regtype::oid,'date'::regtype::oid,
      'text'::regtype::oid])
$check$),
    ('operational_security_acl', $check$
select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_dashboard_operational_attention(date)')
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
    ('operational_exact_body', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_operational_attention(date)')
  and md5(p.prosrc)='84b68bbb2972bba102c5ca846a80ec22')
$check$),
    ('operational_identity_scope_before_reads', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_operational_attention(date)')
  and position('auth.uid() is null' in p.prosrc)>0
  and position('private.is_active_user() is distinct from true' in p.prosrc)>0
  and position('select p.role::text, p.employee_id::bigint' in p.prosrc)>0
  and position($text$v_role not in ('admin','object_manager','worker')$text$ in p.prosrc)>0
  and position($text$using errcode='42501'$text$ in p.prosrc)<position('from public.object_tasks' in p.prosrc)
  and position('t.assigned_employee_id=v_employee_id' in p.prosrc)>0
  and position('o.responsible_employee_id=v_employee_id' in p.prosrc)>0
  and position('p_business_date is null or not pg_catalog.isfinite(p_business_date)' in p.prosrc)>0)
$check$),
    ('operational_exact_rules_and_limit', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_operational_attention(date)')
  and position($text$t.task_source='manual'$text$ in p.prosrc)>0
  and position($text$t.status<>'Виконано'$text$ in p.prosrc)>0
  and position('t.due_date<=p_business_date' in p.prosrc)>0
  and position($text$o.status='Під періодичним наглядом'$text$ in p.prosrc)>0
  and position('w.quantity<=0 or (w.quantity>0 and w.min_quantity is not null and w.quantity<=w.min_quantity)' in p.prosrc)>0
  and position('e.current_usage>=e.next_maintenance_usage' in p.prosrc)>0
  and position('e.next_service_date<=p_business_date+7' in p.prosrc)>0
  and position('select e.id,e.name,e.next_service_date,' in p.prosrc)>0
  and position('select e.*' in lower(p.prosrc))=0
  and position('limit 8' in p.prosrc)>0
  and position('object_payments' in p.prosrc)=0 and position('object_payment_schedule' in p.prosrc)=0
  and position('purchase_price' in p.prosrc)=0 and position('service_cost' in p.prosrc)=0
  and position('hourly_rate' in p.prosrc)=0)
$check$),
    ('finance_exact_signature_return', $check$
select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_dashboard_finance_attention')=1
  and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_finance_attention(date)')
    and p.prokind='f' and p.proretset and p.prorettype='record'::regtype and p.pronargs=1 and p.pronargdefaults=0
    and p.proargnames=array['p_business_date','item_id','kind','severity','timing','title','description',
      'entity_type','entity_id','object_id','relevant_date','href','amount']::text[]
    and p.proargmodes=array['i','t','t','t','t','t','t','t','t','t','t','t','t']::"char"[]
    and p.proallargtypes=array['date'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
      'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
      'text'::regtype::oid,'bigint'::regtype::oid,'bigint'::regtype::oid,'date'::regtype::oid,
      'text'::regtype::oid,'numeric'::regtype::oid])
$check$),
    ('finance_security_acl', $check$
select exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.get_dashboard_finance_attention(date)')
    and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.provolatile='s'
    and p.proconfig=array['search_path=""','extra_float_digits=3']::text[] and l.lanname='plpgsql'
    and not p.proisstrict and not p.proleakproof and p.proparallel='u'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE')
    and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
        or a.privilege_type<>'EXECUTE' or a.is_grantable))
$check$),
    ('finance_exact_body', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_finance_attention(date)')
  and md5(p.prosrc)='f66d1a1533c26c065096c44218ce5063')
$check$),
    ('finance_guards_before_reads', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_finance_attention(date)')
  and position('auth.uid() is null' in p.prosrc)>0
  and position('private.is_active_user() is distinct from true' in p.prosrc)>0
  and position($text$private.has_role(array['admin','object_manager']::text[]) is distinct from true$text$ in p.prosrc)>0
  and position($text$using errcode='42501'$text$ in p.prosrc)<position('from public.object_payments' in p.prosrc)
  and position('p_business_date is null or not pg_catalog.isfinite(p_business_date)' in p.prosrc)>0
  and position($text$'worker'$text$ in p.prosrc)=0)
$check$),
    ('finance_allocation_and_destination', $check$
select exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_dashboard_finance_attention(date)')
  and position('greatest(c.value,0::double precision)' in p.prosrc)>0
  and position('order by c.due_date,c.created_at,c.row_id' in p.prosrc)>0
  and position('rows between unbounded preceding and 1 preceding' in p.prosrc)>0
  and position('r.due_date<=p_business_date and r.remaining>0' in p.prosrc)>0
  and position('?tab=finance#payment-schedule' in p.prosrc)>0
  and position('limit 8' in p.prosrc)>0)
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
  and has_table_privilege('postgres','public.object_payments','SELECT')
  and has_table_privilege('postgres','public.object_payment_schedule','SELECT')
  and has_schema_privilege('authenticated','public','USAGE')
  and has_function_privilege('postgres','auth.uid()','EXECUTE')
  and has_function_privilege('postgres','private.is_active_user()','EXECUTE')
  and has_function_privilege('postgres','private.has_role(text[])','EXECUTE')
$check$),
    ('operational_preservation_baseline', $check$
select obj_description(to_regprocedure('public.get_dashboard_operational_attention(date)'),'pg_proc')=snapshot::text
from (select jsonb_build_object(
  'version','dashboard-attention-operational:v1',
  'guards',(select md5(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
    order by p.oid::regprocedure::text)::text) from pg_proc p where p.oid=to_regprocedure('private.is_active_user()')),
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
) snapshot) b
$check$),
    ('finance_preservation_baseline', $check$
select obj_description(to_regprocedure('public.get_dashboard_finance_attention(date)'),'pg_proc')=snapshot::text
from (select jsonb_build_object(
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
) snapshot) b
$check$),
    ('reports_b1_b2_b3_preserved', $check$
select not exists(select 1 from (values
  ('public.get_report_overview_current_finance(date,bigint)','d12d67564a3b54c9e5208e8f6e56f23b',
    array['search_path=""','extra_float_digits=3']::text[]),
  ('public.get_report_overview_period_totals(date,date,bigint,bigint,text)','b7b83ede0fc3114d40055c4e9e6447af',
    array['search_path=""','extra_float_digits=3']::text[]),
  ('public.get_report_overview_material_totals(date,date,bigint)','12ac36c5e65ffcf130187d0ab09f2da1',
    array['search_path=""','extra_float_digits=3']::text[])
  ) e(signature,hash,config) left join pg_proc p on p.oid=to_regprocedure(e.signature)
  where p.oid is null or p.prokind<>'f' or md5(p.prosrc)<>e.hash
    or pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef or p.provolatile<>'s'
    or p.proconfig is distinct from e.config
    or not has_function_privilege('authenticated',p.oid,'EXECUTE')
    or has_function_privilege('anon',p.oid,'EXECUTE')
    or has_function_privilege('service_role',p.oid,'EXECUTE')
    or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in (p.proowner,to_regrole('authenticated')::oid)
        or a.privilege_type<>'EXECUTE' or a.is_grantable))
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
        'evidence',jsonb_build_object('sqlstate',v_state,'message',v_message),'notes','Isolated catalog check failed; never skipped.'));
    end;
  end loop;
  perform set_config('vicourt.dashboard_attention_audit',v_results::text,true);
end
$audit$;

with checks as (
  select * from jsonb_to_recordset(current_setting('vicourt.dashboard_attention_audit')::jsonb)
    as r(check_name text,status text,evidence jsonb,notes text)
), output as (
  select check_name,status,evidence,notes,0 summary_order from checks
  union all
  select 'DASHBOARD_4_0D2_ATTENTION_STRUCTURAL_SUMMARY',
    case when count(*)=16 and bool_and(status='PASS') then 'PASS' else 'FAIL' end,
    jsonb_build_object('checks',count(*),'failed',count(*) filter(where status<>'PASS'),
      'expected_checks',16,'runtime_authorization_tested',false,'requires_session_smoke',true),
    'Smoke admin/manager both feeds; worker operational only; client/inactive denied; unlinked worker scope; allocation parity; all results bounded to 8.',1
  from checks
)
select check_name,status,evidence,notes from output order by summary_order,check_name;
commit;
