-- Security / DB Hardening 1A Cleanup-B.
-- Remove confirmed anonymous direct access to application-owned tables.
-- Authenticated/service_role privileges, RLS and RPCs are unchanged.

begin;

revoke all privileges
on table
  public.object_expenses,
  public.profiles
from anon;

commit;
