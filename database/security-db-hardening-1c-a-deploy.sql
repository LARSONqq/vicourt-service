-- Security / DB Hardening 1C-A: HIGH-risk RPC and EXECUTE cleanup.
--
-- Scope:
--   * remove direct API execution from two legacy equipment-maintenance wrappers;
--   * recover and harden create_or_add_warehouse_purchase without changing its
--     purchase business logic;
--   * remove direct API execution from the legacy public.is_admin helper.
--
-- No RLS, table/sequence privileges, Storage or default privileges are changed.

begin;

do $preflight$
declare
  v_maintenance_five_oid oid := pg_catalog.to_regprocedure(
    'public.complete_equipment_maintenance(bigint,bigint,numeric,text,text)'
  )::oid;
  v_maintenance_four_oid oid := pg_catalog.to_regprocedure(
    'public.complete_equipment_maintenance(bigint,numeric,text,text)'
  )::oid;
  v_maintenance_v2_oid oid := pg_catalog.to_regprocedure(
    'public.complete_equipment_maintenance_v2(bigint,bigint,numeric,text,text,numeric)'
  )::oid;
  v_purchase_oid oid := pg_catalog.to_regprocedure(
    'public.create_or_add_warehouse_purchase(bigint,numeric,numeric,text,text)'
  )::oid;
  v_public_is_admin_oid oid := pg_catalog.to_regprocedure(
    'public.is_admin()'
  )::oid;
  v_definition text;
  v_unexpected_dependencies text;
  v_unexpected_callers text;
