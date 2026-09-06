-- Equipment 3.0 Phase 1: additive management read layer.
-- Run before deploying the application. This migration does not revoke any
-- privilege or change existing Equipment write/RLS semantics.

begin;

create or replace function public.get_management_equipment_service_records(
  p_equipment_id bigint default null
)
returns table (
  id bigint,
  equipment_id bigint,
  service_type text,
  service_date date,
  cost numeric,
  performed_by text,
  description text,
  next_service_date date,
  usage_reading numeric,
  usage_type_snapshot text,
  usage_log_id bigint,
  created_by uuid,
  created_by_name text,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_at timestamptz,
  equipment_name text,
  equipment_inventory_number text
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
    raise exception 'Недостатньо прав для перегляду вартості обслуговування техніки.'
      using errcode = '42501';
  end if;

  if p_equipment_id is not null
     and p_equipment_id <= 0 then
    raise exception 'Неправильно вказана техніка.'
      using errcode = '22023';
  end if;

  return query
  select
    service_record.id::bigint,
    service_record.equipment_id::bigint,
    service_record.service_type::text,
    service_record.service_date::date,
    service_record.cost::numeric,
    service_record.performed_by::text,
    service_record.description::text,
    service_record.next_service_date::date,
    service_record.usage_reading::numeric,
    service_record.usage_type_snapshot::text,
    service_record.usage_log_id::bigint,
    service_record.created_by::uuid,
    service_record.created_by_name::text,
    service_record.voided_at::timestamptz,
    service_record.voided_by::uuid,
    service_record.void_reason::text,
    service_record.created_at::timestamptz,
    equipment.name::text,
    equipment.inventory_number::text
  from public.equipment_service_records service_record
  left join public.equipment equipment
    on equipment.id = service_record.equipment_id
  where p_equipment_id is null
     or service_record.equipment_id = p_equipment_id;
end
$function$;

create or replace function public.get_management_equipment_service_cost_kpis(
  p_equipment_id bigint
)
returns table (
  equipment_id bigint,
  total_service_cost numeric,
  current_year_service_cost numeric,
  year_start date
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
  v_year_start date;
  v_next_year date;
begin
  if auth.uid() is null
     or not private.is_active_user()
     or not private.has_role(
       array['admin', 'object_manager']::text[]
     ) then
    raise exception 'Недостатньо прав для перегляду вартості обслуговування техніки.'
      using errcode = '42501';
  end if;

  if p_equipment_id is null
     or p_equipment_id <= 0 then
    raise exception 'Неправильно вказана техніка.'
      using errcode = '22023';
  end if;

  v_year_start := make_date(
    extract(year from v_today)::integer,
    1,
    1
  );
  v_next_year := (
    v_year_start + interval '1 year'
  )::date;

  return query
  select
    equipment.id::bigint,
    coalesce(
      sum(service_record.cost) filter (
        where service_record.voided_at is null
      ),
      0
    )::numeric,
    coalesce(
      sum(service_record.cost) filter (
        where service_record.voided_at is null
          and service_record.service_date >= v_year_start
          and service_record.service_date < v_next_year
      ),
      0
    )::numeric,
    v_year_start
  from public.equipment equipment
  left join public.equipment_service_records service_record
    on service_record.equipment_id = equipment.id
  where equipment.id = p_equipment_id
  group by equipment.id;
end
$function$;

revoke all on function public.get_management_equipment_service_records(bigint)
  from public, anon, authenticated;
revoke all on function public.get_management_equipment_service_cost_kpis(bigint)
  from public, anon, authenticated;

grant execute on function public.get_management_equipment_service_records(bigint)
  to authenticated;
grant execute on function public.get_management_equipment_service_cost_kpis(bigint)
  to authenticated;

notify pgrst, 'reload schema';

commit;
