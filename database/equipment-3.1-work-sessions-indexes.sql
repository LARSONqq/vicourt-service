-- Equipment 3.1 / Work Sessions — production query indexes.
--
-- Run these statements at the top level. PostgreSQL does not allow
-- CREATE INDEX CONCURRENTLY inside BEGIN/COMMIT or another transaction block.
-- If the SQL runner wraps multi-statement scripts in a transaction, execute
-- each CREATE INDEX statement separately.

create index concurrently if not exists
  equipment_usage_logs_work_session_object_date_id_idx
on public.equipment_usage_logs (
  object_id,
  reading_date desc,
  id desc
)
where entry_type = 'work_session'
  and object_id is not null;

create index concurrently if not exists
  equipment_usage_logs_work_session_employee_date_id_idx
on public.equipment_usage_logs (
  employee_id,
  reading_date desc,
  id desc
)
where entry_type = 'work_session'
  and employee_id is not null;