begin
  if v_maintenance_five_oid is null
    or v_maintenance_four_oid is null
    or v_maintenance_v2_oid is null
    or v_purchase_oid is null
    or v_public_is_admin_oid is null
  then
    raise exception
      'Hardening 1C-A preflight failed: one or more target functions are missing.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_language language_row
      on language_row.oid = function_row.prolang
    where function_row.oid in (
      v_maintenance_five_oid,
      v_maintenance_four_oid,
      v_maintenance_v2_oid
    )
      and (
        not function_row.prosecdef
        or pg_catalog.pg_get_userbyid(function_row.proowner) <> 'postgres'
        or language_row.lanname <> 'plpgsql'
        or function_row.prorettype <> 'pg_catalog.jsonb'::regtype
        or not exists (
          select 1
          from unnest(
            coalesce(function_row.proconfig, array[]::text[])
          ) config_entry
          where replace(config_entry::text, ' ', '') in (
            'search_path=',
            'search_path=""'
          )
        )
      )
  ) then
    raise exception
      'Hardening 1C-A preflight failed: equipment-maintenance function mode, owner, return type, language or search_path drifted.';
  end if;

  select regexp_replace(
    lower(pg_catalog.pg_get_functiondef(v_maintenance_five_oid)),
    '[[:space:]]+',
    '',
    'g'
  )
  into v_definition;

  if v_definition not like
    '%returnpublic.complete_equipment_maintenance_v2(p_equipment_id,p_task_id,p_cost,p_performed_by,p_description,null);%'
  then
    raise exception
      'Hardening 1C-A preflight failed: the five-argument maintenance wrapper no longer delegates directly to v2.';
  end if;

  select regexp_replace(
    lower(pg_catalog.pg_get_functiondef(v_maintenance_four_oid)),
    '[[:space:]]+',
    '',
    'g'
  )
  into v_definition;

  if v_definition not like
    '%returnpublic.complete_equipment_maintenance(p_equipment_id,null::bigint,p_cost,p_performed_by,p_description);%'
  then
    raise exception
      'Hardening 1C-A preflight failed: the four-argument maintenance wrapper no longer delegates directly to the five-argument wrapper.';
  end if;

  select regexp_replace(
    lower(pg_catalog.pg_get_functiondef(v_maintenance_v2_oid)),
    '[[:space:]]+',
    '',
    'g'
  )
  into v_definition;

  if v_definition not like '%auth.uid()isnull%'
    or v_definition not like '%private.is_active_user()%'
    or v_definition not like '%private.is_admin()%'
  then
    raise exception
      'Hardening 1C-A preflight failed: complete_equipment_maintenance_v2 no longer has the canonical active-admin guard.';
  end if;

  select string_agg(
    format(
      '%I.%I(%s)',
      caller_namespace.nspname,
      caller.proname,
      pg_catalog.pg_get_function_identity_arguments(caller.oid)
    ),
    ', '
    order by caller_namespace.nspname, caller.proname, caller.oid
  )
  into v_unexpected_callers
  from pg_catalog.pg_proc caller
  join pg_catalog.pg_namespace caller_namespace
    on caller_namespace.oid = caller.pronamespace
  where caller_namespace.nspname in ('public', 'private')
    and caller.prokind in ('f', 'p')
    and caller.oid not in (
      v_maintenance_five_oid,
      v_maintenance_four_oid,
      v_maintenance_v2_oid
    )
    and (
      lower(caller.prosrc) ~
        'public[.]complete_equipment_maintenance[[:space:]]*[(]'
      or lower(caller.prosrc) ~
        '(^|[^a-z0-9_.])complete_equipment_maintenance[[:space:]]*[(]'
    );

  if v_unexpected_callers is not null then
    raise exception
      'Hardening 1C-A preflight failed: unexpected maintenance wrapper caller(s): %',
      v_unexpected_callers;
  end if;

  select string_agg(
    format(
      'class=%s object=%s ref=%s',
      dependency.classid::regclass::text,
      dependency.objid::text,
      dependency.refobjid::regprocedure::text
    ),
    ', '
    order by dependency.classid::text, dependency.objid
  )
  into v_unexpected_dependencies
  from pg_catalog.pg_depend dependency
  where dependency.refclassid = 'pg_catalog.pg_proc'::regclass
    and dependency.refobjid in (
      v_maintenance_five_oid,
      v_maintenance_four_oid
    )
    and not (
      dependency.refobjid = v_maintenance_five_oid
      and dependency.classid = 'pg_catalog.pg_proc'::regclass
      and dependency.objid = v_maintenance_four_oid
    );

  if v_unexpected_dependencies is not null then
    raise exception
      'Hardening 1C-A preflight failed: unexpected maintenance wrapper dependency/dependencies: %',
      v_unexpected_dependencies;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgfoid in (
      v_maintenance_five_oid,
      v_maintenance_four_oid
    )
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Hardening 1C-A preflight failed: a legacy maintenance wrapper is bound to a trigger.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_language language_row
      on language_row.oid = function_row.prolang
    where function_row.oid = v_purchase_oid
      and (
        not function_row.prosecdef
        or pg_catalog.pg_get_userbyid(function_row.proowner) <> 'postgres'
        or language_row.lanname <> 'plpgsql'
        or function_row.prorettype <> 'pg_catalog.void'::regtype
        or not exists (
          select 1
          from unnest(
            coalesce(function_row.proconfig, array[]::text[])
          ) config_entry
          where replace(config_entry::text, ' ', '') in (
            'search_path=',
            'search_path=""'
          )
        )
      )
  ) then
    raise exception
      'Hardening 1C-A preflight failed: purchase RPC mode, owner, return type, language or search_path differs from the recovered production contract.';
  end if;

  select regexp_replace(
    lower(pg_catalog.pg_get_functiondef(v_purchase_oid)),
    '[[:space:]]+',
    '',
    'g'
  )
  into v_definition;

  if v_definition not like '%private.has_role(%'
    or v_definition not like '%array[''admin'',''object_manager'']::text[]%'
    or v_definition not like '%ifp_item_idisnullorp_item_id<=0then%'
    or v_definition not like '%ifp_quantityisnullorp_quantity<=0then%'
    or v_definition not like '%ifp_purchase_priceisnullorp_purchase_price<0then%'
    or v_definition not like '%perform1frompublic.warehouse_itemswhereid=p_item_id;%'
    or v_definition not like '%frompublic.warehouse_purchaseswhereitem_id=p_item_idandstatus=%orderbycreated_atdesclimit1forupdate;%'
    or v_definition not like '%v_new_quantity=coalesce(v_existing_purchase.quantity,0)+p_quantity;%'
    or v_definition not like '%ifp_purchase_price>0then%'
    or v_definition not like '%v_existing_purchase.quantity,0)*coalesce(v_existing_purchase.purchase_price,0)+p_quantity*p_purchase_price%'
    or v_definition not like '%supplier=casewhennullif(trim(p_supplier),'''')isnotnullthentrim(p_supplier)elsesupplierend%'
    or v_definition not like '%note=casewhennullif(trim(p_note),'''')isnotnullthentrim(p_note)elsenoteend%'
    or v_definition not like '%updatepublic.warehouse_purchases%'
    or v_definition not like '%insertintopublic.warehouse_purchases(%'
    or (
      v_definition not like '%''заплановано''%'
      and v_definition not like '%''Заплановано''%'
    )
  then
    raise exception
      'Hardening 1C-A preflight failed: purchase RPC business-logic anchors differ from the recovered production definition.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc function_row
    where function_row.oid = v_public_is_admin_oid
      and not function_row.prosecdef
  ) then
    raise exception
      'Hardening 1C-A preflight failed: public.is_admin is no longer SECURITY DEFINER.';
  end if;

  select string_agg(
    format(
      '%I.%I(%s)',
      caller_namespace.nspname,
      caller.proname,
      pg_catalog.pg_get_function_identity_arguments(caller.oid)
    ),
    ', '
    order by caller_namespace.nspname, caller.proname, caller.oid
  )
  into v_unexpected_callers
  from pg_catalog.pg_proc caller
  join pg_catalog.pg_namespace caller_namespace
    on caller_namespace.oid = caller.pronamespace
  where caller_namespace.nspname in ('public', 'private')
    and caller.prokind in ('f', 'p')
    and caller.oid <> v_public_is_admin_oid
    and (
      lower(caller.prosrc) ~ 'public[.]is_admin[[:space:]]*[(]'
      or lower(caller.prosrc) ~
        '(^|[^a-z0-9_.])is_admin[[:space:]]*[(]'
    );

  if v_unexpected_callers is not null then
    raise exception
      'Hardening 1C-A preflight failed: unexpected public.is_admin caller(s): %',
      v_unexpected_callers;
  end if;

  select string_agg(
    format(
      'class=%s object=%s',
      dependency.classid::regclass::text,
      dependency.objid::text
    ),
    ', '
    order by dependency.classid::text, dependency.objid
  )
  into v_unexpected_dependencies
  from pg_catalog.pg_depend dependency
  where dependency.refclassid = 'pg_catalog.pg_proc'::regclass
    and dependency.refobjid = v_public_is_admin_oid;

  if v_unexpected_dependencies is not null then
    raise exception
      'Hardening 1C-A preflight failed: unexpected public.is_admin dependency/dependencies: %',
      v_unexpected_dependencies;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgfoid = v_public_is_admin_oid
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Hardening 1C-A preflight failed: public.is_admin is bound to a trigger.';
  end if;
