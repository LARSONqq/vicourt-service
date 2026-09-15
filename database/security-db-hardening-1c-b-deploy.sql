-- Security / DB Hardening 1C-B: remove direct API EXECUTE from trigger-only
-- functions. This migration changes function ACLs only. Function definitions
-- and trigger bindings are verified before the first REVOKE and are not altered.

begin;
set local search_path = pg_catalog;

do $preflight$
declare
  target record;
  target_function_oid oid;
  target_returns_trigger boolean;
  target_security_definer boolean;
  target_owner text;
  target_has_empty_search_path boolean;
  expected_binding_count bigint;
  total_binding_count bigint;
  direct_caller_count bigint;
  policy_or_rule_dependency_count bigint;
begin
  if pg_catalog.to_regrole('service_role') is null then
    raise exception
      'Hardening 1C-B preflight: required role service_role is missing.';
  end if;

  for target in
    select *
    from (
      values
        (
          'private'::text,
          'set_object_expense_creator'::text,
          'public'::text,
          'object_expenses'::text,
          'set_object_expense_creator_trigger'::text,
          7::integer,
          false
        ),
        (
          'private',
          'set_push_subscriptions_updated_at',
          'public',
          'push_subscriptions',
          'set_push_subscriptions_updated_at',
          19,
          false
        ),
        (
          'private',
          'set_warehouse_movement_performer',
          'public',
          'warehouse_movements',
          'set_warehouse_movement_performer_trigger',
          7,
          false
        ),
        (
          'public',
          'handle_new_user',
          'auth',
          'users',
          'on_auth_user_created',
          5,
          true
        ),
        (
          'public',
          'set_equipment_inventory_number',
          'public',
          'equipment',
          'equipment_inventory_number_trigger',
          23,
          false
        ),
        (
          'public',
          'set_object_documents_updated_at',
          'public',
          'object_documents',
          'set_object_documents_updated_at',
          19,
          false
        ),
        (
          'public',
          'set_object_payment_schedule_updated_at',
          'public',
          'object_payment_schedule',
          'object_payment_schedule_set_updated_at',
          19,
          false
        ),
        (
          'public',
          'set_object_payments_updated_at',
          'public',
          'object_payments',
          'object_payments_set_updated_at',
          19,
          false
        )
    ) as targets(
      function_schema,
      function_name,
      table_schema,
      table_name,
      trigger_name,
      expected_tgtype,
      require_signup_contract
    )
  loop
    target_function_oid := pg_catalog.to_regprocedure(
      format('%I.%I()', target.function_schema, target.function_name)
    )::oid;

    if target_function_oid is null then
      raise exception
        'Hardening 1C-B preflight: required function %.%() is missing.',
        target.function_schema,
        target.function_name;
    end if;

    select
      function_row.prorettype = 'pg_catalog.trigger'::regtype,
      function_row.prosecdef,
      pg_catalog.pg_get_userbyid(function_row.proowner)::text,
      exists (
        select 1
        from unnest(
          coalesce(function_row.proconfig, array[]::text[])
        ) config_entry
        where replace(config_entry::text, ' ', '') in (
          'search_path=',
          'search_path=""'
        )
      )
    into
      target_returns_trigger,
      target_security_definer,
      target_owner,
      target_has_empty_search_path
    from pg_catalog.pg_proc function_row
    where function_row.oid = target_function_oid;

    if not target_returns_trigger then
      raise exception
        'Hardening 1C-B preflight: %.%() no longer RETURNS trigger.',
        target.function_schema,
        target.function_name;
    end if;

    select
      count(*) filter (
        where table_namespace.nspname = target.table_schema
          and table_row.relname = target.table_name
          and trigger_row.tgname = target.trigger_name
          and trigger_row.tgtype::integer = target.expected_tgtype
          and trigger_row.tgenabled = 'O'
      ),
      count(*)
    into expected_binding_count, total_binding_count
    from pg_catalog.pg_trigger trigger_row
    join pg_catalog.pg_class table_row
      on table_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace table_namespace
      on table_namespace.oid = table_row.relnamespace
    where trigger_row.tgfoid = target_function_oid
      and not trigger_row.tgisinternal;

    if expected_binding_count <> 1 or total_binding_count <> 1 then
      raise exception
        'Hardening 1C-B preflight: unexpected trigger binding for %.%() (expected=%, total=%).',
        target.function_schema,
        target.function_name,
        expected_binding_count,
        total_binding_count;
    end if;

    select count(*)
    into direct_caller_count
    from pg_catalog.pg_proc caller
    join pg_catalog.pg_namespace caller_namespace
      on caller_namespace.oid = caller.pronamespace
    where caller.oid <> target_function_oid
      and caller.prokind in ('f', 'p')
      and caller_namespace.nspname <> 'information_schema'
      and caller_namespace.nspname !~ '^pg_'
      and (
        lower(coalesce(caller.prosrc, '')) ~ (
          '(^|[^a-z0-9_.])'
          || lower(target.function_schema)
          || '[.]'
          || lower(target.function_name)
          || '[[:space:]]*[(]'
        )
        or lower(coalesce(caller.prosrc, '')) ~ (
          '(^|[^a-z0-9_.])'
          || lower(target.function_name)
          || '[[:space:]]*[(]'
        )
      );

    if direct_caller_count <> 0 then
      raise exception
        'Hardening 1C-B preflight: %.%() has % unexpected direct function caller(s).',
        target.function_schema,
        target.function_name,
        direct_caller_count;
    end if;

    select count(*)
    into policy_or_rule_dependency_count
    from pg_catalog.pg_depend dependency
    where dependency.refclassid = 'pg_catalog.pg_proc'::regclass
      and dependency.refobjid = target_function_oid
      and dependency.classid in (
        'pg_catalog.pg_policy'::regclass,
        'pg_catalog.pg_rewrite'::regclass
      );

    if policy_or_rule_dependency_count <> 0 then
      raise exception
        'Hardening 1C-B preflight: %.%() has % unexpected policy/view/rule dependency or dependencies.',
        target.function_schema,
        target.function_name,
        policy_or_rule_dependency_count;
    end if;

    if not pg_catalog.has_function_privilege(
      pg_catalog.to_regrole('service_role'),
      target_function_oid,
      'EXECUTE'
    ) then
      raise exception
        'Hardening 1C-B preflight: service_role EXECUTE is missing on %.%().',
        target.function_schema,
        target.function_name;
    end if;

    if target.require_signup_contract and (
      not target_security_definer
      or target_owner <> 'postgres'
      or not target_has_empty_search_path
    ) then
      raise exception
        'Hardening 1C-B preflight: public.handle_new_user() signup security contract drifted (definer=%, owner=%, empty_search_path=%).',
        target_security_definer,
        target_owner,
        target_has_empty_search_path;
    end if;
  end loop;
