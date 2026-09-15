-- Security / DB Hardening 1C-B: post-deploy trigger EXECUTE contract audit.
-- Strictly read-only. Returns one consolidated result set and does not change
-- functions, triggers, ACLs, RLS, default privileges or application data.

begin;
set transaction read only;
set local search_path = pg_catalog;

with contracts(
  contract_order,
  regprocedure_name,
  contract_area,
  table_schema,
  table_name,
  trigger_name,
  expected_tgtype,
  binding_contract,
  expected_public_execute,
  expected_anon_execute,
  expected_authenticated_execute,
  expected_service_role_execute
) as (
  values
    (
      1,
      'private.set_object_expense_creator()'::text,
      'ENFORCED_TRIGGER_ACL'::text,
      'public'::text,
      'object_expenses'::text,
      'set_object_expense_creator_trigger'::text,
      7::integer,
      'EXACT_ONE'::text,
      false,
      false,
      false,
      true
    ),
    (
      2,
      'private.set_push_subscriptions_updated_at()',
      'ENFORCED_TRIGGER_ACL',
      'public',
      'push_subscriptions',
      'set_push_subscriptions_updated_at',
      19,
      'EXACT_ONE',
      false,
      false,
      false,
      true
    ),
    (
      3,
      'private.set_warehouse_movement_performer()',
      'ENFORCED_TRIGGER_ACL',
      'public',
      'warehouse_movements',
      'set_warehouse_movement_performer_trigger',
      7,
      'EXACT_ONE',
      false,
      false,
      false,
      true
    ),
    (
      4,
      'public.handle_new_user()',
      'ENFORCED_TRIGGER_ACL',
      'auth',
      'users',
      'on_auth_user_created',
      5,
      'EXACT_ONE',
      false,
      false,
      false,
      true
    ),
    (
      5,
      'public.set_equipment_inventory_number()',
      'ENFORCED_TRIGGER_ACL',
      'public',
      'equipment',
      'equipment_inventory_number_trigger',
      23,
      'EXACT_ONE',
      false,
      false,
      false,
      true
    ),
    (
      6,
      'public.set_object_documents_updated_at()',
      'ENFORCED_TRIGGER_ACL',
      'public',
      'object_documents',
      'set_object_documents_updated_at',
      19,
      'EXACT_ONE',
      false,
      false,
      false,
      true
    ),
    (
      7,
      'public.set_object_payment_schedule_updated_at()',
      'ENFORCED_TRIGGER_ACL',
      'public',
      'object_payment_schedule',
      'object_payment_schedule_set_updated_at',
      19,
      'EXACT_ONE',
      false,
      false,
      false,
      true
    ),
    (
      8,
      'public.set_object_payments_updated_at()',
      'ENFORCED_TRIGGER_ACL',
      'public',
      'object_payments',
      'object_payments_set_updated_at',
      19,
      'EXACT_ONE',
      false,
      false,
      false,
      true
    ),
    (
      20,
      'private.has_role(text[])',
      'AUTH_HELPER_CONTROL',
      null,
      null,
      null,
      null,
      'NONE',
      null,
      null,
      true,
      null
    ),
    (
      21,
      'private.is_active_user()',
      'AUTH_HELPER_CONTROL',
      null,
      null,
      null,
      null,
      'NONE',
      null,
      null,
      true,
      null
    ),
    (
      22,
      'private.is_admin()',
      'AUTH_HELPER_CONTROL',
      null,
      null,
      null,
      null,
      'NONE',
      null,
      null,
      true,
      null
    ),
    (
      30,
      'private.disable_task_template_without_target()',
      'HARDENED_TRIGGER_CONTROL',
      'public',
      'task_templates',
      'task_templates_disable_missing_target',
      19,
      'EXACT_ONE',
      false,
      false,
      false,
      null
    ),
    (
      31,
      'private.guard_recurring_task_mutation()',
      'HARDENED_TRIGGER_CONTROL',
      'public',
      'object_tasks',
      'object_tasks_recurring_mutation_guard',
      31,
      'EXACT_ONE',
      false,
      false,
      false,
      null
    ),
    (
      32,
      'private.touch_task_template_updated_at()',
      'HARDENED_TRIGGER_CONTROL',
      'public',
      'task_templates',
      'task_templates_touch_updated_at',
      19,
      'EXACT_ONE',
      false,
      false,
      false,
      null
    ),
    (
      33,
      'private.set_push_notification_preferences_updated_at()',
      'HARDENED_TRIGGER_CONTROL',
      null,
      null,
      null,
      null,
      'ANY_ENABLED',
      false,
      false,
      false,
      null
    ),
    (
      34,
      'public.prevent_warehouse_movement_mutation()',
      'HARDENED_TRIGGER_CONTROL',
      'public',
      'warehouse_movements',
      'warehouse_movements_immutable_trigger',
      27,
      'EXACT_ONE',
      false,
      false,
      false,
      null
    )
),
resolved_contracts as (
  select
    contract.*,
    pg_catalog.to_regprocedure(contract.regprocedure_name)::oid
      as function_oid
  from contracts contract
),
function_facts as (
  select
    contract.*,
    function_row.oid is not null as function_exists,
    case
      when function_row.oid is null then null
      else function_row.prorettype = 'pg_catalog.trigger'::regtype
    end as returns_trigger,
    case
      when function_row.oid is null then null
      when function_row.prosecdef then 'DEFINER'
      else 'INVOKER'
    end as security_mode,
    pg_catalog.pg_get_userbyid(function_row.proowner)::text as owner_name,
    function_row.proconfig,
    function_row.proacl,
    function_row.proacl::text as raw_function_acl,
    case
      when function_row.oid is null then null
      else exists (
        select 1
        from unnest(
          coalesce(function_row.proconfig, array[]::text[])
        ) config_entry
        where replace(config_entry::text, ' ', '') in (
          'search_path=',
          'search_path=""'
        )
      )
    end as has_empty_search_path,
    case
      when function_row.oid is null then null
      else exists (
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
      )
    end as public_execute,
    case
      when function_row.oid is null
        or pg_catalog.to_regrole('anon') is null then null
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('anon'), function_row.oid, 'EXECUTE'
      )
    end as anon_execute,
    case
      when function_row.oid is null
        or pg_catalog.to_regrole('authenticated') is null then null
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('authenticated'),
        function_row.oid,
        'EXECUTE'
      )
    end as authenticated_execute,
    case
      when function_row.oid is null
        or pg_catalog.to_regrole('service_role') is null then null
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('service_role'),
        function_row.oid,
        'EXECUTE'
      )
    end as service_role_execute
  from resolved_contracts contract
  left join pg_catalog.pg_proc function_row
    on function_row.oid = contract.function_oid
),
trigger_facts as (
  select
    function_fact.contract_order,
    count(trigger_row.oid)::integer as total_binding_count,
    count(trigger_row.oid) filter (
      where trigger_row.tgenabled <> 'D'
    )::integer as enabled_binding_count,
    count(trigger_row.oid) filter (
      where table_namespace.nspname = function_fact.table_schema
        and table_row.relname = function_fact.table_name
        and trigger_row.tgname = function_fact.trigger_name
        and trigger_row.tgtype::integer = function_fact.expected_tgtype
        and trigger_row.tgenabled = 'O'
    )::integer as expected_binding_count,
    string_agg(
      format(
        '%I.%I | trigger=%I | %s %s | %s | enabled=%s',
        table_namespace.nspname,
        table_row.relname,
        trigger_row.tgname,
        case
          when (trigger_row.tgtype::integer & 64) <> 0 then 'INSTEAD OF'
          when (trigger_row.tgtype::integer & 2) <> 0 then 'BEFORE'
          else 'AFTER'
        end,
        concat_ws(
          '+',
          case when (trigger_row.tgtype::integer & 4) <> 0 then 'INSERT' end,
          case when (trigger_row.tgtype::integer & 16) <> 0 then 'UPDATE' end,
          case when (trigger_row.tgtype::integer & 8) <> 0 then 'DELETE' end,
          case when (trigger_row.tgtype::integer & 32) <> 0 then 'TRUNCATE' end
        ),
        case
          when (trigger_row.tgtype::integer & 1) <> 0
            then 'FOR EACH ROW'
          else 'FOR EACH STATEMENT'
        end,
        trigger_row.tgenabled::text
      ),
      ' || '
      order by table_namespace.nspname, table_row.relname,
        trigger_row.tgname
    ) filter (where trigger_row.oid is not null) as trigger_binding
  from function_facts function_fact
  left join pg_catalog.pg_trigger trigger_row
    on trigger_row.tgfoid = function_fact.function_oid
   and not trigger_row.tgisinternal
  left join pg_catalog.pg_class table_row
    on table_row.oid = trigger_row.tgrelid
  left join pg_catalog.pg_namespace table_namespace
    on table_namespace.oid = table_row.relnamespace
  group by function_fact.contract_order
),
direct_caller_facts as (
  select
    function_fact.contract_order,
    count(caller.oid)::integer as direct_caller_count,
    string_agg(
      format(
        '%I.%I(%s)',
        caller_namespace.nspname,
        caller.proname,
        pg_catalog.pg_get_function_identity_arguments(caller.oid)
      ),
      ' || '
      order by caller_namespace.nspname, caller.proname, caller.oid
    ) filter (where caller.oid is not null) as direct_callers
  from function_facts function_fact
  left join pg_catalog.pg_proc caller
    on caller.oid <> function_fact.function_oid
   and caller.prokind in ('f', 'p')
   and (
     lower(coalesce(caller.prosrc, '')) ~ (
       '(^|[^a-z0-9_.])'
       || lower(split_part(function_fact.regprocedure_name, '.', 1))
       || '[.]'
       || lower(
         split_part(
           split_part(function_fact.regprocedure_name, '.', 2),
           '(',
           1
         )
       )
       || '[[:space:]]*[(]'
     )
     or lower(coalesce(caller.prosrc, '')) ~ (
       '(^|[^a-z0-9_.])'
       || lower(
         split_part(
           split_part(function_fact.regprocedure_name, '.', 2),
           '(',
           1
         )
       )
       || '[[:space:]]*[(]'
     )
   )
  left join pg_catalog.pg_namespace caller_namespace
    on caller_namespace.oid = caller.pronamespace
   and caller_namespace.nspname <> 'information_schema'
   and caller_namespace.nspname !~ '^pg_'
  where caller.oid is null
    or caller_namespace.oid is not null
  group by function_fact.contract_order
),
dependency_facts as (
  select
    function_fact.contract_order,
    count(dependency.objid) filter (
      where dependency.classid in (
        'pg_catalog.pg_policy'::regclass,
        'pg_catalog.pg_rewrite'::regclass
      )
    )::integer as policy_or_rule_dependency_count,
    string_agg(
      pg_catalog.pg_describe_object(
        dependency.classid,
        dependency.objid,
        dependency.objsubid
      ),
      ' || '
    ) filter (
      where dependency.classid in (
        'pg_catalog.pg_policy'::regclass,
        'pg_catalog.pg_rewrite'::regclass
      )
    ) as policy_or_rule_dependencies
  from function_facts function_fact
  left join pg_catalog.pg_depend dependency
    on dependency.refclassid = 'pg_catalog.pg_proc'::regclass
   and dependency.refobjid = function_fact.function_oid
  group by function_fact.contract_order
),
evaluated as (
  select
    function_fact.*,
    coalesce(trigger_fact.total_binding_count, 0)
      as total_binding_count,
    coalesce(trigger_fact.enabled_binding_count, 0)
      as enabled_binding_count,
    coalesce(trigger_fact.expected_binding_count, 0)
      as expected_binding_count,
    trigger_fact.trigger_binding,
    coalesce(caller.direct_caller_count, 0) as direct_caller_count,
    caller.direct_callers,
    coalesce(dependency.policy_or_rule_dependency_count, 0)
      as policy_or_rule_dependency_count,
    dependency.policy_or_rule_dependencies
  from function_facts function_fact
  left join trigger_facts trigger_fact
    on trigger_fact.contract_order = function_fact.contract_order
  left join direct_caller_facts caller
    on caller.contract_order = function_fact.contract_order
  left join dependency_facts dependency
    on dependency.contract_order = function_fact.contract_order
),
detail_rows as (
  select
    evaluated.contract_order as result_order,
    evaluated.regprocedure_name as function_signature,
    evaluated.contract_area,
    coalesce(evaluated.trigger_binding, '(none)') as trigger_binding,
    case evaluated.contract_area
      when 'ENFORCED_TRIGGER_ACL' then
        'PUBLIC=false; anon=false; authenticated=false; service_role=true'
      when 'AUTH_HELPER_CONTROL' then
        'authenticated=true; other ACL values observation-only'
      else
        'PUBLIC=false; anon=false; authenticated=false; service_role observation-only'
    end as expected_acl,
    format(
      'PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s; raw=%s',
      coalesce(evaluated.public_execute::text, '(missing)'),
      coalesce(evaluated.anon_execute::text, '(missing)'),
      coalesce(evaluated.authenticated_execute::text, '(missing)'),
      coalesce(evaluated.service_role_execute::text, '(missing)'),
      coalesce(evaluated.raw_function_acl, '(default function ACL)')
    ) as actual_acl,
    case evaluated.contract_area
      when 'ENFORCED_TRIGGER_ACL' then
        evaluated.function_exists
        and evaluated.returns_trigger
        and evaluated.expected_binding_count = 1
        and evaluated.total_binding_count = 1
        and evaluated.direct_caller_count = 0
        and evaluated.policy_or_rule_dependency_count = 0
        and evaluated.public_execute = evaluated.expected_public_execute
        and evaluated.anon_execute = evaluated.expected_anon_execute
        and evaluated.authenticated_execute =
          evaluated.expected_authenticated_execute
        and evaluated.service_role_execute =
          evaluated.expected_service_role_execute
        and (
          evaluated.regprocedure_name <> 'public.handle_new_user()'
          or (
            evaluated.security_mode = 'DEFINER'
            and evaluated.owner_name = 'postgres'
            and evaluated.has_empty_search_path
          )
        )
      when 'AUTH_HELPER_CONTROL' then
        evaluated.function_exists
        and evaluated.authenticated_execute =
          evaluated.expected_authenticated_execute
      when 'HARDENED_TRIGGER_CONTROL' then
        evaluated.function_exists
        and evaluated.returns_trigger
        and (
          (
            evaluated.binding_contract = 'EXACT_ONE'
            and evaluated.expected_binding_count = 1
            and evaluated.total_binding_count = 1
          )
          or (
            evaluated.binding_contract = 'ANY_ENABLED'
            and evaluated.enabled_binding_count > 0
          )
        )
        and evaluated.public_execute = evaluated.expected_public_execute
        and evaluated.anon_execute = evaluated.expected_anon_execute
        and evaluated.authenticated_execute =
          evaluated.expected_authenticated_execute
      else false
    end as contract_matches,
    concat_ws(
      ' | ',
      'exists=' || evaluated.function_exists::text,
      'returns_trigger=' || coalesce(
        evaluated.returns_trigger::text,
        '(missing)'
      ),
      'security_mode=' || coalesce(evaluated.security_mode, '(missing)'),
      'owner=' || coalesce(evaluated.owner_name, '(missing)'),
      'empty_search_path=' || coalesce(
        evaluated.has_empty_search_path::text,
        '(missing)'
      ),
      'binding_contract=' || evaluated.binding_contract,
      'expected_bindings=' || evaluated.expected_binding_count::text,
      'total_bindings=' || evaluated.total_binding_count::text,
      'direct_callers=' || evaluated.direct_caller_count::text || ':' ||
        coalesce(evaluated.direct_callers, '(none)'),
      'policy_or_rule_dependencies=' ||
        evaluated.policy_or_rule_dependency_count::text || ':' ||
        coalesce(evaluated.policy_or_rule_dependencies, '(none)')
    ) as notes
  from evaluated
),
summary_row as (
  select
    2147483647 as result_order,
    'HARDENING_1C_B_CONTRACT'::text as function_signature,
    'SUMMARY'::text as contract_area,
    '(summary)'::text as trigger_binding,
    'Every enforced and untouched control row must match.'::text
      as expected_acl,
    format(
      'checked=%s; passed=%s; failed=%s',
      count(*),
      count(*) filter (where detail.contract_matches),
      count(*) filter (where not detail.contract_matches)
    ) as actual_acl,
    coalesce(bool_and(detail.contract_matches), false)
      as contract_matches,
    format(
      'enforced_trigger_acl=%s; auth_helper_controls=%s; hardened_trigger_controls=%s',
      count(*) filter (
        where detail.contract_area = 'ENFORCED_TRIGGER_ACL'
      ),
      count(*) filter (
        where detail.contract_area = 'AUTH_HELPER_CONTROL'
      ),
      count(*) filter (
        where detail.contract_area = 'HARDENED_TRIGGER_CONTROL'
      )
    ) as notes
  from detail_rows detail
)
select
  result.function_signature,
  result.contract_area,
  result.trigger_binding,
  result.expected_acl,
  result.actual_acl,
  result.contract_matches,
  result.notes
from (
  select * from detail_rows
  union all
  select * from summary_row
) result
order by result.result_order, result.function_signature;

commit;
