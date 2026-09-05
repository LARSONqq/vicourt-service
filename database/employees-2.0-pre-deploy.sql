-- Employees 2.0 Phase 1: additive management data layer.
-- Run before deploying the application. This migration does not revoke any
-- table/column privileges used by the current production application.

begin;

create or replace function public.get_employee_directory_workloads()
returns table (
  employee_id bigint,
  active_task_count bigint,
  object_count bigint,
  equipment_count bigint
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
    raise exception 'Недостатньо прав для перегляду навантаження працівників.'
      using errcode = '42501';
  end if;

  return query
  with task_counts as (
    select
      task.assigned_employee_id,
      count(*)::bigint as active_task_count
    from public.object_tasks task
    where task.assigned_employee_id is not null
      and task.status <> 'Виконано'
    group by task.assigned_employee_id
  ),
  object_counts as (
    select
      object.responsible_employee_id,
      count(*)::bigint as object_count
    from public.objects object
    where object.responsible_employee_id is not null
    group by object.responsible_employee_id
  ),
  equipment_counts as (
    select
      equipment.responsible_employee_id,
      count(*)::bigint as equipment_count
    from public.equipment equipment
    where equipment.responsible_employee_id is not null
    group by equipment.responsible_employee_id
  )
  select
    employee.id::bigint,
    coalesce(task_counts.active_task_count, 0)::bigint,
    coalesce(object_counts.object_count, 0)::bigint,
    coalesce(equipment_counts.equipment_count, 0)::bigint
  from public.employees employee
  left join task_counts
    on task_counts.assigned_employee_id = employee.id
  left join object_counts
    on object_counts.responsible_employee_id = employee.id
  left join equipment_counts
    on equipment_counts.responsible_employee_id = employee.id
  order by employee.id;
end
$function$;

create or replace function public.get_employee_profile_kpis(
  p_employee_id bigint
)
returns table (
  employee_id bigint,
  active_task_count bigint,
  overdue_task_count bigint,
  completed_task_count bigint,
  monthly_hours numeric,
  lifetime_hours numeric,
  work_log_count bigint,
  object_count bigint,
  equipment_count bigint,
  month_start date
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_today date := (
    current_timestamp at time zone 'Europe/Kyiv'
  )::date;
  v_month_start date;
  v_next_month date;
begin
  if auth.uid() is null
     or not private.is_active_user()
     or not private.has_role(
       array['admin', 'object_manager']::text[]
     ) then
    raise exception 'Недостатньо прав для перегляду профілю працівника.'
      using errcode = '42501';
  end if;

  if p_employee_id is null
     or p_employee_id <= 0 then
    raise exception 'Неправильно вказаний працівник.'
      using errcode = '22023';
  end if;

  v_month_start := date_trunc(
    'month',
    v_today::timestamp
  )::date;
  v_next_month := (
    v_month_start + interval '1 month'
  )::date;

  return query
  select
    employee.id::bigint,
    (
      select count(*)::bigint
      from public.object_tasks task
      where task.assigned_employee_id = employee.id
        and task.status <> 'Виконано'
    ),
    (
      select count(*)::bigint
      from public.object_tasks task
      where task.assigned_employee_id = employee.id
        and task.status <> 'Виконано'
        and task.due_date < v_today
    ),
    (
      select count(*)::bigint
      from public.object_tasks task
      where task.assigned_employee_id = employee.id
        and task.status = 'Виконано'
    ),
    (
      select coalesce(
        sum(work_log.hours),
        0
      )::numeric
      from public.work_logs work_log
      where work_log.employee_id = employee.id
        and work_log.work_date >= v_month_start
        and work_log.work_date < v_next_month
    ),
    (
      select coalesce(
        sum(work_log.hours),
        0
      )::numeric
      from public.work_logs work_log
      where work_log.employee_id = employee.id
    ),
    (
      select count(*)::bigint
      from public.work_logs work_log
      where work_log.employee_id = employee.id
    ),
    (
      select count(*)::bigint
      from public.objects object
      where object.responsible_employee_id = employee.id
    ),
    (
      select count(*)::bigint
      from public.equipment equipment
      where equipment.responsible_employee_id = employee.id
    ),
    v_month_start
  from public.employees employee
  where employee.id = p_employee_id;
end
$function$;

create or replace function public.get_management_employee_actors(
  p_employee_id bigint
)
returns table (
  actor_id uuid,
  actor_name text
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
    raise exception 'Недостатньо прав для перегляду історії працівника.'
      using errcode = '42501';
  end if;

  if p_employee_id is null
     or p_employee_id <= 0 then
    raise exception 'Неправильно вказаний працівник.'
      using errcode = '22023';
  end if;

  return query
  select
    profile.id::uuid,
    coalesce(
      nullif(btrim(profile.full_name), ''),
      nullif(btrim(profile.email), ''),
      'Невідомий користувач'
    )::text
  from public.profiles profile
  where profile.employee_id = p_employee_id
  order by profile.created_at, profile.id;
end
$function$;

revoke all on function public.get_employee_directory_workloads()
  from public, anon, authenticated;
revoke all on function public.get_employee_profile_kpis(bigint)
  from public, anon, authenticated;
revoke all on function public.get_management_employee_actors(bigint)
  from public, anon, authenticated;

grant execute on function public.get_employee_directory_workloads()
  to authenticated;
grant execute on function public.get_employee_profile_kpis(bigint)
  to authenticated;
grant execute on function public.get_management_employee_actors(bigint)
  to authenticated;

notify pgrst, 'reload schema';

commit;