end
$preflight$;

create or replace function public.create_or_add_warehouse_purchase(
  p_item_id bigint,
  p_quantity numeric,
  p_purchase_price numeric,
  p_supplier text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_existing_purchase public.warehouse_purchases%rowtype;
  v_new_quantity numeric;
  v_new_purchase_price numeric;
begin
  if auth.uid() is null
    or not private.is_active_user()
    or not private.has_role(
      array['admin', 'object_manager']::text[]
    )
  then
    raise exception
      'Недостатньо прав для створення закупівлі.'
      using errcode = '42501';
  end if;

  if p_item_id is null
    or p_item_id <= 0
  then
    raise exception
      'Не вдалося визначити матеріал.';
  end if;

  if p_quantity is null
    or p_quantity <= 0
  then
    raise exception
      'Кількість повинна бути більшою за нуль.';
  end if;

  if p_purchase_price is null
    or p_purchase_price < 0
  then
    raise exception
      'Закупівельна ціна не може бути від’ємною.';
  end if;

  perform 1
  from public.warehouse_items
  where id = p_item_id;

  if not found then
    raise exception
      'Позицію складу не знайдено.';
  end if;

  select *
  into v_existing_purchase
  from public.warehouse_purchases
  where item_id = p_item_id
    and status = 'Заплановано'
  order by created_at desc
  limit 1
  for update;

  if found then
    v_new_quantity =
      coalesce(
        v_existing_purchase.quantity,
        0
      )
      + p_quantity;

    -- Середньозважена ціна запланованої закупівлі.
    if p_purchase_price > 0 then
      v_new_purchase_price =
        (
          coalesce(
            v_existing_purchase.quantity,
            0
          )
          *
          coalesce(
            v_existing_purchase.purchase_price,
            0
          )
          +
          p_quantity
          *
          p_purchase_price
        )
        /
        v_new_quantity;
    else
      v_new_purchase_price =
        coalesce(
          v_existing_purchase.purchase_price,
          0
        );
    end if;

    update public.warehouse_purchases
    set
      quantity =
        v_new_quantity,
      purchase_price =
        v_new_purchase_price,
      supplier =
        case
          when nullif(
            trim(p_supplier),
            ''
          ) is not null
            then trim(p_supplier)
          else supplier
        end,
      note =
        case
          when nullif(
            trim(p_note),
            ''
          ) is not null
            then trim(p_note)
          else note
        end
    where id =
      v_existing_purchase.id;
  else
    insert into public.warehouse_purchases (
      item_id,
      quantity,
      purchase_price,
      supplier,
      note,
      status
    )
    values (
      p_item_id,
      p_quantity,
      p_purchase_price,
      nullif(
        trim(p_supplier),
        ''
      ),
      nullif(
        trim(p_note),
        ''
      ),
      'Заплановано'
    );
  end if;
end;
$function$;

revoke all on function public.complete_equipment_maintenance(
  bigint,
  bigint,
  numeric,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.complete_equipment_maintenance(
  bigint,
  bigint,
  numeric,
  text,
  text
) to service_role;

revoke all on function public.complete_equipment_maintenance(
  bigint,
  numeric,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.complete_equipment_maintenance(
  bigint,
  numeric,
  text,
  text
) to service_role;

revoke all on function public.create_or_add_warehouse_purchase(
  bigint,
  numeric,
  numeric,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_or_add_warehouse_purchase(
  bigint,
  numeric,
  numeric,
  text,
  text
) to authenticated, service_role;

revoke all on function public.is_admin()
  from public, anon, authenticated;
grant execute on function public.is_admin()
  to service_role;

commit;
