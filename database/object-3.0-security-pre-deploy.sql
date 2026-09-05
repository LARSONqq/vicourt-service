-- Object 3.0 Phase 1: additive management-only finance read layer.
-- Run this migration before deploying the application changes.
-- It intentionally does not revoke any existing table privileges or policies.

begin;

create or replace function public.get_management_objects()
returns table (
  id bigint,
  name text,
  customer text,
  phone text,
  address text,
  status text,
  manager text,
  responsible_employee_id bigint,
  cost_budget numeric,
  client_price numeric,
  supervision_interval_days integer,
  last_supervision_date date,
  next_supervision_date date,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not private.is_active_user()
     or not private.has_role(
       array['admin', 'object_manager']::text[]
     ) then
    raise exception 'Недостатньо прав для перегляду фінансових даних об’єктів.'
      using errcode = '42501';
  end if;

  return query
  select
    o.id::bigint,
    o.name::text,
    o.customer::text,
    o.phone::text,
    o.address::text,
    o.status::text,
    o.manager::text,
    o.responsible_employee_id::bigint,
    o.cost_budget::numeric,
    o.client_price::numeric,
    o.supervision_interval_days::integer,
    o.last_supervision_date::date,
    o.next_supervision_date::date,
    o.created_at::timestamptz
  from public.objects o;
end
$function$;

create or replace function public.get_management_materials()
returns table (
  id bigint,
  object_id bigint,
  warehouse_item_id bigint,
  name text,
  quantity numeric,
  unit text,
  price numeric,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not private.is_active_user()
     or not private.has_role(
       array['admin', 'object_manager']::text[]
     ) then
    raise exception 'Недостатньо прав для перегляду вартості матеріалів.'
      using errcode = '42501';
  end if;

  return query
  select
    m.id::bigint,
    m.object_id::bigint,
    m.warehouse_item_id::bigint,
    m.name::text,
    m.quantity::numeric,
    m.unit::text,
    m.price::numeric,
    m.created_at::timestamptz
  from public.materials m;
end
$function$;

create or replace function public.get_management_work_logs()
returns table (
  id bigint,
  object_id bigint,
  employee_id bigint,
  work_date date,
  description text,
  workers text,
  hours numeric,
  hourly_rate numeric,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not private.is_active_user()
     or not private.has_role(
       array['admin', 'object_manager']::text[]
     ) then
    raise exception 'Недостатньо прав для перегляду вартості робіт.'
      using errcode = '42501';
  end if;

  return query
  select
    w.id::bigint,
    w.object_id::bigint,
    w.employee_id::bigint,
    w.work_date::date,
    w.description::text,
    w.workers::text,
    w.hours::numeric,
    w.hourly_rate::numeric,
    w.attachment_path::text,
    w.attachment_name::text,
    w.attachment_type::text,
    w.attachment_size::bigint,
    w.created_at::timestamptz
  from public.work_logs w;
end
$function$;

create or replace function public.get_management_employees()
returns table (
  id bigint,
  first_name text,
  last_name text,
  phone text,
  email text,
  "position" text,
  employment_type text,
  status text,
  hire_date date,
  notes text,
  hourly_rate numeric,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not private.is_active_user()
     or not private.has_role(
       array['admin', 'object_manager']::text[]
     ) then
    raise exception 'Недостатньо прав для перегляду ставок працівників.'
      using errcode = '42501';
  end if;

  return query
  select
    e.id::bigint,
    e.first_name::text,
    e.last_name::text,
    e.phone::text,
    e.email::text,
    e.position::text,
    e.employment_type::text,
    e.status::text,
    e.hire_date::date,
    e.notes::text,
    e.hourly_rate::numeric,
    e.created_at::timestamptz
  from public.employees e;
end
$function$;

create or replace function public.get_management_warehouse_items()
returns table (
  id bigint,
  name text,
  category text,
  quantity numeric,
  unit text,
  min_quantity numeric,
  target_quantity numeric,
  purchase_price numeric,
  supplier text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not private.is_active_user()
     or not private.has_role(
       array['admin', 'object_manager']::text[]
     ) then
    raise exception 'Недостатньо прав для перегляду облікової вартості складу.'
      using errcode = '42501';
  end if;

  return query
  select
    wi.id::bigint,
    wi.name::text,
    wi.category::text,
    wi.quantity::numeric,
    wi.unit::text,
    wi.min_quantity::numeric,
    wi.target_quantity::numeric,
    wi.purchase_price::numeric,
    wi.supplier::text,
    wi.created_at::timestamptz
  from public.warehouse_items wi;
end
$function$;

revoke all on function public.get_management_objects()
  from public, anon, authenticated;
revoke all on function public.get_management_materials()
  from public, anon, authenticated;
revoke all on function public.get_management_work_logs()
  from public, anon, authenticated;
revoke all on function public.get_management_employees()
  from public, anon, authenticated;
revoke all on function public.get_management_warehouse_items()
  from public, anon, authenticated;

grant execute on function public.get_management_objects()
  to authenticated;
grant execute on function public.get_management_materials()
  to authenticated;
grant execute on function public.get_management_work_logs()
  to authenticated;
grant execute on function public.get_management_employees()
  to authenticated;
grant execute on function public.get_management_warehouse_items()
  to authenticated;

notify pgrst, 'reload schema';

commit;
