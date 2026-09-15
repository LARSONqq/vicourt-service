-- Security / DB Hardening 1C: production function/RPC security inventory.
-- Strictly read-only. The script returns one consolidated result table and
-- does not change functions, ACLs, default privileges, RLS or application data.

begin;
set transaction read only;

with source_contracts(
  source_order,
  regprocedure_name,
  source_reference,
  expected_security_mode,
  expected_guard,
  expected_execute,
  finance_sensitive
) as (
  values
    (1, 'public.get_employee_directory_workloads()'::text, 'database/employees-2.0-pre-deploy.sql'::text, 'DEFINER'::text, 'MANAGEMENT'::text, 'AUTHENTICATED'::text, false),
    (2, 'public.get_employee_profile_kpis(bigint)', 'database/employees-2.0-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (3, 'public.get_management_employee_actors(bigint)', 'database/employees-2.0-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (10, 'private.append_equipment_usage_log(bigint,numeric,date,text,text,uuid,text,boolean)', 'database/equipment-2.1-pre-deploy.sql', 'DEFINER', 'INTERNAL', 'INTERNAL_ONLY', false),
    (11, 'public.sync_equipment_maintenance_task(bigint)', 'database/equipment-2.1-pre-deploy.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', false),
    (12, 'public.configure_equipment_usage_schedule(bigint,text,numeric,numeric)', 'database/equipment-2.1-pre-deploy.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', false),
    (13, 'public.record_equipment_usage(bigint,numeric,date,text,text)', 'database/equipment-2.1-pre-deploy.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', false),
    (14, 'public.complete_equipment_maintenance_v2(bigint,bigint,numeric,text,text,numeric)', 'database/equipment-2.1-pre-deploy.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', true),
    (15, 'public.complete_equipment_maintenance(bigint,bigint,numeric,text,text)', 'database/equipment-2.1-pre-deploy.sql + database/security-db-hardening-1c-a-deploy.sql', 'DEFINER', 'INTERNAL', 'SERVICE_ROLE_ONLY', true),
    (16, 'public.complete_equipment_maintenance(bigint,numeric,text,text)', 'database/equipment-2.1-pre-deploy.sql + database/security-db-hardening-1c-a-deploy.sql', 'DEFINER', 'INTERNAL', 'SERVICE_ROLE_ONLY', true),
    (17, 'public.create_equipment_service_record_v2(bigint,text,date,numeric,text,text,date,numeric)', 'database/equipment-2.1-pre-deploy.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', true),
    (18, 'public.void_equipment_service_record(bigint,text)', 'database/equipment-2.1-pre-deploy.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', true),
    (19, 'public.get_management_equipment_service_records(bigint)', 'database/equipment-3.0-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (20, 'public.get_management_equipment_service_cost_kpis(bigint)', 'database/equipment-3.0-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (21, 'public.record_equipment_work_session(bigint,numeric,date,bigint,bigint,text,uuid)', 'database/equipment-3.1-work-sessions-pre-deploy.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', false),
    (30, 'public.get_management_objects()', 'database/object-3.0-security-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (31, 'public.get_management_materials()', 'database/object-3.0-security-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (32, 'public.get_management_work_logs()', 'database/object-3.0-security-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (33, 'public.get_management_employees()', 'database/object-3.0-security-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (34, 'public.get_management_warehouse_items()', 'database/object-3.0-security-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (40, 'public.get_report_material_ledger_cutover()', 'database/reports-3.0.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (41, 'public.get_report_object_material_costs(timestamptz,timestamptz,bigint)', 'database/reports-3.0.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (50, 'private.touch_task_template_updated_at()', 'database/tasks-2.1-pre-deploy.sql', 'INVOKER', 'TRIGGER', 'TRIGGER_ONLY', false),
    (51, 'private.disable_task_template_without_target()', 'database/tasks-2.1-pre-deploy.sql', 'INVOKER', 'TRIGGER', 'TRIGGER_ONLY', false),
    (52, 'private.assert_task_template_management()', 'database/tasks-2.1-pre-deploy.sql', 'INVOKER', 'MANAGEMENT', 'INTERNAL_ONLY', false),
    (53, 'private.resolve_task_assignee_name(bigint)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'INTERNAL', 'INTERNAL_ONLY', false),
    (54, 'private.task_recurrence_due_date(date,text,integer,bigint)', 'database/tasks-2.1-pre-deploy.sql', 'INVOKER', 'INTERNAL', 'INTERNAL_ONLY', false),
    (55, 'private.next_task_recurrence_slot(date,text,integer,bigint,date)', 'database/tasks-2.1-pre-deploy.sql', 'INVOKER', 'INTERNAL', 'INTERNAL_ONLY', false),
    (56, 'private.create_task_template_occurrence(bigint,bigint,date)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'INTERNAL', 'INTERNAL_ONLY', false),
    (57, 'private.guard_recurring_task_mutation()', 'database/tasks-2.1-post-deploy.sql', 'INVOKER', 'TRIGGER', 'TRIGGER_ONLY', false),
    (58, 'public.create_task_template(text,text,text,bigint,bigint,text,bigint,text,integer,date,boolean)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (59, 'public.update_task_template(bigint,text,text,text,bigint,text,integer,date)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (60, 'public.activate_task_template_series(bigint,text,bigint,bigint,date)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (61, 'public.disable_task_template(bigint)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (62, 'public.create_manual_task_from_template(bigint,text,bigint,bigint,date,bigint)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', false),
    (63, 'public.complete_manual_recurring_task(bigint)', 'database/tasks-2.1-pre-deploy.sql', 'DEFINER', 'ACTIVE_USER', 'AUTHENTICATED', false),
    (70, 'private.current_ledger_actor_name()', 'database/warehouse-3.0-pre-deploy.sql', 'DEFINER', 'INTERNAL', 'INTERNAL_ONLY', false),
    (71, 'public.prevent_warehouse_movement_mutation()', 'database/warehouse-3.0-pre-deploy.sql', 'INVOKER', 'TRIGGER', 'TRIGGER_ONLY', false),
    (72, 'public.create_warehouse_item_with_opening_balance(text,text,numeric,text,numeric,numeric,numeric,text)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', true),
    (73, 'public.delete_warehouse_item(bigint)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', true),
    (74, 'public.adjust_warehouse_stock(bigint,text,numeric,numeric,text)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', true),
    (75, 'public.allocate_warehouse_material(bigint,bigint,numeric)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (76, 'public.return_object_material_to_warehouse(bigint,bigint,numeric)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (77, 'public.change_allocated_material_quantity(bigint,bigint,numeric)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (78, 'public.create_direct_object_material(bigint,text,numeric,text,numeric)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (79, 'public.update_direct_object_material(bigint,bigint,text,numeric,text,numeric)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (80, 'public.delete_material_with_stock_restore(bigint,bigint)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (81, 'public.complete_warehouse_purchase(bigint)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true),
    (82, 'public.create_warehouse_movement(bigint,bigint,text,numeric,text)', 'database/warehouse-3.0-role-hotfix.sql', 'DEFINER', 'ADMIN', 'AUTHENTICATED', true),
    (83, 'public.create_or_add_warehouse_purchase(bigint,numeric,numeric,text,text)', 'database/security-db-hardening-1c-a-deploy.sql', 'DEFINER', 'MANAGEMENT', 'AUTHENTICATED', true)
),
app_rpc_usage(
  function_name,
  caller_area,
  expected_guard,
  expected_execute,
  finance_sensitive
) as (
  values
    ('create_or_add_warehouse_purchase'::text, 'Purchases mutation; canonical recovered SQL: database/security-db-hardening-1c-a-deploy.sql'::text, 'MANAGEMENT'::text, 'AUTHENTICATED'::text, true),
    ('reschedule_equipment_maintenance_task', 'Equipment maintenance mutation; SQL source definition is absent from repo', 'ADMIN', 'AUTHENTICATED', false),
    ('acquire_push_evaluator_lease', 'Server-side automatic push evaluator', 'INTERNAL', 'SERVICE_ROLE_ONLY', false),
    ('release_push_evaluator_lease', 'Server-side automatic push evaluator', 'INTERNAL', 'SERVICE_ROLE_ONLY', false),
    ('claim_push_notification_candidates', 'Server-side automatic push delivery', 'INTERNAL', 'SERVICE_ROLE_ONLY', false),
    ('complete_push_notification_claims', 'Server-side automatic push delivery', 'INTERNAL', 'SERVICE_ROLE_ONLY', false),
    ('resolve_missing_push_notification_states', 'Server-side automatic push repair', 'INTERNAL', 'SERVICE_ROLE_ONLY', false)
),
source_resolved as (
  select
    source.*,
    pg_catalog.to_regprocedure(source.regprocedure_name)::oid as production_oid
  from source_contracts source
),
function_catalog as (
  select
    function_row.oid as function_oid,
    namespace_row.nspname::text as schema_name,
    function_row.proname::text as function_name,
    pg_catalog.pg_get_function_identity_arguments(function_row.oid)
      as identity_arguments,
    pg_catalog.pg_get_function_arguments(function_row.oid)
      as full_arguments,
    format(
      '%I.%I(%s)',
      namespace_row.nspname,
      function_row.proname,
      pg_catalog.pg_get_function_identity_arguments(function_row.oid)
    ) as function_signature,
    pg_catalog.pg_get_userbyid(function_row.proowner) as owner_name,
    case
      when function_row.prosecdef then 'DEFINER'
      else 'INVOKER'
    end as security_mode,
    language_row.lanname::text as language_name,
    case function_row.provolatile
      when 'i' then 'IMMUTABLE'
      when 's' then 'STABLE'
      when 'v' then 'VOLATILE'
      else function_row.provolatile::text
    end as volatility,
    function_row.proconfig,
    function_row.proacl,
    function_row.proacl::text as raw_function_acl,
    pg_catalog.pg_get_functiondef(function_row.oid) as function_definition,
    regexp_replace(
      lower(pg_catalog.pg_get_functiondef(function_row.oid)),
      '[[:space:]]+',
      '',
      'g'
    ) as normalized_definition,
    search_path_config.search_path_setting,
    function_row.prosecdef as is_security_definer,
    (
      function_row.prorettype = 'pg_catalog.trigger'::regtype
      or exists (
        select 1
        from pg_catalog.pg_trigger trigger_row
        where trigger_row.tgfoid = function_row.oid
          and not trigger_row.tgisinternal
      )
    ) as is_trigger_function,
    exists (
      select 1
      from pg_catalog.aclexplode(
        case
          when function_row.proacl is null then
            pg_catalog.acldefault('f', function_row.proowner)
          when pg_catalog.array_ndims(function_row.proacl) = 1 then
            function_row.proacl
          else pg_catalog.acldefault('f', function_row.proowner)
        end
      ) acl_entry
      where acl_entry.grantee = 0
        and acl_entry.privilege_type = 'EXECUTE'
    ) as public_execute,
    case
      when pg_catalog.to_regrole('anon') is null then null
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('anon'),
        function_row.oid,
        'EXECUTE'
      )
    end as anon_execute,
    case
      when pg_catalog.to_regrole('authenticated') is null then null
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('authenticated'),
        function_row.oid,
        'EXECUTE'
      )
    end as authenticated_execute,
    case
      when pg_catalog.to_regrole('service_role') is null then null
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('service_role'),
        function_row.oid,
        'EXECUTE'
      )
    end as service_role_execute
  from pg_catalog.pg_proc function_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  join pg_catalog.pg_language language_row
    on language_row.oid = function_row.prolang
  left join lateral (
    select config_entry as search_path_setting
    from unnest(
      coalesce(function_row.proconfig, array[]::text[])
    ) config_entry
    where config_entry like 'search_path=%'
    limit 1
  ) search_path_config on true
  where namespace_row.nspname in ('public', 'private')
    and function_row.prokind in ('f', 'p')
    and not exists (
      select 1
      from pg_catalog.pg_depend dependency
      where dependency.classid = 'pg_catalog.pg_proc'::regclass
        and dependency.objid = function_row.oid
        and dependency.deptype = 'e'
    )
),
function_guards as (
  select
    function_row.*,
    (
      function_row.normalized_definition like
        '%private.is_active_user()%'
      or function_row.normalized_definition like
        '%private.assert_task_template_management()%'
    ) as has_active_user_guard,
    (
      function_row.normalized_definition like '%private.has_role%'
      and function_row.normalized_definition like '%admin%'
      and function_row.normalized_definition like '%object_manager%'
    )
    or function_row.normalized_definition like
      '%private.assert_task_template_management()%' as has_management_guard,
    (
      function_row.normalized_definition like '%private.is_admin()%'
      or (
        function_row.normalized_definition like '%private.has_role%'
        and function_row.normalized_definition like '%admin%'
        and function_row.normalized_definition not like '%object_manager%'
      )
    ) as has_admin_guard,
    function_row.normalized_definition like '%auth.uid()%'
      as has_auth_uid_guard,
    case
      when function_row.search_path_setting is null then
        case
          when function_row.is_security_definer then
            'MISSING_FIXED_SEARCH_PATH'
          else 'INVOKER_SESSION_PATH'
        end
      when replace(function_row.search_path_setting, ' ', '') in (
        'search_path=',
        'search_path=""'
      ) then 'FIXED_EMPTY'
      else 'FIXED_NONEMPTY_REVIEW'
    end as search_path_status,
    case
      when function_row.is_security_definer
        and replace(
          coalesce(function_row.search_path_setting, ''),
          ' ',
          ''
        ) in ('search_path=', 'search_path=""')
        then 'ENFORCED_BY_EMPTY_SEARCH_PATH'
      when function_row.is_security_definer then
        'NEEDS_MANUAL_REFERENCE_REVIEW'
      else 'INVOKER_CONTEXT'
    end as object_reference_status
  from function_catalog function_row
),
function_guard_status as (
  select
    function_row.*,
    case
      when function_row.is_trigger_function then 'TRIGGER_CONTEXT'
      when function_row.has_management_guard
        and function_row.has_active_user_guard
        then 'ACTIVE_MANAGEMENT_ROLE_GUARD'
      when function_row.has_admin_guard
        and function_row.has_active_user_guard
        then 'ACTIVE_ADMIN_ROLE_GUARD'
      when function_row.has_active_user_guard then 'ACTIVE_USER_GUARD'
      when function_row.has_auth_uid_guard then 'AUTH_UID_ONLY'
      else 'NO_INTERNAL_AUTH_GUARD'
    end as internal_guard_status
  from function_guards function_row
),
production_with_source as (
  select
    function_row.*,
    source.source_order,
    source.regprocedure_name as source_signature,
    source.source_reference,
    source.expected_security_mode,
    coalesce(source.expected_guard, app_usage.expected_guard)
      as expected_guard,
    coalesce(source.expected_execute, app_usage.expected_execute)
      as expected_execute,
    coalesce(
      source.finance_sensitive,
      app_usage.finance_sensitive,
      function_row.normalized_definition ~
        '(cost|price|payment|expense|hourly_rate|purchase_price|unit_price|total_cost)'
    ) as finance_sensitive,
    app_usage.caller_area,
    source.production_oid is not null as has_source_contract
  from function_guard_status function_row
  left join source_resolved source
    on source.production_oid = function_row.function_oid
  left join app_rpc_usage app_usage
    on app_usage.function_name = function_row.function_name
),
contract_analysis as (
  select
    function_row.*,
    case function_row.expected_guard
      when 'ADMIN' then
        function_row.has_active_user_guard
        and function_row.has_admin_guard
      when 'MANAGEMENT' then
        function_row.has_active_user_guard
        and function_row.has_management_guard
      when 'ACTIVE_USER' then function_row.has_active_user_guard
      when 'TRIGGER' then function_row.is_trigger_function
      when 'INTERNAL' then true
      else true
    end as source_guard_matches,
    case function_row.expected_execute
      when 'AUTHENTICATED' then
        not function_row.public_execute
        and not coalesce(function_row.anon_execute, false)
        and coalesce(function_row.authenticated_execute, false)
      when 'INTERNAL_ONLY' then
        not function_row.public_execute
        and not coalesce(function_row.anon_execute, false)
        and not coalesce(function_row.authenticated_execute, false)
      when 'TRIGGER_ONLY' then
        not function_row.public_execute
        and not coalesce(function_row.anon_execute, false)
        and not coalesce(function_row.authenticated_execute, false)
      when 'SERVICE_ROLE_ONLY' then
        not function_row.public_execute
        and not coalesce(function_row.anon_execute, false)
        and not coalesce(function_row.authenticated_execute, false)
        and coalesce(function_row.service_role_execute, false)
      else true
    end as source_execute_matches,
    (
      function_row.public_execute
      or coalesce(function_row.anon_execute, false)
      or (
        function_row.expected_execute in (
          'INTERNAL_ONLY',
          'TRIGGER_ONLY',
          'SERVICE_ROLE_ONLY'
        )
        and coalesce(function_row.authenticated_execute, false)
      )
    ) as broad_execute,
    (
      function_row.is_security_definer
      and coalesce(function_row.authenticated_execute, false)
      and not function_row.is_trigger_function
      and function_row.internal_guard_status = 'NO_INTERNAL_AUTH_GUARD'
    ) as missing_internal_guard,
    (
      function_row.finance_sensitive
      and coalesce(function_row.authenticated_execute, false)
      and function_row.internal_guard_status not in (
        'ACTIVE_ADMIN_ROLE_GUARD',
        'ACTIVE_MANAGEMENT_ROLE_GUARD'
      )
      and not function_row.is_trigger_function
    ) as finance_worker_exposure_candidate
  from production_with_source function_row
),
classified_functions as (
  select
    function_row.*,
    case
      when function_row.has_source_contract
        and (
          function_row.security_mode <> function_row.expected_security_mode
          or function_row.search_path_status <> 'FIXED_EMPTY'
          or not function_row.source_guard_matches
          or not function_row.source_execute_matches
        ) then 'DRIFTED_DEFINITION'
      when function_row.has_source_contract then 'SOURCE_CANONICAL_MATCH'
      else 'PRODUCTION_ONLY'
    end as source_alignment,
    case
      when function_row.is_trigger_function then 'TRIGGER_FUNCTION'
      when function_row.is_security_definer
        and function_row.search_path_status = 'MISSING_FIXED_SEARCH_PATH'
        then 'MISSING_FIXED_SEARCH_PATH'
      when function_row.broad_execute then 'EXECUTE_TOO_BROAD'
      when function_row.missing_internal_guard
        then 'MISSING_INTERNAL_ROLE_GUARD'
      when function_row.expected_execute = 'INTERNAL_ONLY'
        then 'INTERNAL_ONLY'
      when function_row.internal_guard_status =
        'ACTIVE_MANAGEMENT_ROLE_GUARD'
        then 'MANAGEMENT_RPC'
      when function_row.has_source_contract then 'SAFE_CANONICAL'
      else 'NEEDS_MANUAL_REVIEW'
    end as classification,
    case
      when function_row.is_security_definer
        and function_row.search_path_status = 'MISSING_FIXED_SEARCH_PATH'
        then 'CRITICAL'
      when function_row.finance_worker_exposure_candidate then 'HIGH'
      when function_row.is_security_definer
        and function_row.broad_execute
        and function_row.internal_guard_status in (
          'NO_INTERNAL_AUTH_GUARD',
          'AUTH_UID_ONLY'
        ) then 'HIGH'
      when function_row.missing_internal_guard then 'HIGH'
      when function_row.broad_execute then 'MEDIUM'
      when function_row.has_source_contract
        and (
          function_row.security_mode <> function_row.expected_security_mode
          or function_row.search_path_status <> 'FIXED_EMPTY'
          or not function_row.source_guard_matches
          or not function_row.source_execute_matches
        ) then 'MEDIUM'
      when not function_row.has_source_contract then 'MEDIUM'
      else 'LOW'
    end as risk_level
  from contract_analysis function_row
),
function_rows as (
  select
    1000 + row_number() over (
      order by function_row.schema_name, function_row.function_signature
    ) as result_order,
    'FUNCTION'::text as row_kind,
    function_row.schema_name,
    function_row.function_name,
    function_row.identity_arguments,
    function_row.full_arguments,
    function_row.function_signature,
    function_row.security_mode,
    function_row.owner_name,
    function_row.language_name,
    function_row.volatility,
    function_row.search_path_status,
    coalesce(
      array_to_string(function_row.proconfig, ', '),
      '(none)'
    ) as proconfig,
    function_row.object_reference_status,
    coalesce(function_row.raw_function_acl, '(default ACL)')
      as raw_function_acl,
    function_row.public_execute,
    function_row.anon_execute,
    function_row.authenticated_execute,
    function_row.service_role_execute,
    format(
      'PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s; app_roles=%s',
      function_row.public_execute,
      coalesce(function_row.anon_execute::text, 'role missing'),
      coalesce(function_row.authenticated_execute::text, 'role missing'),
      coalesce(function_row.service_role_execute::text, 'role missing'),
      case
        when not coalesce(function_row.authenticated_execute, false) then
          'none via authenticated'
        when function_row.internal_guard_status =
          'ACTIVE_MANAGEMENT_ROLE_GUARD' then 'admin + object_manager'
        when function_row.internal_guard_status =
          'ACTIVE_ADMIN_ROLE_GUARD' then 'admin'
        when function_row.internal_guard_status = 'ACTIVE_USER_GUARD' then
          'admin + object_manager + worker (active users)'
        when function_row.internal_guard_status = 'TRIGGER_CONTEXT' then
          'trigger only expected'
        else 'authenticated without proven role guard'
      end
    ) as execute_contract,
    function_row.internal_guard_status,
    function_row.is_trigger_function,
    function_row.finance_sensitive,
    function_row.classification,
    function_row.risk_level,
    case
      when function_row.is_trigger_function
        and function_row.broad_execute then
          'Keep trigger binding; revoke direct EXECUTE from PUBLIC/anon/authenticated unless production proves a direct caller.'
      when function_row.is_trigger_function then
        'Keep trigger function and current trigger binding; no direct API execution is needed.'
      when function_row.search_path_status = 'MISSING_FIXED_SEARCH_PATH'
        then
          'Block cleanup deployment until function is recreated with a fixed safe search_path and qualified references.'
      when function_row.finance_worker_exposure_candidate then
        'Review immediately: restrict EXECUTE and/or add an active admin/management guard before relying on this RPC.'
      when function_row.broad_execute then
        'Revoke PUBLIC/anon EXECUTE; preserve only explicitly intended role grants.'
      when function_row.missing_internal_guard then
        'Add an internal active-user/role guard or revoke authenticated EXECUTE.'
      when not function_row.has_source_contract then
        'Recover canonical source definition and compare exact body/signature before any ALTER or REVOKE.'
      when function_row.expected_execute = 'INTERNAL_ONLY' then
        'Keep non-API; ensure PUBLIC/anon/authenticated EXECUTE remain revoked.'
      else 'Keep; no cleanup until production output is reviewed.'
    end as recommended_action,
    function_row.source_alignment,
    function_row.source_reference,
    concat_ws(
      ' | ',
      'definition_md5=' || md5(function_row.function_definition),
      'fixed_search_path=' || coalesce(
        function_row.search_path_setting,
        '(missing)'
      ),
      'source_expected_guard=' || coalesce(
        function_row.expected_guard,
        '(not in source manifest)'
      ),
      'source_expected_execute=' || coalesce(
        function_row.expected_execute,
        '(not in source manifest)'
      ),
      'app_rpc_usage=' || coalesce(function_row.caller_area, 'not found'),
      'finance_worker_exposure_candidate=' ||
        function_row.finance_worker_exposure_candidate::text
    ) as notes,
    function_row.broad_execute,
    function_row.search_path_status = 'MISSING_FIXED_SEARCH_PATH'
      as missing_search_path,
    function_row.missing_internal_guard,
    function_row.classification = 'NEEDS_MANUAL_REVIEW'
      or function_row.source_alignment in (
        'DRIFTED_DEFINITION',
        'PRODUCTION_ONLY'
      ) as manual_review
  from classified_functions function_row
),
source_only_rows as (
  select
    100 + source.source_order as result_order,
    'SOURCE_ONLY'::text as row_kind,
    split_part(source.regprocedure_name, '.', 1) as schema_name,
    split_part(
      split_part(source.regprocedure_name, '.', 2),
      '(',
      1
    ) as function_name,
    '(missing in production)'::text as identity_arguments,
    '(missing in production)'::text as full_arguments,
    source.regprocedure_name as function_signature,
    source.expected_security_mode as security_mode,
    '(missing)'::name as owner_name,
    '(missing)'::text as language_name,
    '(missing)'::text as volatility,
    '(missing)'::text as search_path_status,
    '(missing)'::text as proconfig,
    '(missing)'::text as object_reference_status,
    '(missing)'::text as raw_function_acl,
    null::boolean as public_execute,
    null::boolean as anon_execute,
    null::boolean as authenticated_execute,
    null::boolean as service_role_execute,
    'source function missing from production'::text as execute_contract,
    'NOT_AUDITABLE'::text as internal_guard_status,
    source.expected_guard = 'TRIGGER' as is_trigger_function,
    source.finance_sensitive,
    'NEEDS_MANUAL_REVIEW'::text as classification,
    case
      when source.finance_sensitive then 'HIGH'
      else 'MEDIUM'
    end as risk_level,
    'Verify deployment history; do not create automatically from this audit.'::text
      as recommended_action,
    'SOURCE_ONLY_MISSING_IN_PRODUCTION'::text as source_alignment,
    source.source_reference,
    format(
      'expected_guard=%s | expected_execute=%s',
      source.expected_guard,
      source.expected_execute
    ) as notes,
    false as broad_execute,
    false as missing_search_path,
    false as missing_internal_guard,
    true as manual_review
  from source_resolved source
  where source.production_oid is null
),
default_owner_acl as (
  select
    owner_role.rolname::text as owner_name,
    owner_role.oid as owner_oid,
    global_default.defaclacl as global_default_acl,
    schema_default.defaclacl as schema_default_acl,
    coalesce(
      global_default.defaclacl,
      pg_catalog.acldefault('f', owner_role.oid)
    ) as effective_global_acl
  from pg_catalog.pg_roles owner_role
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.nspname = 'public'
  left join pg_catalog.pg_default_acl global_default
    on global_default.defaclrole = owner_role.oid
   and global_default.defaclnamespace = 0
   and global_default.defaclobjtype = 'f'
  left join pg_catalog.pg_default_acl schema_default
    on schema_default.defaclrole = owner_role.oid
   and schema_default.defaclnamespace = namespace_row.oid
   and schema_default.defaclobjtype = 'f'
  where owner_role.rolname in ('postgres', 'supabase_admin')
),
default_acl_entries as (
  select
    owner_acl.owner_name,
    owner_acl.global_default_acl,
    owner_acl.schema_default_acl,
    'GLOBAL'::text as acl_scope,
    acl_entry.grantee,
    acl_entry.privilege_type
  from default_owner_acl owner_acl
  left join lateral pg_catalog.aclexplode(
    owner_acl.effective_global_acl
  ) acl_entry on true

  union all

  select
    owner_acl.owner_name,
    owner_acl.global_default_acl,
    owner_acl.schema_default_acl,
    'SCHEMA_PUBLIC'::text as acl_scope,
    acl_entry.grantee,
    acl_entry.privilege_type
  from default_owner_acl owner_acl
  left join lateral pg_catalog.aclexplode(
    owner_acl.schema_default_acl
  ) acl_entry on true
  where owner_acl.schema_default_acl is not null
),
default_acl_analysis as (
  select
    acl_entry.owner_name,
    format(
      'global=%s; schema_public=%s',
      coalesce(acl_entry.global_default_acl::text, '(built-in default)'),
      coalesce(acl_entry.schema_default_acl::text, '(none)')
    ) as raw_default_acl,
    coalesce(bool_or(
      acl_entry.grantee = 0
      and acl_entry.privilege_type = 'EXECUTE'
    ), false) as public_execute,
    coalesce(bool_or(
      (
        acl_entry.grantee = 0
        or acl_entry.grantee = pg_catalog.to_regrole('anon')
      )
      and acl_entry.privilege_type = 'EXECUTE'
    ), false) as anon_execute,
    coalesce(bool_or(
      (
        acl_entry.grantee = 0
        or acl_entry.grantee = pg_catalog.to_regrole('authenticated')
      )
      and acl_entry.privilege_type = 'EXECUTE'
    ), false) as authenticated_execute,
    coalesce(bool_or(
      (
        acl_entry.grantee = 0
        or acl_entry.grantee = pg_catalog.to_regrole('service_role')
      )
      and acl_entry.privilege_type = 'EXECUTE'
    ), false) as service_role_execute
  from default_acl_entries acl_entry
  group by
    acl_entry.owner_name,
    acl_entry.global_default_acl,
    acl_entry.schema_default_acl
),
default_privilege_rows as (
  select
    case owner_acl.owner_name
      when 'postgres' then 9000
      else 9001
    end as result_order,
    'FUNCTION_DEFAULT'::text as row_kind,
    'public'::text as schema_name,
    '[future functions]'::text as function_name,
    '(not applicable)'::text as identity_arguments,
    '(not applicable)'::text as full_arguments,
    format(
      '[DEFAULT PRIVILEGES] %s/public/functions',
      owner_acl.owner_name
    ) as function_signature,
    '(future object)'::text as security_mode,
    owner_acl.owner_name::name as owner_name,
    '(not applicable)'::text as language_name,
    '(not applicable)'::text as volatility,
    '(not applicable)'::text as search_path_status,
    '(not applicable)'::text as proconfig,
    '(not applicable)'::text as object_reference_status,
    coalesce(owner_acl.raw_default_acl, '(built-in default ACL)')
      as raw_function_acl,
    owner_acl.public_execute,
    owner_acl.anon_execute,
    owner_acl.authenticated_execute,
    owner_acl.service_role_execute,
    format(
      'future ACL: PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s',
      owner_acl.public_execute,
      owner_acl.anon_execute,
      owner_acl.authenticated_execute,
      owner_acl.service_role_execute
    ) as execute_contract,
    'NOT_APPLICABLE'::text as internal_guard_status,
    false as is_trigger_function,
    false as finance_sensitive,
    case
      when owner_acl.owner_name = 'postgres'
        and (
          owner_acl.public_execute
          or owner_acl.anon_execute
          or owner_acl.authenticated_execute
        ) then 'EXECUTE_TOO_BROAD'
      else 'NEEDS_MANUAL_REVIEW'
    end as classification,
    case
      when owner_acl.owner_name = 'postgres'
        and (
          owner_acl.public_execute
          or owner_acl.anon_execute
          or owner_acl.authenticated_execute
        ) then 'MEDIUM'
      else 'LOW'
    end as risk_level,
    case
      when owner_acl.owner_name = 'postgres' then
        'Future Hardening 1C deploy candidate: revoke default EXECUTE from PUBLIC, anon and authenticated; preserve explicit service_role defaults and require explicit RPC grants.'
      else
        'Observation only: do not alter supabase_admin platform-managed defaults.'
    end as recommended_action,
    'DEFAULT_PRIVILEGE_OBSERVATION'::text as source_alignment,
    'production pg_default_acl'::text as source_reference,
    'Defaults affect only future functions; no change is made by this audit.'::text
      as notes,
    owner_acl.public_execute
      or owner_acl.anon_execute
      or owner_acl.authenticated_execute as broad_execute,
    false as missing_search_path,
    false as missing_internal_guard,
    true as manual_review
  from default_acl_analysis owner_acl
),
inventory_rows as (
  select * from function_rows
  union all
  select * from source_only_rows
  union all
  select * from default_privilege_rows
),
audit_summary as (
  select
    99999 as result_order,
    'SUMMARY'::text as row_kind,
    '(public + private)'::text as schema_name,
    'HARDENING_1C_AUDIT_SUMMARY'::text as function_name,
    '(summary)'::text as identity_arguments,
    '(summary)'::text as full_arguments,
    'HARDENING_1C_AUDIT_SUMMARY'::text as function_signature,
    '(summary)'::text as security_mode,
    '(summary)'::name as owner_name,
    '(summary)'::text as language_name,
    '(summary)'::text as volatility,
    '(summary)'::text as search_path_status,
    '(summary)'::text as proconfig,
    '(summary)'::text as object_reference_status,
    '(summary)'::text as raw_function_acl,
    null::boolean as public_execute,
    null::boolean as anon_execute,
    null::boolean as authenticated_execute,
    null::boolean as service_role_execute,
    format(
      'functions=%s; security_definer=%s; safe=%s; broad_execute=%s; missing_search_path=%s; missing_guard=%s; manual_review=%s',
      count(*) filter (where inventory.row_kind = 'FUNCTION'),
      count(*) filter (
        where inventory.row_kind = 'FUNCTION'
          and inventory.security_mode = 'DEFINER'
      ),
      count(*) filter (
        where inventory.row_kind = 'FUNCTION'
          and not inventory.broad_execute
          and not inventory.missing_search_path
          and not inventory.missing_internal_guard
          and not inventory.manual_review
      ),
      count(*) filter (
        where inventory.row_kind in ('FUNCTION', 'FUNCTION_DEFAULT')
          and inventory.broad_execute
      ),
      count(*) filter (
        where inventory.row_kind = 'FUNCTION'
          and inventory.missing_search_path
      ),
      count(*) filter (
        where inventory.row_kind = 'FUNCTION'
          and inventory.missing_internal_guard
      ),
      count(*) filter (where inventory.manual_review)
    ) as execute_contract,
    '(summary)'::text as internal_guard_status,
    false as is_trigger_function,
    false as finance_sensitive,
    'NEEDS_MANUAL_REVIEW'::text as classification,
    case
      when bool_or(
        inventory.risk_level in ('CRITICAL', 'HIGH')
      ) then 'HIGH'
      when bool_or(inventory.risk_level = 'MEDIUM') then 'MEDIUM'
      else 'LOW'
    end as risk_level,
    'Review CRITICAL/HIGH first, then broad EXECUTE, triggers/internal helpers, source drift and postgres function defaults.'::text
      as recommended_action,
    'PRODUCTION_DRIVEN_SUMMARY'::text as source_alignment,
    'current pg_proc/ACL plus repository source manifest'::text
      as source_reference,
    format(
      'finance_exposure_candidates=%s; trigger_functions=%s; production_only=%s; source_only_missing=%s',
      count(*) filter (
        where inventory.row_kind = 'FUNCTION'
          and inventory.finance_sensitive
          and inventory.authenticated_execute
          and inventory.internal_guard_status not in (
            'ACTIVE_ADMIN_ROLE_GUARD',
            'ACTIVE_MANAGEMENT_ROLE_GUARD'
          )
          and not inventory.is_trigger_function
      ),
      count(*) filter (
        where inventory.row_kind = 'FUNCTION'
          and inventory.is_trigger_function
      ),
      count(*) filter (
        where inventory.source_alignment = 'PRODUCTION_ONLY'
      ),
      count(*) filter (
        where inventory.source_alignment =
          'SOURCE_ONLY_MISSING_IN_PRODUCTION'
      )
    ) as notes,
    false as broad_execute,
    false as missing_search_path,
    false as missing_internal_guard,
    true as manual_review
  from inventory_rows inventory
)
select
  result.row_kind,
  result.schema_name,
  result.function_name,
  result.identity_arguments,
  result.full_arguments,
  result.function_signature,
  result.security_mode,
  result.owner_name,
  result.language_name,
  result.volatility,
  result.search_path_status,
  result.proconfig,
  result.object_reference_status,
  result.raw_function_acl,
  result.public_execute,
  result.anon_execute,
  result.authenticated_execute,
  result.service_role_execute,
  result.execute_contract,
  result.internal_guard_status,
  result.is_trigger_function,
  result.finance_sensitive,
  result.classification,
  result.risk_level,
  result.recommended_action,
  result.source_alignment,
  result.source_reference,
  result.notes
from (
  select * from inventory_rows
  union all
  select * from audit_summary
) result
order by result.result_order, result.function_signature;

commit;