end
$preflight$;

-- Make the preserved service-role contract explicit before PUBLIC is revoked.
grant execute on function private.set_object_expense_creator()
  to service_role;
revoke execute on function private.set_object_expense_creator()
  from public, anon, authenticated;

grant execute on function private.set_push_subscriptions_updated_at()
  to service_role;
revoke execute on function private.set_push_subscriptions_updated_at()
  from public, anon, authenticated;

grant execute on function private.set_warehouse_movement_performer()
  to service_role;
revoke execute on function private.set_warehouse_movement_performer()
  from public, anon, authenticated;

grant execute on function public.handle_new_user()
  to service_role;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

grant execute on function public.set_equipment_inventory_number()
  to service_role;
revoke execute on function public.set_equipment_inventory_number()
  from public, anon, authenticated;

grant execute on function public.set_object_documents_updated_at()
  to service_role;
revoke execute on function public.set_object_documents_updated_at()
  from public, anon, authenticated;

grant execute on function public.set_object_payment_schedule_updated_at()
  to service_role;
revoke execute on function public.set_object_payment_schedule_updated_at()
  from public, anon, authenticated;

grant execute on function public.set_object_payments_updated_at()
  to service_role;
revoke execute on function public.set_object_payments_updated_at()
  from public, anon, authenticated;

do $postcondition$
declare
  target_signature text;
  target_function_oid oid;
  public_execute boolean;
  anon_execute boolean;
  authenticated_execute boolean;
  service_role_execute boolean;
begin
  foreach target_signature in array array[
    'private.set_object_expense_creator()',
    'private.set_push_subscriptions_updated_at()',
    'private.set_warehouse_movement_performer()',
    'public.handle_new_user()',
    'public.set_equipment_inventory_number()',
    'public.set_object_documents_updated_at()',
    'public.set_object_payment_schedule_updated_at()',
    'public.set_object_payments_updated_at()'
  ]::text[]
  loop
    target_function_oid := pg_catalog.to_regprocedure(
      target_signature
    )::oid;

    select exists (
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
    into public_execute
    from pg_catalog.pg_proc function_row
    where function_row.oid = target_function_oid;

    anon_execute := pg_catalog.has_function_privilege(
      pg_catalog.to_regrole('anon'),
      target_function_oid,
      'EXECUTE'
    );
    authenticated_execute := pg_catalog.has_function_privilege(
      pg_catalog.to_regrole('authenticated'),
      target_function_oid,
      'EXECUTE'
    );
    service_role_execute := pg_catalog.has_function_privilege(
      pg_catalog.to_regrole('service_role'),
      target_function_oid,
      'EXECUTE'
    );

    if public_execute
      or anon_execute
      or authenticated_execute
      or not service_role_execute
    then
      raise exception
        'Hardening 1C-B postcondition failed for % (PUBLIC=%, anon=%, authenticated=%, service_role=%).',
        target_signature,
        public_execute,
        anon_execute,
        authenticated_execute,
        service_role_execute;
    end if;
  end loop;
end
$postcondition$;

commit;
