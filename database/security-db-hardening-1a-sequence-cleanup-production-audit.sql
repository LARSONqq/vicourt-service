-- Security / DB Hardening 1A: existing sequence cleanup verification.
-- Strictly read-only: this script changes no data, privileges or schema.
-- The final SELECT intentionally returns one consolidated review table.

begin;
set transaction read only;

with targets(
  sequence_order,
  sequence_name,
  related_table_name,
  contract_class,
  write_path
) as (
  values
    (
      1,
      'employees_id_seq'::text,
      'employees'::text,
      'USAGE_ONLY'::text,
      'Direct INSERT: app/actions/employeeActions.ts; user-scoped authenticated client'::text
    ),
    (
      2,
      'equipment_id_seq',
      'equipment',
      'USAGE_ONLY',
      'Direct INSERT: app/actions/equipmentActions.ts; authenticated column-level INSERT grant in equipment-2.1-post-deploy.sql'
    ),
    (
      3,
      'equipment_inventory_number_seq',
      'equipment',
      'SPECIAL',
      'No OWNED BY/source nextval contract; authenticated ACL intentionally unchanged'
    ),
    (
      4,
      'materials_id_seq',
      'materials',
      'NONE',
      'INSERT only inside repository-confirmed SECURITY DEFINER material/warehouse RPCs'
    ),
    (
      5,
      'object_documents_id_seq',
      'object_documents',
      'USAGE_ONLY',
      'Direct INSERT: app/actions/objectDocumentActions.ts; user-scoped authenticated client'
    ),
    (
      6,
      'object_expenses_id_seq',
      'object_expenses',
      'USAGE_ONLY',
      'Direct INSERT: app/actions/objectExpenseActions.ts; user-scoped authenticated client'
    ),
    (
      7,
      'object_payment_schedule_id_seq',
      'object_payment_schedule',
      'USAGE_ONLY',
      'Direct INSERT: app/actions/objectPaymentScheduleActions.ts; user-scoped authenticated client'
    ),
    (
      8,
      'object_payments_id_seq',
      'object_payments',
      'USAGE_ONLY',
      'Direct INSERT: app/actions/objectPaymentActions.ts; user-scoped authenticated client'
    ),
    (
      9,
      'object_photos_id_seq',
      'object_photos',
      'USAGE_ONLY',
      'Direct INSERT: components/objects/AddPhotoForm.tsx; browser authenticated client'
    ),
    (
      10,
      'object_tasks_id_seq',
      'object_tasks',
      'USAGE_ONLY',
      'Direct INSERT: task actions and supervision service; user-scoped authenticated client'
    ),
    (
      11,
      'objects_id_seq',
      'objects',
      'USAGE_ONLY',
      'Direct INSERT: object actions/services; user-scoped authenticated client'
    ),
    (
      12,
      'task_checklist_items_id_seq',
      'task_checklist_items',
      'USAGE_ONLY',
      'Direct INSERT: app/actions/taskChecklistActions.ts; user-scoped authenticated client'
    ),
    (
      13,
      'warehouse_items_id_seq',
      'warehouse_items',
      'NONE',
      'INSERT inside SECURITY DEFINER create_warehouse_item_with_opening_balance RPC'
    ),
    (
      14,
      'warehouse_movements_id_seq',
      'warehouse_movements',
      'NONE',
      'INSERT only inside repository-confirmed SECURITY DEFINER warehouse RPCs'
    ),
    (
      15,
      'warehouse_purchases_id_seq',
      'warehouse_purchases',
      'SPECIAL',
      'create_or_add_warehouse_purchase RPC definition absent from repo; authenticated ACL intentionally unchanged'
    ),
    (
      16,
      'work_logs_id_seq',
      'work_logs',
      'USAGE_ONLY',
      'Direct INSERT: app/actions/workLogActions.ts; user-scoped authenticated client'
    )
),
resolved_targets as (
  select
    target.*,
    sequence_row.oid as sequence_oid,
    sequence_row.relowner as sequence_owner_oid,
    related_table.oid as related_table_oid
  from targets target
  left join pg_catalog.pg_namespace public_namespace
    on public_namespace.nspname = 'public'
  left join pg_catalog.pg_class sequence_row
    on sequence_row.relnamespace = public_namespace.oid
   and sequence_row.relname = target.sequence_name
   and sequence_row.relkind = 'S'
  left join pg_catalog.pg_class related_table
    on related_table.relnamespace = public_namespace.oid
   and related_table.relname = target.related_table_name
   and related_table.relkind in ('r', 'p')
),
sequence_context as (
  select
    target.*,
    ownership.owned_by,
    ownership.identity_kind,
    ownership.column_default,
    referenced_default.referencing_column_defaults
  from resolved_targets target
  left join lateral (
    select
      pg_catalog.format(
        '%I.%I.%I',
        owned_namespace.nspname,
        owned_table.relname,
        owned_attribute.attname
      ) as owned_by,
      owned_attribute.attidentity as identity_kind,
      pg_catalog.pg_get_expr(
        owned_default.adbin,
        owned_default.adrelid
      ) as column_default
    from pg_catalog.pg_depend ownership_dependency
    join pg_catalog.pg_class owned_table
      on owned_table.oid = ownership_dependency.refobjid
    join pg_catalog.pg_namespace owned_namespace
      on owned_namespace.oid = owned_table.relnamespace
    join pg_catalog.pg_attribute owned_attribute
      on owned_attribute.attrelid = owned_table.oid
     and owned_attribute.attnum = ownership_dependency.refobjsubid
    left join pg_catalog.pg_attrdef owned_default
      on owned_default.adrelid = owned_attribute.attrelid
     and owned_default.adnum = owned_attribute.attnum
    where ownership_dependency.classid = 'pg_catalog.pg_class'::regclass
      and ownership_dependency.objid = target.sequence_oid
      and ownership_dependency.refclassid = 'pg_catalog.pg_class'::regclass
      and ownership_dependency.deptype in ('a', 'i')
    order by
      owned_namespace.nspname,
      owned_table.relname,
      owned_attribute.attnum
    limit 1
  ) ownership on true
  left join lateral (
    select
      string_agg(
        pg_catalog.format(
          '%I.%I.%I = %s',
          default_namespace.nspname,
          default_table.relname,
          default_attribute.attname,
          pg_catalog.pg_get_expr(
            default_row.adbin,
            default_row.adrelid
          )
        ),
        '; ' order by
          default_namespace.nspname,
          default_table.relname,
          default_attribute.attnum
      ) as referencing_column_defaults
    from pg_catalog.pg_depend default_dependency
    join pg_catalog.pg_attrdef default_row
      on default_row.oid = default_dependency.objid
    join pg_catalog.pg_class default_table
      on default_table.oid = default_row.adrelid
    join pg_catalog.pg_namespace default_namespace
      on default_namespace.oid = default_table.relnamespace
    join pg_catalog.pg_attribute default_attribute
      on default_attribute.attrelid = default_row.adrelid
     and default_attribute.attnum = default_row.adnum
    where default_dependency.classid = 'pg_catalog.pg_attrdef'::regclass
      and default_dependency.refclassid = 'pg_catalog.pg_class'::regclass
      and default_dependency.refobjid = target.sequence_oid
  ) referenced_default on true
),
privilege_state as (
  select
    context.*,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'anon', context.sequence_oid, 'SELECT'
      )
    end as anon_select,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'anon', context.sequence_oid, 'UPDATE'
      )
    end as anon_update,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'anon', context.sequence_oid, 'USAGE'
      )
    end as anon_usage,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'authenticated', context.sequence_oid, 'SELECT'
      )
    end as authenticated_select,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'authenticated', context.sequence_oid, 'UPDATE'
      )
    end as authenticated_update,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'authenticated', context.sequence_oid, 'USAGE'
      )
    end as authenticated_usage,
    case
      when context.related_table_oid is null then null
      else pg_catalog.has_table_privilege(
        'authenticated', context.related_table_oid, 'INSERT'
      )
    end as authenticated_table_insert,
    case
      when context.related_table_oid is null then null
      else pg_catalog.has_any_column_privilege(
        'authenticated', context.related_table_oid, 'INSERT'
      )
    end as authenticated_any_column_insert,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'service_role', context.sequence_oid, 'SELECT'
      )
    end as service_role_select,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'service_role', context.sequence_oid, 'UPDATE'
      )
    end as service_role_update,
    case
      when context.sequence_oid is null then null
      else pg_catalog.has_sequence_privilege(
        'service_role', context.sequence_oid, 'USAGE'
      )
    end as service_role_usage
  from sequence_context context
),
contracts as (
  select
    state.*,
    state.sequence_oid is not null
      and not coalesce(state.anon_select, true)
      and not coalesce(state.anon_update, true)
      and not coalesce(state.anon_usage, true) as anon_contract_matches,
    case state.contract_class
      when 'NONE' then
        state.sequence_oid is not null
        and not coalesce(state.authenticated_select, true)
        and not coalesce(state.authenticated_update, true)
        and not coalesce(state.authenticated_usage, true)
      when 'USAGE_ONLY' then
        state.sequence_oid is not null
        and not coalesce(state.authenticated_select, true)
        and not coalesce(state.authenticated_update, true)
        and coalesce(state.authenticated_usage, false)
      else null
    end as authenticated_contract_matches
  from privilege_state state
)
select
  contract.sequence_name,
  contract.contract_class,
  contract.anon_contract_matches,
  contract.authenticated_contract_matches,
  case
    when contract.contract_class = 'SPECIAL' then null
    else
      contract.anon_contract_matches
      and contract.authenticated_contract_matches
  end as overall_contract_matches,
  concat_ws(
    ' | ',
    'exists=' || (contract.sequence_oid is not null)::text,
    'owner=' || coalesce(
      pg_catalog.pg_get_userbyid(contract.sequence_owner_oid)::text,
      '(missing)'
    ),
    'related_table=' || contract.related_table_name,
    'table_insert=' || coalesce(
      contract.authenticated_table_insert::text,
      'null'
    ),
    'any_column_insert=' || coalesce(
      contract.authenticated_any_column_insert::text,
      'null'
    ),
    'owned_by=' || coalesce(contract.owned_by, '(none)'),
    'identity=' || coalesce(
      nullif(contract.identity_kind::text, ''),
      '(none)'
    ),
    'default=' || coalesce(contract.column_default, '(none)'),
    'referencing_defaults=' || coalesce(
      contract.referencing_column_defaults,
      '(none)'
    ),
    'service_role=' || pg_catalog.format(
      'SELECT:%s,UPDATE:%s,USAGE:%s',
      coalesce(contract.service_role_select::text, 'null'),
      coalesce(contract.service_role_update::text, 'null'),
      coalesce(contract.service_role_usage::text, 'null')
    ),
    'path=' || contract.write_path,
    case
      when contract.contract_class = 'SPECIAL' then
        'review=authenticated contract intentionally not enforced'
      else 'review=contract enforced'
    end
  ) as notes
from contracts contract
order by contract.sequence_order;

commit;
