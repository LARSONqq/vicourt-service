-- Equipment 3.1 / Work Sessions — additive pre-deploy migration.
-- Run this file before deploying the application code. It does not modify the
-- existing record_equipment_usage(...) contract or reading/correction facts.

begin;

alter table public.equipment_usage_logs
  add column if not exists object_id bigint,
  add column if not exists object_name_snapshot text,
  add column if not exists employee_id bigint,
  add column if not exists employee_name_snapshot text,
  add column if not exists idempotency_key uuid;

alter table public.equipment_usage_logs
  drop constraint if exists equipment_usage_logs_entry_type_check,
  add constraint equipment_usage_logs_entry_type_check
    check (entry_type in ('reading', 'correction', 'work_session')),
  drop constraint if exists equipment_usage_logs_work_session_check,
  add constraint equipment_usage_logs_work_session_check
    check (
      (
        entry_type in ('reading', 'correction')
        and object_id is null
        and object_name_snapshot is null
        and employee_id is null
        and employee_name_snapshot is null
        and idempotency_key is null
      )
      or (
        entry_type = 'work_session'
        and usage_type = 'hours'
        and previous_reading is not null
        and reading > previous_reading
        and object_name_snapshot is not null
        and char_length(btrim(object_name_snapshot)) between 1 and 300
        and employee_name_snapshot is not null
        and char_length(btrim(employee_name_snapshot)) between 1 and 300
        and idempotency_key is not null
      )
    );

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid =
      'public.equipment_usage_logs'::regclass
      and constraint_row.conname =
        'equipment_usage_logs_object_fkey'
  ) then
    alter table public.equipment_usage_logs
      add constraint equipment_usage_logs_object_fkey
      foreign key (object_id)
      references public.objects(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid =
      'public.equipment_usage_logs'::regclass
      and constraint_row.conname =
        'equipment_usage_logs_employee_fkey'
  ) then
    alter table public.equipment_usage_logs
      add constraint equipment_usage_logs_employee_fkey
      foreign key (employee_id)
      references public.employees(id)
      on delete set null;
  end if;
end
$migration$;

create unique index if not exists
  equipment_usage_logs_idempotency_key_uidx
on public.equipment_usage_logs (idempotency_key)
where idempotency_key is not null;

