# Client Portal 1.0A — provisioning recovery

## Root cause

The Admin API's `adminUserCreate` first INSERTs `auth.users` with provider
metadata, then UPDATEs the requested `app_metadata`, in the same transaction.
The existing `on_auth_user_created` AFTER INSERT trigger therefore sees no
`account_type`. With POST applied, it correctly creates no application identity.
The API still succeeds; previously the application treated that as complete
provisioning and closed the form, although the client directory reads only
`client_profiles`. Before POST, the legacy branch could create an internal
worker at INSERT, masking this ordering issue during internal-account smoke.

Verified implementation reference:
[Supabase Auth adminUserCreate](https://github.com/supabase/auth/blob/master/internal/api/admin.go)
(`tx.Create(user)` precedes `user.UpdateAppMetaData(tx, params.AppMetaData)`).
The installed JS SDK forwards `app_metadata` to this endpoint unchanged.
Structural audit PASS does not test this Auth lifecycle.

## Fix and rollout

1. Keep public signup **OFF**. Do not rerun/modify the original PRE or POST.
2. Review and manually execute
   `database/client-portal-1.0a-provisioning-fix-deploy.sql` as postgres, after POST.
   This adds only `on_auth_user_classified`: AFTER UPDATE OF `raw_app_meta_data`
   for the transition from no account type to `internal` or `client`. It reuses
   `public.handle_new_user()` unchanged. Existing profile collision guards,
   trigger-only EXECUTE ACLs, RLS, inactive default and no automatic object
   access are preserved. Repeated metadata updates do not duplicate profiles.
3. Deploy application changes. The server checks the trusted response marker
   and reads only the new profile ID before returning success. No app-side
   INSERT/upsert, repair, conversion, deletion or retry is introduced.
4. Smoke with a **fresh** dedicated client email: the form closes, the new
   inactive client appears on the unfiltered first directory page, and no
   internal profile/employee/object grant is created. Verify login remains
   denied until explicit activation; object access still requires a grant.
   Also create a fresh internal account after POST and check its worker profile.
5. Verify duplicate-email, invalid-password and denied-role attempts are visible
   local errors; worker/object_manager cannot provision. Check original portal
   audit (`database/client-portal-1.0a-production-audit.sql`): it now requires the
   metadata UPDATE binding as well as INSERT, without changing any source hashes.
   Review its trigger definition evidence: old account type must be NULL and
   the new type must be `internal` or `client`. This structural check does not
   replace the actual Admin API smoke.

The fix is prepared, not executed. Mock/static tests do not replace that smoke.
The SQL does not scan/backfill/convert existing Auth accounts. A previously
successful Auth-only account still occupies its email. Do not retry creation
with that email or convert/link it automatically: recovery of those known
accounts needs a separately reviewed, identity-scoped operation.

## Atomicity and failures

An actual trigger failure aborts the Admin create transaction, including the
new Auth user and profile. The old bug was different: nothing threw, so Auth
committed without a profile. The new UPDATE trigger participates in the same
transaction as creation, not a second application write.

A lost response can still follow a successful commit. Similarly, failure of
the post-create verification read does not undo Auth. Messages explicitly say
to check the account before retrying; the app never automatically retries or
deletes a user. No raw backend error reaches the browser.

## Required Vercel Production configuration

| Variable | Consumer | Missing/misconfigured effect |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/server.ts`, `lib/supabase/admin.ts` | Session/Admin client cannot initialize or reaches the wrong project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/server.ts` and session proxy | User-scoped auth/admin guard/provisioning-state RPC cannot work. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only `lib/supabase/admin.ts` | Admin client initialization fails if absent; wrong/non-admin key fails Auth Admin authorization. Must belong to the same project. |

All three must exist in **Production**. Never use a `NEXT_PUBLIC_` variable for
the service-role secret. No new variable or fallback credential is introduced.
Configuration was not verified in Vercel; the confirmed Auth success/closed
form symptom is explained by the trigger ordering, not a missing key.

Safe Vercel diagnostic prefix: `[account-provisioning]`. Only identity kind,
stage, allowlisted error code/SQLSTATE and numeric HTTP status are logged.
Stages distinguish deployment-contract, Admin configuration/Auth API, missing
trusted classification, missing profile and failed verification reads. If Auth
reports a DB failure, inspect Supabase Auth/Postgres Logs for the corresponding
event; do not copy emails, passwords, tokens or complete Auth responses.

Rollback should preserve the new trigger: removing it restores the Auth-only
account bug after POST. Rolling back only application UX does not require any
SQL change. Do not restore public signup, legacy-worker fallback or broad grants.
