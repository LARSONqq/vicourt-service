-- Equipment 3.1 / Work Sessions — read-only production audit.
-- This file only inspects catalog metadata and does not mutate data or schema.

-- 1. New equipment_usage_logs columns and their exact types/nullability.
select
  columns.column_name,
  columns.data_type,
  columns.udt_name,
  columns.is_nullable,
  columns.column_default,
  columns.generation_expression
from information_schema.columns columns
where columns.table_schema = 'public'
  and columns.table_name = 'equipment_usage_logs'
  and columns.column_name in (
    'object_id',
    'object_name_snapshot',
    'employee_id',
    'employee_name_snapshot',
    'idempotency_key'
  )
order by columns.ordinal_position;

-- 2. Entry-type and work-session CHECK constraints.
select
  constraint_row.conname as constraint_name,
  pg_catalog.pg_get_constraintdef(
    constraint_row.oid,
    true
  ) as definition,
  constraint_row.convalidated as is_validated
from pg_catalog.pg_constraint constraint_row
where constraint_row.conrelid =
  'public.equipment_usage_logs'::regclass
  and constraint_row.contype = 'c'
  and constraint_row.conname in (
    'equipment_usage_logs_entry_type_check',
    'equipment_usage_logs_work_session_check'
  )
order by constraint_row.conname;

-- 3. Object/employee FK targets and ON DELETE semantics.
select
  constraint_row.conname as constraint_name,
  pg_catalog.pg_get_constraintdef(
    constraint_row.oid,
    true
  ) as definition,
  constraint_row.convalidated as is_validated
from pg_catalog.pg_constraint constraint_row
where constraint_row.conrelid =
  'public.equipment_usage_logs'::regclass
  and constraint_row.contype = 'f'
  and constraint_row.conname in (
    'equipment_usage_logs_object_fkey',
    'equipment_usage_logs_employee_fkey'
  )
order by constraint_row.conname;

-- 4. Partial unique idempotency index.
select
  indexes.indexname,
  indexes.indexdef
from pg_catalog.pg_indexes indexes
where indexes.schemaname = 'public'
  and indexes.tablename = 'equipment_usage_logs'
  and indexes.indexname =
    'equipment_usage_logs_idempotency_key_uidx';

-- 5. Exact RPC identity signature, return type and security settings.
select
  procedure_row.oid::regprocedure::text as signature,
  pg_catalog.pg_get_function_result(
    procedure_row.oid
  ) as result_type,
  procedure_row.prosecdef as security_definer,
  procedure_row.proconfig as function_settings
from pg_catalog.pg_proc procedure_row
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = procedure_row.pronamespace
where namespace_row.nspname = 'public'
  and procedure_row.proname =
    'record_equipment_work_session'
order by procedure_row.oid;

-- 6. RPC EXECUTE privileges for API roles.
select
  procedure_row.oid::regprocedure::text as signature,
  pg_catalog.has_function_privilege(
    'anon',
    procedure_row.oid,
    'EXECUTE'
  ) as anon_can_execute,
  pg_catalog.has_function_privilege(
    'authenticated',
    procedure_row.oid,
    'EXECUTE'
  ) as authenticated_can_execute,
  pg_catalog.has_function_privilege(
    'service_role',
    procedure_row.oid,
    'EXECUTE'
  ) as service_role_can_execute
from pg_catalog.pg_proc procedure_row
join pg_catalog.pg_namespace namespace_row
  on namespace_row.oid = procedure_row.pronamespace
where namespace_row.nspname = 'public'
  and procedure_row.proname =
    'record_equipment_work_session'
order by procedure_row.oid;
