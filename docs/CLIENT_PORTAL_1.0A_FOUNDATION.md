# Client Portal 1.0A — foundation and rollout

Status: implementation prepared in the working tree. SQL has NOT been executed.
Production readiness requires the manual PRE/app/POST rollout, structural audit
and actual-session smoke below. The original discovery notes are retained later
in this file as historical context, not as the current implementation status.

## Verified production follow-up

The owner confirmed the discovery results on 2026-09-20: active internal auth
helpers depend on `profiles`; task template RPCs guard indirectly through
`private.assert_task_template_management()`; Objects SELECT requires an active
internal profile; inspected management/finance boundaries require internal
helpers or deny direct access. `private` is not exposed by the Data API; exposed
schemas are `public` and `graphql_public`. Relevant Storage buckets are private.
Public signup is currently ON, with no Auth Hooks. The old signup trigger always
created an active worker, regardless of the registration-code UI.

Repository inspection confirms there was **no admin create/invite path and no
OAuth path**. Internal onboarding was `/register` → server registration-code
check → `auth.signUp()` with user metadata `full_name`. The Admin API was used
for account deletion only. Therefore compatibility is with legacy registration,
not an imaginary existing Admin API creation path.

## Implemented identity and data contracts

- `profiles.role` remains `admin | object_manager | worker`; existing internal
  profiles and helper bodies are unchanged.
- New `client_profiles` (auth UUID PK, display name, inactive by default,
  timestamps/last management actor) and `client_object_access` (client UUID/object bigint composite PK,
  grant/revoke actors and timestamps) define a separate identity.
- `handle_new_user()` branches only on trusted `raw_app_meta_data.account_type`:
  `internal` creates an internal worker; `client` creates only an inactive client
  profile. `user_metadata.full_name` is display text only.
- A shared auth-user row lock plus BEFORE INSERT/UPDATE guards on both profile
  tables prevent dual identities. There is no user conversion, email/name
  matching, impersonation or automatic employee creation.
- The POST-disabled legacy switch makes an unknown/unclassified future signup
  create **no application identity**, even if public Auth signup is ON again.
  It also prevents direct insertion of an unclassified internal profile.
- Portal identity requires current active client profile, current trusted Auth
  metadata, no internal profile and completed POST. These are DB reads, not
  stale JWT account-type authorization. Existing internal accounts need no
  metadata backfill. Collisions deny portal/routing access.
- Client RPCs use DEFINER with empty search_path to return ONLY `id`, `name`,
  `address`, `status`. Shared `authenticated` column grants cannot safely grant
  clients direct internal Objects access; no Objects client policy is added.
  Every directory/detail query scopes by current auth UID, active identity and
  unrevoked grant in SQL. Status values are allowlisted, with a neutral fallback.
- New tables have RLS, narrow own-read column grants and no authenticated direct
  writes. Admin-only RPCs control grants and activation. PUBLIC/anon execution is
  revoked. Internal/management table ACLs, RLS and business RPCs are unchanged.
- `/client` and `/client/objects/[id]` render mobile cards, address/status and
  empty/error states. Root layout does not construct Sidebar/Header for clients.
  Page/services independently authorize; proxy is not the sole data boundary.
- Proxy + server identity resolver route active internal users to `/`, clients
  to `/client`, inactive/unclassified accounts to `/access-denied`, guests to
  login. Confirmation is reachable; logout works from the denied state. Identity
  RPC errors deny rather than granting a fallback role.
- `/users` now offers admin-only internal creation (initial worker role; reuse
  existing role/employee-link/active management after creation). `/users/clients`
  offers client creation, activation/deactivation and grant management. Internal
  object passports expose a small admin-only link to their scoped grant list.
- Admin creates accounts with a password and verified email ownership via the
  existing server-only Admin client (`createUser`, `email_confirm: true`). No
  invitation email is sent. Passwords never return in DTOs/logs. Admin must
  verify the address and deliver credentials securely; full recovery is deferred.
- Provisioning checks the user-scoped DB deployment contract before invoking
  Admin API: missing PRE blocks all creation; unfinished POST blocks client
  creation. A client starts inactive and without grants; activation and explicit
  object grant are separate operations.
