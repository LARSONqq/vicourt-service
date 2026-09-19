-- Dashboard 3.0B: exact worker-safe operational summaries.
--
-- Run it before deploying the Dashboard 3.0B application. All statements are
-- additive and repeatable; no existing rows, indexes, RLS policies or business
-- RPCs are changed. Each summary is one database-side aggregate scan and never
-- transfers the source directory into application memory.

begin;

create or replace function public.get_warehouse_stock_summary()
returns table (
  out_of_stock_count bigint,
  low_stock_count bigint,
  attention_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is null
    or not private.is_active_user()
  then
    raise exception 'Недостатньо прав для перегляду залишків складу.'
      using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (
      where quantity <= 0
    ),
    count(*) filter (
      where quantity > 0
        and min_quantity is not null
        and quantity <= min_quantity
    ),
    count(*) filter (
      where quantity <= 0
        or (
          quantity > 0
          and min_quantity is not null
          and quantity <= min_quantity
        )
    )
  from public.warehouse_items;
end;
$function$;

create or replace function public.get_equipment_maintenance_summary(
  p_business_date date
)
returns table (
  overdue_count bigint,
  due_now_count bigint,
  upcoming_7_count bigint,
  usage_due_count bigint,
  attention_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is null
    or not private.is_active_user()
  then
    raise exception 'Недостатньо прав для перегляду стану техніки.'
      using errcode = '42501';
  end if;

  if p_business_date is null then
    raise exception 'Не вдалося визначити робочу дату.'
      using errcode = '22023';
  end if;

  return query
  with maintenance_state as (
    select
      coalesce(
        maintenance_interval_days > 0
        and next_service_date < p_business_date,
        false
      ) as date_overdue,
      coalesce(
        maintenance_interval_days > 0
        and next_service_date = p_business_date,
        false
      ) as date_today,
      coalesce(
        maintenance_interval_days > 0
        and next_service_date > p_business_date
        and next_service_date <= p_business_date + 7,
        false
      ) as date_upcoming,
      coalesce(
        usage_type in ('hours', 'km')
        and maintenance_interval_usage is not null
        and maintenance_interval_usage > 0
        and next_maintenance_usage is not null
        and next_maintenance_usage >= 0
        and current_usage is not null
        and current_usage >= 0
        and current_usage >= next_maintenance_usage,
        false
      ) as usage_due
    from public.equipment
  ), classified as (
    select
      date_overdue,
      not date_overdue
        and (usage_due or date_today) as due_now,
      not date_overdue
        and not usage_due
        and date_upcoming as upcoming,
      usage_due
    from maintenance_state
  )
  select
    count(*) filter (where date_overdue),
    count(*) filter (where due_now),
    count(*) filter (where upcoming),
    count(*) filter (where usage_due),
    count(*) filter (
      where date_overdue
        or due_now
        or upcoming
    )
  from classified;
end;
$function$;

revoke all on function public.get_warehouse_stock_summary()
  from public, anon, authenticated, service_role;
grant execute on function public.get_warehouse_stock_summary()
  to authenticated, service_role;

revoke all on function public.get_equipment_maintenance_summary(date)
  from public, anon, authenticated, service_role;
grant execute on function public.get_equipment_maintenance_summary(date)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
