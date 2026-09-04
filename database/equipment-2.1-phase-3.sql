-- Equipment 2.1 Phase 3: allow usage-based maintenance in the existing
-- automatic-push state machine. Run before deploying the Phase 3 app.
-- This migration does not change claim/observe/delivery semantics.

begin;

do $migration$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraints.conname
    from pg_constraint constraints
    where constraints.conrelid =
      'public.push_notification_states'::regclass
      and constraints.contype = 'c'
      and (
        constraints.conname =
          'push_notification_states_notification_type_check'
        or (
          pg_get_constraintdef(constraints.oid) ilike
            '%notification_type%'
          and pg_get_constraintdef(constraints.oid) ilike
            '%overdue_task%'
          and pg_get_constraintdef(constraints.oid) ilike
            '%supervision_today%'
          and pg_get_constraintdef(constraints.oid) ilike
            '%low_stock%'
          and pg_get_constraintdef(constraints.oid) ilike
            '%client_payment_overdue%'
        )
      )
  loop
    execute format(
      'alter table public.push_notification_states drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$migration$;

alter table public.push_notification_states
  add constraint push_notification_states_notification_type_check
  check (
    notification_type in (
      'overdue_task',
      'supervision_today',
      'supervision_overdue',
      'low_stock',
      'equipment_maintenance_today',
      'equipment_maintenance_overdue',
      'equipment_maintenance_usage_due',
      'client_payment_due_today',
      'client_payment_overdue'
    )
  ) not valid;

alter table public.push_notification_states
  validate constraint
    push_notification_states_notification_type_check;

notify pgrst, 'reload schema';

commit;
