-- Object 3.0 Phase 1: direct-API read lockdown.
-- Run only after the application that uses the management RPCs is fully deployed.

begin;

-- Table-level SELECT overrides column-level restrictions. Remove both the
-- table grant and any old per-column grants, then grant the exact operational
-- allowlist to authenticated users. service_role/postgres are not changed.
revoke select on table
  public.objects,
  public.materials,
  public.work_logs,
  public.employees,
  public.warehouse_items
from public, anon, authenticated;

do $migration$
declare
  v_table_name text;
  v_columns text;
begin
  foreach v_table_name in array array[
    'objects',
    'materials',
    'work_logs',
    'employees',
    'warehouse_items'
  ]
  loop
    select string_agg(
      quote_ident(c.column_name),
      ', '
      order by c.ordinal_position
    )
    into v_columns
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = v_table_name;

    if v_columns is null then
      raise exception 'Таблицю public.% не знайдено.', v_table_name;
    end if;

    execute format(
      'revoke select (%s) on table public.%I from public, anon, authenticated',
      v_columns,
      v_table_name
    );
  end loop;
end
$migration$;

grant select (
  id,
  name,
  customer,
  phone,
  address,
  status,
  manager,
  responsible_employee_id,
  supervision_interval_days,
  last_supervision_date,
  next_supervision_date,
  created_at
) on table public.objects
to authenticated;

grant select (
  id,
  object_id,
  warehouse_item_id,
  name,
  quantity,
  unit,
  created_at
) on table public.materials
to authenticated;

grant select (
  id,
  object_id,
  employee_id,
  work_date,
  description,
  workers,
  hours,
  attachment_path,
  attachment_name,
  attachment_type,
  attachment_size,
  created_at
) on table public.work_logs
to authenticated;

grant select (
  id,
  first_name,
  last_name,
  phone,
  email,
  position,
  employment_type,
  status,
  hire_date,
  notes,
  created_at
) on table public.employees
to authenticated;

grant select (
  id,
  name,
  category,
  quantity,
  unit,
  min_quantity,
  target_quantity,
  supplier,
  created_at
) on table public.warehouse_items
to authenticated;

alter table public.object_expenses
  enable row level security;

revoke select on table public.object_expenses
  from public, anon;

drop policy if exists object_expenses_management_select_guard
  on public.object_expenses;

create policy object_expenses_management_select_guard
on public.object_expenses
as restrictive
for select
to authenticated
using (
  private.is_active_user()
  and private.has_role(
    array['admin', 'object_manager']::text[]
  )
);

-- Keep the existing table privilege; RLS now limits rows to management roles.
grant select on table public.object_expenses
  to authenticated;

notify pgrst, 'reload schema';

commit;