- Directory and grant lists page in SQL (20 + one sentinel); object selection
  reuses the existing paged lookup. No full object directory, histories or N+1.

## Manual rollout — PRE / app / POST is required

1. Manually turn **public Auth signup OFF** before PRE. Keep it OFF throughout
   rollout; temporarily pause old `/register` onboarding. Do not modify exposed
   schemas. Existing user sessions/sign-in are unaffected by the signup toggle.
2. Review and execute `database/client-portal-1.0a-pre-deploy.sql` as postgres.
   PRE retains the old unmarked signup fallback solely for rolling compatibility.
   **PRE is not the final security state.** Client reads and activation remain
   closed while that fallback exists. Do not provision clients in this window.
3. User commits/pushes application, waits for Vercel Ready. New `/register` is an
   informational page; its old action denies. Smoke existing admin/manager/worker
   and admin creation of an internal account with trusted `internal` marker.
4. Execute `database/client-portal-1.0a-post-deploy.sql`. It switches off the legacy
   fallback and permits explicit client activation. Re-running PRE cannot undo
   POST. No existing users are reclassified or deleted.
5. Run `database/client-portal-1.0a-production-audit.sql`; require structural PASS
   and review the retained direct API/Storage/RPC evidence against discovery.
6. Provision dedicated client test accounts, run all session smoke below, then
   rerun the audit and record both structural and session outcomes.

POST is necessary because the old deployed registration action cannot supply
trusted app_metadata. No trigger condition can distinguish a legitimate legacy
public `signUp` from a direct API signup carrying the same untrusted input.
Public-signup OFF limits the temporary PRE window, but the final DB trigger and
profile guards are the authorization boundary even if that setting is re-enabled.

### Rollback

Keep public signup OFF. Roll back application only if necessary: existing
internal profiles remain usable by the old app, but clients will not be supported
and old `/register` cannot onboard after POST. Do NOT restore unclassified worker
signup to make rollback convenient. Do not drop client tables/grants or restore
broad EXECUTE. Preserve the new trigger/identity guards and access metadata.

## Required actual-session smoke

- Admin: login/internal CRM works; create internal worker with trusted marker;
  existing role/employee link/block/delete and last-admin protections work.
  Create client (no employee/internal profile), activate, grant, revoke, disable.
- Object manager and worker: original routes and allowed operations unchanged;
  no Client Access controls or management list RPC results.
- Client A: login → `/client`, only A's assigned objects; assigned detail succeeds,
  guessed B ID fails; no internal Sidebar/data/routes. Empty directory is friendly.
- Client B: cannot see A's objects unless explicitly granted. Test multiple
  objects per client and multiple clients granted to one object.
- Revoke/disable with the client session still alive: subsequent list/detail and
  direct RPC calls deny data immediately; no wait for JWT expiration.
- Direct Supabase as client: objects explicit columns / `*`, finance, employees,
  warehouse, work logs, tasks/templates, activity, equipment service data and
  management RPCs return no internal data. Forged user_metadata roles do not help.
- Final signup: an unclassified auth account receives no app identity. If tested
  via a controlled temporary signup toggle, turn signup OFF immediately afterward.
  Also verify direct profiles INSERT cannot create an identity after POST.
- Confirmation/logout/blocked state have no redirect loops. Check cards/forms at
  ~375px. Storage remains private and ungranted; verify no client listing/signing.

## Audit, history and deferred scope

The audit is strictly read-only, catalog-only and returns one result set. It
checks exact new function source hashes (including guards), owner/search_path/ACL,
typed object returns, RLS/column grants, PK/FKs, trigger bindings and the final
legacy switch. It retains observation of internal relations/functions/sequences/
Storage; no application RPC or test identity is executed. **Structural PASS does
not prove runtime RLS**, hosted Data API settings, or all existing view/function
semantics. Production-session smoke is mandatory.

