begin;

-- Apply only after the Tasks 2.1 backend is fully deployed. This trigger is
-- intentionally postponed because an older application completes every manual
-- task by direct UPDATE and does not know how to create the next occurrence.
create or replace function private.guard_recurring_task_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  trusted_internal_mutation boolean;
begin
  trusted_internal_mutation :=
    current_user = 'service_role'
    or pg_catalog.pg_trigger_depth() > 1
    or (
      pg_catalog.current_setting(
        'vicourt.recurring_task_mutation',
        true
      ) = 'on'
      and current_user not in (
        'anon',
        'authenticated',
        'authenticator'
      )
    );

  if tg_op = 'INSERT' then
    if new.task_template_id is not null
      and not trusted_internal_mutation
    then
      raise exception 'Recurring occurrences can be created only by the canonical task RPC.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.task_template_id is null then
    if tg_op = 'UPDATE'
      and new.task_template_id is not null
      and not trusted_internal_mutation
    then
      raise exception 'Recurring linkage can be created only by the canonical task RPC.'
        using errcode = '42501';
    end if;

    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if trusted_internal_mutation then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Recurring occurrences cannot be deleted directly. Disable the series instead.'
      using errcode = '42501';
  end if;

  if new.task_template_id is distinct from old.task_template_id
    or new.recurrence_sequence is distinct from old.recurrence_sequence
    or new.task_source is distinct from old.task_source
    or new.object_id is distinct from old.object_id
    or new.equipment_id is distinct from old.equipment_id
  then
    raise exception 'Recurring task linkage and target are managed by the series.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
    and (new.status = 'Виконано' or old.status = 'Виконано')
  then
    raise exception 'Complete a recurring task through complete_manual_recurring_task().' 
      using errcode = '42501';
  end if;

  return new;
end
$function$;

revoke all on function private.guard_recurring_task_mutation()
  from public, anon, authenticated;

drop trigger if exists object_tasks_recurring_mutation_guard
  on public.object_tasks;

create trigger object_tasks_recurring_mutation_guard
before insert or update or delete on public.object_tasks
for each row
execute function private.guard_recurring_task_mutation();

notify pgrst, 'reload schema';

commit;
