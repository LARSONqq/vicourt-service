-- Security / DB Hardening 1C-A: post-deploy contract audit.
-- Strictly read-only. Returns one consolidated result set.

begin;
set transaction read only;

with targets(target_order, regprocedure_name, contract_area) as (
  values
    (1, 'public.complete_equipment_maintenance(bigint,bigint,numeric,text,text)'::text, 'LEGACY_MAINTENANCE_5_ARG'::text),
    (2, 'public.complete_equipment_maintenance(bigint,numeric,text,text)'::text, 'LEGACY_MAINTENANCE_4_ARG'::text),
    (3, 'public.complete_equipment_maintenance_v2(bigint,bigint,numeric,text,text,numeric)'::text, 'CANONICAL_MAINTENANCE_V2'::text),
    (4, 'public.create_or_add_warehouse_purchase(bigint,numeric,numeric,text,text)'::text, 'PURCHASE_MANAGEMENT_RPC'::text),
    (5, 'public.is_admin()'::text, 'LEGACY_PUBLIC_AUTH_HELPER'::text)
),
resolved_targets as (
  select
    target.*,
    pg_catalog.to_regprocedure(target.regprocedure_name)::oid as function_oid
  from targets target
),
function_facts as (
  select
    target.*,
    function_row.prosecdef,
    function_row.proowner,
    function_row.prorettype,
    language_row.lanname::text as language_name,
    function_row.proconfig,
    function_row.proacl,
    case
      when function_row.oid is null then null
      else regexp_replace(
        lower(pg_catalog.pg_get_functiondef(function_row.oid)),
        '[[:space:]]+',
        '',
        'g'
      )
    end as normalized_definition,
    coalesce(
      exists (
        select 1
        from unnest(
          coalesce(function_row.proconfig, array[]::text[])
        ) config_entry
        where replace(config_entry::text, ' ', '') in (
          'search_path=',
          'search_path=""'
        )
      ),
      false
    ) as fixed_empty_search_path,
    case
      when function_row.oid is null then false
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
        or pg_catalog.to_regrole('anon') is null then false
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('anon'), function_row.oid, 'EXECUTE'
      )
    end as anon_execute,
    case
      when function_row.oid is null
        or pg_catalog.to_regrole('authenticated') is null then false
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('authenticated'), function_row.oid, 'EXECUTE'
      )
    end as authenticated_execute,
    case
      when function_row.oid is null
        or pg_catalog.to_regrole('service_role') is null then false
      else pg_catalog.has_function_privilege(
        pg_catalog.to_regrole('service_role'), function_row.oid, 'EXECUTE'
      )
    end as service_role_execute
  from resolved_targets target
  left join pg_catalog.pg_proc function_row
    on function_row.oid = target.function_oid
  left join pg_catalog.pg_language language_row
    on language_row.oid = function_row.prolang
),
known_oids as (
  select
    pg_catalog.to_regprocedure(
      'public.complete_equipment_maintenance(bigint,bigint,numeric,text,text)'
    )::oid as maintenance_five_oid,
    pg_catalog.to_regprocedure(
      'public.complete_equipment_maintenance(bigint,numeric,text,text)'
    )::oid as maintenance_four_oid,
    pg_catalog.to_regprocedure(
      'public.complete_equipment_maintenance_v2(bigint,bigint,numeric,text,text,numeric)'
    )::oid as maintenance_v2_oid,
    pg_catalog.to_regprocedure('public.is_admin()')::oid
      as public_is_admin_oid
),
unexpected_maintenance_body_callers as (
  select
    count(*)::integer as caller_count,
    string_agg(
      format(
        '%I.%I(%s)',
        caller_namespace.nspname,
        caller.proname,
        pg_catalog.pg_get_function_identity_arguments(caller.oid)
      ),
      ', '
      order by caller_namespace.nspname, caller.proname, caller.oid
    ) as caller_list
  from known_oids known
  join pg_catalog.pg_proc caller
    on caller.oid not in (
      known.maintenance_five_oid,
      known.maintenance_four_oid,
      known.maintenance_v2_oid
    )
  join pg_catalog.pg_namespace caller_namespace
    on caller_namespace.oid = caller.pronamespace
  where caller_namespace.nspname in ('public', 'private')
    and caller.prokind in ('f', 'p')
    and (
      lower(caller.prosrc) ~
        'public[.]complete_equipment_maintenance[[:space:]]*[(]'
      or lower(caller.prosrc) ~
        '(^|[^a-z0-9_.])complete_equipment_maintenance[[:space:]]*[(]'
    )
),
unexpected_maintenance_catalog_dependencies as (
  select
    count(*)::integer as dependency_count,
    string_agg(
      format(
        'class=%s object=%s',
        dependency.classid::regclass::text,
        dependency.objid::text
      ),
      ', '
      order by dependency.classid::text, dependency.objid
    ) as dependency_list
  from known_oids known
  join pg_catalog.pg_depend dependency
    on dependency.refclassid = 'pg_catalog.pg_proc'::regclass
   and dependency.refobjid in (
     known.maintenance_five_oid,
     known.maintenance_four_oid
   )
   and not (
     dependency.refobjid = known.maintenance_five_oid
     and dependency.classid = 'pg_catalog.pg_proc'::regclass
     and dependency.objid = known.maintenance_four_oid
   )
),
public_is_admin_body_callers as (
  select
    count(*)::integer as caller_count,
    string_agg(
      format(
        '%I.%I(%s)',
        caller_namespace.nspname,
        caller.proname,
        pg_catalog.pg_get_function_identity_arguments(caller.oid)
      ),
      ', '
      order by caller_namespace.nspname, caller.proname, caller.oid
    ) as caller_list
  from known_oids known
  join pg_catalog.pg_proc caller
    on caller.oid <> known.public_is_admin_oid
  join pg_catalog.pg_namespace caller_namespace
    on caller_namespace.oid = caller.pronamespace
  where caller_namespace.nspname in ('public', 'private')
    and caller.prokind in ('f', 'p')
    and (
      lower(caller.prosrc) ~ 'public[.]is_admin[[:space:]]*[(]'
      or lower(caller.prosrc) ~
        '(^|[^a-z0-9_.])is_admin[[:space:]]*[(]'
    )
),
public_is_admin_catalog_dependencies as (
  select
    count(*)::integer as dependency_count,
    string_agg(
      format(
        'class=%s object=%s',
        dependency.classid::regclass::text,
        dependency.objid::text
      ),
      ', '
      order by dependency.classid::text, dependency.objid
    ) as dependency_list
  from known_oids known
  join pg_catalog.pg_depend dependency
    on dependency.refclassid = 'pg_catalog.pg_proc'::regclass
   and dependency.refobjid = known.public_is_admin_oid
),
semantic_facts as (
  select
    facts.*,
    coalesce(
      facts.normalized_definition like
        '%returnpublic.complete_equipment_maintenance_v2(p_equipment_id,p_task_id,p_cost,p_performed_by,p_description,null);%',
      false
    ) as delegates_to_v2,
    coalesce(
      facts.normalized_definition like
        '%returnpublic.complete_equipment_maintenance(p_equipment_id,null::bigint,p_cost,p_performed_by,p_description);%',
      false
    ) as delegates_to_five_argument,
    coalesce(
      facts.normalized_definition like '%auth.uid()isnull%'
      and facts.normalized_definition like '%private.is_active_user()%'
      and facts.normalized_definition like '%private.is_admin()%'
      , false
    ) as active_admin_guard,
    coalesce(
      facts.normalized_definition like '%auth.uid()isnull%'
      and facts.normalized_definition like '%private.is_active_user()%'
      and facts.normalized_definition like '%private.has_role(%'
      and facts.normalized_definition like
        '%array[''admin'',''object_manager'']::text[]%'
      , false
    ) as active_management_guard,
    coalesce(
      facts.normalized_definition like
        '%ifp_item_idisnullorp_item_id<=0then%'
      and facts.normalized_definition like
        '%ifp_quantityisnullorp_quantity<=0then%'
      and facts.normalized_definition like
        '%ifp_purchase_priceisnullorp_purchase_price<0then%'
      and facts.normalized_definition like
        '%perform1frompublic.warehouse_itemswhereid=p_item_id;%'
      and facts.normalized_definition like
        '%frompublic.warehouse_purchaseswhereitem_id=p_item_idandstatus=%orderbycreated_atdesclimit1forupdate;%'
      and facts.normalized_definition like
        '%v_new_quantity=coalesce(v_existing_purchase.quantity,0)+p_quantity;%'
      and facts.normalized_definition like '%ifp_purchase_price>0then%'
      and facts.normalized_definition like
        '%v_existing_purchase.quantity,0)*coalesce(v_existing_purchase.purchase_price,0)+p_quantity*p_purchase_price%'
      and facts.normalized_definition like
        '%supplier=casewhennullif(trim(p_supplier),'''')isnotnullthentrim(p_supplier)elsesupplierend%'
      and facts.normalized_definition like
        '%note=casewhennullif(trim(p_note),'''')isnotnullthentrim(p_note)elsenoteend%'
      and facts.normalized_definition like
        '%updatepublic.warehouse_purchases%'
      and facts.normalized_definition like
        '%insertintopublic.warehouse_purchases(%'
      and (
        facts.normalized_definition like '%''заплановано''%'
        or facts.normalized_definition like '%''Заплановано''%'
      )
      , false
    ) as purchase_business_anchors_preserved
  from function_facts facts
),
contract_rows as (
  select
    1 as result_order,
    facts.regprocedure_name as function_signature,
    facts.contract_area,
    'exists; SECURITY DEFINER postgres; fixed empty search_path; PUBLIC/anon/authenticated=false; service_role=true; delegates to v2; no unexpected dependency'::text
      as expected_state,
    format(
      'exists=%s; mode=%s; owner=%s; search_path_empty=%s; PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s; delegates_to_v2=%s; unexpected_callers=%s; unexpected_dependencies=%s',
      facts.function_oid is not null,
      case when facts.prosecdef then 'DEFINER' else 'INVOKER_OR_MISSING' end,
      coalesce(pg_catalog.pg_get_userbyid(facts.proowner)::text, '(missing)'),
      facts.fixed_empty_search_path,
      facts.public_execute,
      facts.anon_execute,
      facts.authenticated_execute,
      facts.service_role_execute,
      facts.delegates_to_v2,
      callers.caller_count,
      dependencies.dependency_count
    ) as actual_state,
    facts.function_oid is not null
      and facts.prosecdef
      and pg_catalog.pg_get_userbyid(facts.proowner) = 'postgres'
      and facts.language_name = 'plpgsql'
      and facts.prorettype = 'pg_catalog.jsonb'::regtype
      and facts.fixed_empty_search_path
      and not facts.public_execute
      and not facts.anon_execute
      and not facts.authenticated_execute
      and facts.service_role_execute
      and facts.delegates_to_v2
      and callers.caller_count = 0
      and dependencies.dependency_count = 0
      as contract_matches,
    concat_ws(
      ' | ',
      'Unexpected callers: ' || coalesce(callers.caller_list, '(none)'),
      'Unexpected dependencies: ' ||
        coalesce(dependencies.dependency_list, '(none)')
    ) as notes
  from semantic_facts facts
  cross join unexpected_maintenance_body_callers callers
  cross join unexpected_maintenance_catalog_dependencies dependencies
  where facts.target_order = 1

  union all

  select
    2,
    facts.regprocedure_name,
    facts.contract_area,
    'exists; SECURITY DEFINER postgres; fixed empty search_path; PUBLIC/anon/authenticated=false; service_role=true; delegates to five-argument wrapper; no unexpected dependency',
    format(
      'exists=%s; mode=%s; owner=%s; search_path_empty=%s; PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s; delegates_to_five_arg=%s; unexpected_callers=%s; unexpected_dependencies=%s',
      facts.function_oid is not null,
      case when facts.prosecdef then 'DEFINER' else 'INVOKER_OR_MISSING' end,
      coalesce(pg_catalog.pg_get_userbyid(facts.proowner)::text, '(missing)'),
      facts.fixed_empty_search_path,
      facts.public_execute,
      facts.anon_execute,
      facts.authenticated_execute,
      facts.service_role_execute,
      facts.delegates_to_five_argument,
      callers.caller_count,
      dependencies.dependency_count
    ),
    facts.function_oid is not null
      and facts.prosecdef
      and pg_catalog.pg_get_userbyid(facts.proowner) = 'postgres'
      and facts.language_name = 'plpgsql'
      and facts.prorettype = 'pg_catalog.jsonb'::regtype
      and facts.fixed_empty_search_path
      and not facts.public_execute
      and not facts.anon_execute
      and not facts.authenticated_execute
      and facts.service_role_execute
      and facts.delegates_to_five_argument
      and callers.caller_count = 0
      and dependencies.dependency_count = 0,
    concat_ws(
      ' | ',
      'Unexpected callers: ' || coalesce(callers.caller_list, '(none)'),
      'Unexpected dependencies: ' ||
        coalesce(dependencies.dependency_list, '(none)')
    )
  from semantic_facts facts
  cross join unexpected_maintenance_body_callers callers
  cross join unexpected_maintenance_catalog_dependencies dependencies
  where facts.target_order = 2

  union all

  select
    3,
    facts.regprocedure_name,
    facts.contract_area,
    'unchanged canonical v2; SECURITY DEFINER postgres; fixed empty search_path; PUBLIC/anon=false; authenticated/service_role=true; active-admin guard',
    format(
      'exists=%s; mode=%s; owner=%s; search_path_empty=%s; PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s; active_admin_guard=%s',
      facts.function_oid is not null,
      case when facts.prosecdef then 'DEFINER' else 'INVOKER_OR_MISSING' end,
      coalesce(pg_catalog.pg_get_userbyid(facts.proowner)::text, '(missing)'),
      facts.fixed_empty_search_path,
      facts.public_execute,
      facts.anon_execute,
      facts.authenticated_execute,
      facts.service_role_execute,
      facts.active_admin_guard
    ),
    facts.function_oid is not null
      and facts.prosecdef
      and pg_catalog.pg_get_userbyid(facts.proowner) = 'postgres'
      and facts.language_name = 'plpgsql'
      and facts.prorettype = 'pg_catalog.jsonb'::regtype
      and facts.fixed_empty_search_path
      and not facts.public_execute
      and not facts.anon_execute
      and facts.authenticated_execute
      and facts.service_role_execute
      and facts.active_admin_guard,
    'The 1C-A deploy does not redefine or change ACLs on v2.'
  from semantic_facts facts
  where facts.target_order = 3

  union all

  select
    4,
    facts.regprocedure_name,
    facts.contract_area,
    'exists; SECURITY DEFINER postgres; returns void; fixed empty search_path; PUBLIC/anon=false; authenticated/service_role=true; active management guard; recovered business anchors preserved',
    format(
      'exists=%s; mode=%s; owner=%s; return_void=%s; search_path_empty=%s; PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s; active_management_guard=%s; business_anchors=%s',
      facts.function_oid is not null,
      case when facts.prosecdef then 'DEFINER' else 'INVOKER_OR_MISSING' end,
      coalesce(pg_catalog.pg_get_userbyid(facts.proowner)::text, '(missing)'),
      facts.prorettype = 'pg_catalog.void'::regtype,
      facts.fixed_empty_search_path,
      facts.public_execute,
      facts.anon_execute,
      facts.authenticated_execute,
      facts.service_role_execute,
      facts.active_management_guard,
      facts.purchase_business_anchors_preserved
    ),
    facts.function_oid is not null
      and facts.prosecdef
      and pg_catalog.pg_get_userbyid(facts.proowner) = 'postgres'
      and facts.language_name = 'plpgsql'
      and facts.prorettype = 'pg_catalog.void'::regtype
      and facts.fixed_empty_search_path
      and not facts.public_execute
      and not facts.anon_execute
      and facts.authenticated_execute
      and facts.service_role_execute
      and facts.active_management_guard
      and facts.purchase_business_anchors_preserved,
    'Business anchors cover validation, item lookup, locked planned-purchase merge, weighted price, supplier/note preservation and planned insert/update behavior.'
  from semantic_facts facts
  where facts.target_order = 4

  union all

  select
    5,
    facts.regprocedure_name,
    facts.contract_area,
    'exists; SECURITY DEFINER; PUBLIC/anon/authenticated=false; service_role=true; no function/catalog dependency',
    format(
      'exists=%s; mode=%s; owner=%s; search_path=%s; PUBLIC=%s; anon=%s; authenticated=%s; service_role=%s; callers=%s; dependencies=%s',
      facts.function_oid is not null,
      case when facts.prosecdef then 'DEFINER' else 'INVOKER_OR_MISSING' end,
      coalesce(pg_catalog.pg_get_userbyid(facts.proowner)::text, '(missing)'),
      coalesce(array_to_string(facts.proconfig, ', '), '(not fixed)'),
      facts.public_execute,
      facts.anon_execute,
      facts.authenticated_execute,
      facts.service_role_execute,
      callers.caller_count,
      dependencies.dependency_count
    ),
    facts.function_oid is not null
      and facts.prosecdef
      and not facts.public_execute
      and not facts.anon_execute
      and not facts.authenticated_execute
      and facts.service_role_execute
      and callers.caller_count = 0
      and dependencies.dependency_count = 0,
    concat_ws(
      ' | ',
      'Body unchanged; non-empty search_path remains deferred to 1C-C.',
      'Callers: ' || coalesce(callers.caller_list, '(none)'),
      'Dependencies: ' || coalesce(dependencies.dependency_list, '(none)')
    )
  from semantic_facts facts
  cross join public_is_admin_body_callers callers
  cross join public_is_admin_catalog_dependencies dependencies
  where facts.target_order = 5
),
summary_row as (
  select
    999 as result_order,
    'HARDENING_1C_A_CONTRACT'::text as function_signature,
    'FINAL_CONTRACT'::text as contract_area,
    'Every 1C-A function contract matches.'::text as expected_state,
    format(
      'matched=%s/%s',
      count(*) filter (where contract.contract_matches),
      count(*)
    ) as actual_state,
    bool_and(contract.contract_matches) as contract_matches,
    case
      when bool_and(contract.contract_matches) then
        'PASS: all Hardening 1C-A post-deploy checks match.'
      else
        'FAIL: ' || coalesce(
          string_agg(
            contract.function_signature,
            ', '
            order by contract.result_order
          ) filter (where not contract.contract_matches),
          '(unknown mismatch)'
        )
    end as notes
  from contract_rows contract
)
select
  result.function_signature,
  result.contract_area,
  result.expected_state,
  result.actual_state,
  result.contract_matches,
  result.notes
from (
  select * from contract_rows
  union all
  select * from summary_row
) result
order by result.result_order;

commit;