Revocation and disable preserve objects/business history. Grant metadata is
retained through soft revoke and regrant (original creation + latest grant/revoke
actors/times), and activation/disable records the last admin actor; this is not
a full event ledger. Auth deletion cascades only into
its client identity/access rows, never business objects. Deleting a grant actor
nulls actor metadata. Rich Activity events are deferred because the current
application event union has no client-access contract; no second log is created.

MODEL_GAP: password creation only; automated invite/recovery and safe conversion
of an existing internal/unclassified account are intentionally unsupported.
DB_GAP: none for the defined foundation. Existing direct API evidence remains a
required rollout review, not a claim that a structural hash tests actual users.
Photos/documents are absent; 1.0C requires explicit client-authorized signed URL/
Storage contracts. No buckets or policies change here. Recommended 1.0B: a small
explicitly published client work-update timeline, not the internal journal DTO.

Platform reference for privileged account creation:
[Supabase Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## Automated validation (2026-09-20)

- `npm run lint`: PASS, 0 errors and 8 unchanged unrelated warnings.
- `npx tsc --noEmit --pretty false`: PASS.
- `git diff --check`: PASS.
- `npm run build -- --webpack`: PASS, including both portal routes and admin page.
- `node --test tests/*.test.mjs`: PASS, 40/40; 16 new Client Portal cases.
- No SQL execution, browser smoke, commit or push. Mock/static assertions do not
  replace production-session RLS tests.

## Changed-file manifest

Existing application files:

- `app/actions/registerActions.ts`
- `app/layout.tsx`
- `app/login/page.tsx`
- `app/objects/[id]/page.tsx`
- `app/register/page.tsx`
- `app/users/page.tsx`
- `lib/supabase/proxy.ts`

New application/test files:

- `app/access-denied/page.tsx`
- `app/actions/clientAccessActions.ts`
- `app/actions/sessionActions.ts`
- `app/client/error.tsx`
- `app/client/layout.tsx`
- `app/client/objects/[id]/page.tsx`
- `app/client/page.tsx`
- `app/users/clients/page.tsx`
- `components/users/ClientAccessManager.tsx`
- `components/users/CreateAccountForm.tsx`
- `lib/auth/accountRouting.ts`
- `lib/clientPortal.ts`
- `services/accountIdentityService.ts`
- `services/accountProvisioningService.ts`
- `services/clientAccessService.ts`
- `services/clientPortalService.ts`
- `tests/client-portal.test.mjs`
- `types/clientPortal.ts`

SQL and documentation (the existing untracked discovery files were upgraded):

- `database/client-portal-1.0a-pre-deploy.sql`
- `database/client-portal-1.0a-post-deploy.sql`
- `database/client-portal-1.0a-production-audit.sql`
- `docs/CLIENT_PORTAL_1.0A_FOUNDATION.md`

## Archived discovery notes (before verified production follow-up)

## Verified repository facts

- Internal `UserRole` is `admin | object_manager | worker`
  (`types/userProfile.ts`). The actual DB role CHECK/enum and defaults are not
  defined in repository SQL; TypeScript does not establish the DB constraint.
- Registration calls Supabase `auth.signUp` with `full_name` in user metadata,
  after checking a server-side registration code. It does not insert a profile
  or employee (`app/actions/registerActions.ts`). No client signup is present.
  The app's registration code does not guard a direct Auth `signUp` request.
  Whether public signup is enabled, and whether a new signup becomes an active
  internal user, must be confirmed from Auth configuration and the actual trigger.
  Do not assume Admin-created client metadata alone secures this separate path.
- Prior production evidence retained in the Hardening 1C-B contract binds
  `public.handle_new_user()` to `auth.users.on_auth_user_created`, AFTER INSERT,
  ROW, DEFINER, owner postgres, empty search path. **Its body is not in source**.
  Whether it unconditionally creates an active worker, handles conflict or has
  other side effects cannot be established from those binding checks.
- Bodies for `private.is_active_user()`, `private.has_role(text[])` and
  `private.is_admin()` are also absent. Their signatures and intentional
  authenticated EXECUTE are documented; profile/metadata dependency and NULL
  behavior still require the exact definitions.
- Login requires a `profiles` row with `is_active=true`. Proxy independently
  performs that check; authenticated sessions without it are redirected to
  `/login?blocked=1`. Successful login and email confirmation redirect to `/`.
- `getCurrentUserProfile` returns only an active internal profile. Permission
  helpers take the three internal roles; employees are separate records linked
  by nullable `profiles.employee_id`. Do not use employee or name matching for
  client identity.
- The root layout passes server-rendered Sidebar and client Header into
  AppShell. AppShell hides auth-page chrome in a client-side branch. A similar
  branch for `/client` would be insufficient: server Sidebar/settings work can
  already have happened and its payload can already have been serialized.
  Portal separation must happen on the server before internal chrome loads.
- `/users` is active-admin-only. Existing user management updates profiles,
  blocks users and deletes auth accounts using the server-only Admin API; it
  does not currently create/invite client accounts. Service-role credentials
  are available only in server code and were not read or printed.
- Objects' established source contracts use bigint IDs and text name/address/
  status. Internal object DTOs also contain customer/phone/manager, employee
  IDs, supervision dates and optional financial fields; they must not be reused
  for client responses.
- Column lockdown protects financial columns from ordinary authenticated reads.
  It intentionally still grants operational reads to `authenticated`, which
  includes any future client using the same Supabase Auth role. Full production
  object/profile/related-table policies are not all recovered in the repo.
- Known management RPCs check active user and management roles. Hardening 1C-C
  production-only functions are deferred, and the retained 1C inventory uses
  source-text heuristics. Previous worker-boundary PASS does not prove isolation
  for a new external client principal.
- Photos (`object-photos`), documents (`object-documents`) and work-log files use
  signed URLs. Upload preparation can use the server Admin client after internal
  authorization. Full Storage policies/public bucket settings are absent from
  source. Omitting photo UI does not establish direct Storage API denial.

## Proposed foundation contract, pending recovered definitions

Use Supabase Auth with a separate `client_profiles` identity and an explicit
`client_object_access` relation. Do not add `client` to internal roles, create an
employee, or reuse worker permissions.

1. Provisioning must atomically take a client-only identity path, without ever
   granting an active internal profile. If account classification uses metadata,
   it must be trusted Admin-controlled app metadata, never editable user
   metadata. Inspect and preserve the actual signup trigger before choosing
   its smallest safe extension. Do not create a worker and delete it afterward.
2. Existing internal users remain internal. Reject conversion/linking if any
   internal profile exists, including inactive ones. Enforce collision rules in
   the database with transaction/concurrency protection as well as app guards.
   If a conflicting identity is discovered, deny client data access; never union
   the two permission systems.
3. `client_profiles`: auth UUID, display name, explicit active flag, timestamps.
   Active clients with no grants get the empty directory. Inactive clients get
   no portal data or fallback internal access.
4. `client_object_access`: client UUID + object bigint unique pair, active/revoked
   state, granted/revoked actor and time metadata. Revocation preserves the object
   and internal history. No FK cascade from client identity into business objects.
5. Client object DTO allowlist: `id`, `name`, `address`, `status`. Do not include
   contact phone/customer, manager/employee identifiers, notes, finance fields,
   creator metadata or related tables. Current known statuses can use Ukrainian
   presentation; map unrecognized future values to a safe neutral label.
6. Prefer an authenticated, client-specific RPC with explicit active-client and
   object-grant checks, fixed empty search path and a narrow typed return. A
   DEFINER read is justified only if clients are completely denied direct
   internal tables; an INVOKER projection alone cannot conceal columns for users
   sharing the internal authenticated grant. No broad client SELECT policy on
   `objects`. Verify internal APIs cannot be used as an alternative data path.
7. Server portal services query only granted objects, use scoped pagination and
   explicit field mapping. Detail of an unassigned object returns notFound.
   Authorization must be repeated in the service/DB, not only in layouts/proxy.
8. `/client` and `/client/objects/[id]` have their own simple navigation and
   mobile cards. Internal Sidebar/Header/settings/search are not rendered or
   loaded for clients. No future-phase placeholder datasets.
9. Reuse login/logout/confirmation. Resolve verified identity once per server
   request where possible. Internal users go to `/`; active clients to `/client`;
   inactive/unrecognized accounts to a safe denied state, without redirect loops.
10. Admin-only client access management fits `/users` with an optional link from
    internal Objects. Use existing server-only Admin API and validated canonical
    auth/object IDs. Do not expose account discovery to object_manager/worker.
11. Preserve grant/revoke metadata transactionally. Add canonical Activity events
    only once the actual mutation transaction pattern is chosen; Activity UI is
    not a dependency of the initial portal read boundary.

## Recovery required before implementing the identity boundary

Manually run `database/client-portal-1.0a-production-audit.sql` and return its
single consolidated result set. This script is a **discovery audit**, not a
deployment audit. It does not call application functions, simulate identities,
or change SQL/session roles. It reads catalogs and bucket visibility settings,
not business rows, users, email addresses, passwords, tokens or cookies.

Required evidence:

- Exact signup/helper bodies, profile role type/defaults/constraints, and all
  auth.users/profiles trigger bindings and bodies.
- Current public table/view ACLs, column access and all RLS predicates, including
  tasks/templates, profiles, finance, warehouse and equipment history.
- Full definitions/ACLs of authenticated-callable functions and private helper
  dependencies, to detect checks that only require `auth.uid()` or a session.
- Storage policies and bucket visibility; exposed Data API schemas and installed
  Auth hooks, plus whether public signup is enabled, must also be confirmed from
  project configuration. The catalog audit cannot recover hosted Auth settings.

Do not run broad Hardening 1C-C/1C-D cleanup as part of this feature. Resolve only
the access paths proven relevant to external client isolation. Do not silently
substitute a custom JWT database role or Auth hook without evaluating its impact
on existing sessions and the current project configuration.

After reviewing this evidence, implement the foundation and create one additive
PRE plus evolve the same audit file into one consolidated structural PASS/FAIL
audit. Structural checks cannot prove actual-session isolation; retain a separate
manual production smoke requirement.

## Validation and rollout once implementation is unblocked

Required automated cases: DTO allowlist, inactive/unassigned rejection, no
internal sidebar payload, collision denial, trusted signup classification,
admin-only provisioning/grant/revoke, three-role regression, safe redirects and
object scope. Mocked/static tests are not a substitute for runtime DB tests.

Rollout: manual PRE → user commit/push → Vercel Ready → internal-role smoke →
dedicated client-session smoke → read-only structural audit → consolidated PASS.
Do not create production clients or grants from the migration.

Smoke using dedicated accounts and non-sensitive test objects:

- Admin: internal CRM and existing signup still work; provision a client, grant
  and revoke access, disable it. Verify no employee/internal profile is created.
- Object manager and worker: existing routes/mutations unchanged; no client
  management controls or management RPC access.
- Client A: login lands on `/client`; only object A appears; A detail works;
  guessed B is denied; internal routes do not render internal chrome/data.
- Client B: cannot see A unless explicitly granted. Verify one-to-many and
  multiple-clients-to-one-object without cross-account exposure.
- Revoked and inactive: repeat reads with the same still-valid session/token;
  access must disappear without relying on logout or JWT expiry.
- Direct API as client: objects (explicit columns and `*`), profiles, employees,
  tasks/templates, activity, work logs, finance, warehouse, equipment histories
  and management RPCs disclose no internal data. Client RPC with B's ID returns
  no B data. Verify Storage listing/download/signing remains denied.

Recommended 1.0B after foundation PASS: explicitly approved client-visible work
updates/timeline, with a separate narrow projection and publication rules.
Photos/documents and their Storage authorization remain a later phase.

## Platform references used for the design review

- [Supabase RLS and metadata trust](https://supabase.com/docs/guides/database/postgres/row-level-security):
  user metadata is user-editable; review DEFINER/view permissions separately.
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data):
  signup trigger behavior is application-specific and must be tested; existing
  access tokens cannot substitute for current database authorization checks.
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api):
  review grants, RLS, exposed schemas and callable functions as distinct boundaries.
