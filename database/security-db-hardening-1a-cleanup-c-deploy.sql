-- Security / DB Hardening 1A Cleanup-C.
-- Stop broad automatic API-role grants on future public tables/sequences.
-- Existing objects, function defaults and service_role defaults are unchanged.
--
-- Hosted Supabase note:
-- The previous production attempt failed with SQLSTATE 42501 while trying to
-- alter defaults FOR ROLE supabase_admin. Because that attempt was wrapped in
-- one transaction, its earlier default-privilege changes were rolled back.
-- supabase_admin is a
-- platform-managed, observation-only exception and is intentionally untouched.
--
-- ViCourt migration contract:
-- Application migrations must create public tables/sequences as postgres and
-- explicitly grant only the anon/authenticated privileges each object needs.
-- A future app object owned by supabase_admin is an ownership anomaly that must
-- be audited before deployment.

begin;

alter default privileges
for role postgres
in schema public
revoke all privileges on tables
from anon, authenticated;

alter default privileges
for role postgres
in schema public
revoke all privileges on sequences
from anon, authenticated;

commit;