create or replace function public.record_equipment_work_session(
  p_equipment_id bigint,
  p_duration numeric,
  p_reading_date date,
  p_object_id bigint,
  p_employee_id bigint,
  p_note text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  equipment_row public.equipment%rowtype;
  existing_log public.equipment_usage_logs%rowtype;
  previous_reading numeric(18,3);
  new_reading numeric;
  latest_reading_date date;
  normalized_duration numeric(18,3);
  normalized_note text;
  object_name text;
  employee_name text;
  actor_name text;
  usage_log_id bigint;
begin
  if auth.uid() is null
    or not private.is_active_user()
    or not private.has_role(array['admin']::text[])
  then
    raise exception 'Only an active administrator can record equipment work sessions.'
      using errcode = '42501';
  end if;

  if p_equipment_id is null or p_equipment_id <= 0
    or p_object_id is null or p_object_id <= 0
    or p_employee_id is null or p_employee_id <= 0
  then
    raise exception 'Equipment, object and employee are required.'
      using errcode = '22023';
  end if;

  if p_duration is null
    or p_duration <= 0
    or p_duration = 'NaN'::numeric
    or p_duration >= 'Infinity'::numeric
  then
    raise exception 'Work duration must be a finite positive number.'
      using errcode = '22023';
  end if;

  if p_duration <> round(p_duration, 3) then
    raise exception 'Work duration supports at most three decimal places.'
      using errcode = '22023';
  end if;

  if p_duration > 999999999999999.999::numeric then
    raise exception 'Work duration is outside the supported range.'
      using errcode = '22003';
  end if;

  normalized_duration := p_duration;
  normalized_note := nullif(btrim(p_note), '');

  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'Usage note is too long.'
      using errcode = '22001';
  end if;

  if p_reading_date is null then
    raise exception 'Work date is required.'
      using errcode = '22007';
  end if;

  if p_reading_date > (clock_timestamp() at time zone 'Europe/Kyiv')::date then
    raise exception 'Work date cannot be in the future.'
      using errcode = '22007';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required.'
      using errcode = '22023';
  end if;

  -- Serialize equal keys before checking/inserting. The partial unique index is
  -- the final database invariant; this lock gives deterministic replay results.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  select usage_log.*
  into existing_log
  from public.equipment_usage_logs usage_log
  where usage_log.idempotency_key = p_idempotency_key;

  if found then
    if existing_log.entry_type <> 'work_session'
      or existing_log.equipment_id is distinct from p_equipment_id
      or existing_log.object_id is distinct from p_object_id
      or existing_log.employee_id is distinct from p_employee_id
      or existing_log.reading_date is distinct from p_reading_date
      or existing_log.delta is distinct from normalized_duration
      or existing_log.note is distinct from normalized_note
    then
      raise exception 'Idempotency key is already used by a different work session.'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'usage_log_id', existing_log.id,
      'equipment_id', existing_log.equipment_id,
      'equipment_name', existing_log.equipment_name_snapshot,
      'usage_type', existing_log.usage_type,
      'previous_current_usage', existing_log.previous_reading,
      'new_current_usage', existing_log.reading,
      'duration', existing_log.delta,
      'reading_date', existing_log.reading_date,
      'entry_type', existing_log.entry_type,
      'object_id', existing_log.object_id,
      'object_name', existing_log.object_name_snapshot,
      'employee_id', existing_log.employee_id,
      'employee_name', existing_log.employee_name_snapshot,
      'note', existing_log.note,
      'created_by_name', existing_log.created_by_name,
      'appended', true,
      'idempotent_replay', true
    );
  end if;

  select equipment.*
  into equipment_row
  from public.equipment equipment
  where equipment.id = p_equipment_id
  for update;

  if not found then
    raise exception 'Equipment was not found.'
      using errcode = 'P0002';
  end if;

  if equipment_row.usage_type <> 'hours' then
    raise exception 'Work sessions require equipment usage type hours.'
      using errcode = '22023';
  end if;

  if equipment_row.current_usage is null then
    raise exception 'Record the initial absolute usage reading first.'
      using errcode = '22023';
  end if;

  previous_reading := equipment_row.current_usage;
  new_reading := previous_reading + normalized_duration;

  if new_reading >= 'Infinity'::numeric
    or new_reading > 999999999999999.999::numeric
  then
    raise exception 'Resulting usage is outside the supported range.'
      using errcode = '22003';
  end if;

  select usage_log.reading_date
  into latest_reading_date
  from public.equipment_usage_logs usage_log
  where usage_log.equipment_id = equipment_row.id
  order by usage_log.reading_date desc, usage_log.id desc
  limit 1;

  if latest_reading_date is not null
    and p_reading_date < latest_reading_date
  then
    raise exception 'Usage entries must be recorded in chronological order.'
      using errcode = '22007';
  end if;

  select target_object.name
  into object_name
  from public.objects target_object
  where target_object.id = p_object_id
  for key share;

  if not found or nullif(btrim(object_name), '') is null then
    raise exception 'Object was not found.'
      using errcode = 'P0002';
  end if;

  select nullif(
    btrim(
      concat_ws(
        ' ',
        nullif(btrim(employee.first_name), ''),
        nullif(btrim(employee.last_name), '')
      )
    ),
    ''
  )
  into employee_name
  from public.employees employee
  where employee.id = p_employee_id
  for key share;

  if not found or employee_name is null then
    raise exception 'Employee was not found.'
      using errcode = 'P0002';
  end if;

  if char_length(btrim(object_name)) > 300
    or char_length(btrim(employee_name)) > 300
  then
    raise exception 'Object or employee name is too long for a usage snapshot.'
      using errcode = '22001';
  end if;

  select coalesce(
    nullif(btrim(profile.full_name), ''),
    nullif(btrim(profile.email), ''),
    'Користувач ViCourt'
  )
  into actor_name
  from public.profiles profile
  where profile.id = auth.uid();

  actor_name := coalesce(actor_name, 'Користувач ViCourt');

  insert into public.equipment_usage_logs (
    equipment_id,
    equipment_name_snapshot,
    inventory_number_snapshot,
    usage_type,
    reading,
    previous_reading,
    reading_date,
    entry_type,
    object_id,
    object_name_snapshot,
    employee_id,
    employee_name_snapshot,
    note,
    created_by,
    created_by_name,
    idempotency_key
  )
  values (
    equipment_row.id,
    equipment_row.name,
    equipment_row.inventory_number,
    equipment_row.usage_type,
    new_reading,
    previous_reading,
    p_reading_date,
    'work_session',
    p_object_id,
    btrim(object_name),
    p_employee_id,
    btrim(employee_name),
    normalized_note,
    auth.uid(),
    actor_name,
    p_idempotency_key
  )
  returning id into usage_log_id;

  update public.equipment
  set current_usage = new_reading
  where id = equipment_row.id;

  perform public.sync_equipment_maintenance_task(equipment_row.id);

  return jsonb_build_object(
    'usage_log_id', usage_log_id,
    'equipment_id', equipment_row.id,
    'equipment_name', equipment_row.name,
    'usage_type', equipment_row.usage_type,
    'previous_current_usage', previous_reading,
    'new_current_usage', new_reading,
    'duration', normalized_duration,
    'reading_date', p_reading_date,
    'entry_type', 'work_session',
    'object_id', p_object_id,
    'object_name', btrim(object_name),
    'employee_id', p_employee_id,
    'employee_name', btrim(employee_name),
    'note', normalized_note,
    'created_by_name', actor_name,
    'appended', true,
    'idempotent_replay', false
  );
end
$function$;

revoke all on function public.record_equipment_work_session(
  bigint,
  numeric,
  date,
  bigint,
  bigint,
  text,
  uuid
)
from public, anon, authenticated;

grant execute on function public.record_equipment_work_session(
  bigint,
  numeric,
  date,
  bigint,
  bigint,
  text,
  uuid
)
to authenticated;

commit;
