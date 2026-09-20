// node --test tests/client-portal.test.mjs
// Mocked application behavior + SQL contract assertions. Never executes SQL.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, "utf8");
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const output = ts.transpileModule(read(filename), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only" || name.endsWith(".css")) return {};
      if (name.startsWith("@/")) {
        const base = resolve(name.slice(2));
        return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
      }
      return require(name);
    };
    new Function("require", "module", "exports", output)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
const navigation = { redirect: (path) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("not-found"); } };
const pre = read("database/client-portal-1.0a-pre-deploy.sql");
const post = read("database/client-portal-1.0a-post-deploy.sql");
const audit = read("database/client-portal-1.0a-production-audit.sql");

test("client DTO strips every non-allowlisted field and handles unknown status safely", () => {
  const { clientObjectDto } = loader()("lib/clientPortal.ts");
  const dto = clientObjectDto({ id: 47, name: "Сад", address: "Адреса", status: "В роботі", cost_budget: 100, client_price: 200, customer: "private", phone: "private", responsible_employee_id: 8, notes: "private", created_by: "private", finance: { total: 1 } });
  assert.deepEqual(dto, { id: 47, name: "Сад", address: "Адреса", status: "В роботі" });
  assert.equal(clientObjectDto({ id: 1, name: "A", status: "Internal future status" }).status, "Об’єкт");
  assert.throws(() => clientObjectDto({ id: Number.MAX_SAFE_INTEGER + 1, name: "A" }));
});

test("routing is deterministic for internal/client/blocked/unclassified/guest without loops", () => {
  const { accountRedirect, accountHome } = loader()("lib/auth/accountRouting.ts");
  for (const path of ["/", "/users", "/tasks/templates", "/warehouse", "/objects/48", "/api/internal", "/login"]) {
    assert.equal(accountRedirect("client", path), "/client");
  }
  for (const path of ["/client", "/client/objects/47"]) {
    assert.equal(accountRedirect("client", path), null);
    assert.equal(accountRedirect("internal", path), "/");
    assert.equal(accountRedirect("denied", path), "/access-denied");
    assert.equal(accountRedirect("guest", path), "/login");
  }
  for (const identity of ["guest", "denied", "client", "internal"]) {
    assert.equal(accountRedirect(identity, accountHome(identity)), null);
    assert.equal(accountRedirect(identity, "/auth/confirm"), null);
  }
  assert.equal(accountRedirect("internal", "/warehouse"), null);
  assert.equal(accountRedirect("client", "/client-forged"), "/client");
});

test("identity resolver uses server-verified auth and DB identity, ignoring user metadata; errors deny", async () => {
  let signedIn = true, result = { data: "client", error: null }, rpcCalls = 0;
  const { getAccountIdentity } = loader({
    react: { cache: (fn) => fn },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: "A", user_metadata: { account_type: "internal", role: "admin" } } : null }, error: null }) }, rpc: async (name) => { assert.equal(name, "get_application_identity"); rpcCalls++; return result; } }) },
  })("services/accountIdentityService.ts");
  assert.equal(await getAccountIdentity(), "client");
  result = { data: "internal", error: null }; assert.equal(await getAccountIdentity(), "internal");
  result = { data: "admin", error: null }; assert.equal(await getAccountIdentity(), "denied");
  result = { data: "client", error: { message: "failure" } }; assert.equal(await getAccountIdentity(), "denied");
  signedIn = false; const before = rpcCalls;
  assert.equal(await getAccountIdentity(), "guest"); assert.equal(rpcCalls, before);
});

test("client service fetches scoped RPC only; guessed ID rejected; no broad internal service", async () => {
  let identity = "client";
  const calls = [];
  const { getClientObject, getClientObjectsPage } = loader({
    "next/navigation": navigation,
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (name, args) => {
      calls.push([name, args]);
      return { error: null, data: name === "get_client_object" && args.p_object_id !== 47 ? [] : [{ id: 47, name: "A", address: null, status: "Новий", cost_budget: 99 }] };
    }, from: () => { throw new Error("Direct table access forbidden"); } }) },
  })("services/clientPortalService.ts");
  assert.equal((await getClientObject(47)).id, 47);
  assert.deepEqual(calls[0], ["get_client_object", { p_object_id: 47 }]);
  await assert.rejects(() => getClientObject(48), /not-found/);
  assert.deepEqual(Object.keys((await getClientObjectsPage(2)).items[0]), ["id", "name", "address", "status"]);
  assert.deepEqual(calls.at(-1), ["get_client_objects", { p_page: 2 }]);
  const before = calls.length;
  for (identity of ["denied", "guest", "internal"]) await assert.rejects(() => getClientObject(47), /redirect:/);
  assert.equal(calls.length, before);
});

test("pagination is bounded; 21st row is only a hasMore sentinel", async () => {
  const { clientPage } = loader()("lib/clientPortal.ts");
  for (const value of [undefined,"-1","0","NaN","1e2","100001"]) assert.equal(clientPage(value), 1);
  assert.equal(clientPage("3"), 3);
  const { getClientObjectsPage } = loader({
    "next/navigation": navigation,
    "@/services/accountIdentityService": { getAccountIdentity: async () => "client" },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async () => ({ error: null, data: Array.from({ length: 21 }, (_, i) => ({ id: i + 1, name: "A" })) }) }) },
  })("services/clientPortalService.ts");
  const page = await getClientObjectsPage(1);
  assert.equal(page.items.length, 20); assert.equal(page.hasMore, true);
});

test("admin-only management denies worker, object_manager and no-profile clients before queries", async () => {
  let role = "admin", queries = 0;
  const service = loader({
    "@/services/profileService": { getCurrentUserProfile: async () => role ? { id: "A", role, is_active: true } : null },
    "@/lib/supabase/server": { createClient: async () => { queries++; return { rpc: async () => ({ data: [], error: null }) }; } },
  })("services/clientAccessService.ts");
  await service.getAdminClients("", 1); await service.changeClientGrant("A", 47, true); await service.changeClientActive("A", false);
  const before = queries;
  for (role of ["worker", "object_manager", null]) {
    await assert.rejects(() => service.getAdminClients("", 1));
    await assert.rejects(() => service.getAdminObjectClients(47, 1));
    await assert.rejects(() => service.changeClientGrant("A", 47, true));
    await assert.rejects(() => service.changeClientActive("A", true));
  }
  assert.equal(queries, before);
});

test("provisioning is admin guarded, server-only, fixed trusted classification, no employee/profile insert", async () => {
  let allowed = true, postReady = true, adminCalls = 0;
  const requests = [];
  const service = loader({
    "@/services/clientAccessService": { requireClientAdministrator: async () => { if (!allowed) throw new Error("denied"); } },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async () => ({ data: postReady, error: null }) }) },
    "@/lib/supabase/admin": { createServiceRoleClient: () => { adminCalls++; return { auth: { admin: { createUser: async (input) => { requests.push(input); return { data: { user: { id: "new-id", email: "not-returned", app_metadata: input.app_metadata } }, error: null }; } } } }; } },
  })("services/accountProvisioningService.ts");
  const input = { displayName: "Клієнт", email: "client@example.test", password: "correct-horse-123" };
  assert.deepEqual(await service.provisionAccount("client", input), { id: "new-id" });
  assert.deepEqual(requests[0].app_metadata, { account_type: "client" });
  assert.equal(requests[0].user_metadata.account_type, undefined);
  await service.provisionAccount("internal", input);
  assert.deepEqual(requests[1].app_metadata, { account_type: "internal" });
  postReady = false; const before = adminCalls;
  await assert.rejects(() => service.provisionAccount("client", input));
  assert.equal(adminCalls, before);
  await service.provisionAccount("internal", input); // PRE compatibility smoke
  allowed = false; const guarded = adminCalls;
  await assert.rejects(() => service.provisionAccount("client", input));
  assert.equal(adminCalls, guarded);
  assert.match(read("services/accountProvisioningService.ts"), /^import "server-only"/);
  assert.doesNotMatch(read("components/users/CreateAccountForm.tsx"), /SERVICE_ROLE|supabase\/admin/);
});

test("public registration is denied without any Auth API or direct profile call", async () => {
  const { registerUser } = loader()("app/actions/registerActions.ts");
  assert.equal((await registerUser({ fullName: "X", email: "a@b.test", password: "x", companyCode: "x" })).success, false);
});

test("unexpected server details never cross the client-management action boundary", async () => {
  const actions = loader({
    "next/cache": { revalidatePath() {} },
    "@/services/clientAccessService": { changeClientGrant: async () => { throw new Error("sensitive database internals"); }, changeClientActive: async () => { throw new Error("sensitive database internals"); } },
    "@/services/accountProvisioningService": { provisionAccount: async () => { throw new Error("sensitive database internals"); } },
  })("app/actions/clientAccessActions.ts");
  const id = "00000000-0000-0000-0000-000000000001";
  for (const response of [await actions.setClientGrant(id,47,true), await actions.setClientActive(id,true), await actions.createClientAccount({})]) {
    assert.equal(response.ok,false);
    assert.doesNotMatch(response.message,/sensitive|internals/);
  }
});

test("root never passes internal Sidebar/Header to a client, denied identity or guest", async () => {
  let identity = "client";
  function Sidebar() {} function Header() {} function AppShell() {}
  const Root = loader({
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/components/layout/Sidebar": { Sidebar },
    "@/components/layout/Header": { Header },
    "@/components/layout/AppShell": { default: AppShell, __esModule: true },
    "@/components/pwa/PWARegister": { default: () => null, __esModule: true },
  })("app/layout.tsx").default;
  for (identity of ["client", "guest", "denied"]) {
    const tree = await Root({ children: "portal-only" });
    assert.equal(tree.props.children.props.children[1], "portal-only");
  }
  identity = "internal";
  assert.equal((await Root({ children: "crm" })).props.children.props.children[1].type, AppShell);
});

test("existing internal roles retain their section permissions; client is not a role", () => {
  const { canAccessSection, canManageUsers } = loader()("lib/auth/permissions.ts");
  for (const role of ["admin", "object_manager", "worker"]) assert.equal(canAccessSection(role, "objects"), true);
  assert.equal(canManageUsers("admin"), true);
  for (const role of ["object_manager", "worker"]) assert.equal(canManageUsers(role), false);
  assert.doesNotMatch(read("types/userProfile.ts"), /["']client["']/);
});

test("client signup branch cannot create internal worker; no user-controlled identity classification", () => {
  const trigger = pre.match(/function public\.handle_new_user\(\)[\s\S]*?\$function\$([\s\S]*?)\$function\$/)[1];
  assert.match(trigger, /account_type text := new\.raw_app_meta_data ->> 'account_type'/);
  const clientBranch = trigger.split("if account_type = 'client' then")[1].split("elsif")[0];
  assert.match(clientBranch, /insert into public\.client_profiles/);
  assert.match(clientBranch, /values \(new.id, display_name, false\)/);
  assert.doesNotMatch(clientBranch, /public\.profiles|employee|worker/);
  assert.match(trigger, /account_type is null and private\.legacy_internal_signup_enabled\(\)/);
  assert.match(post, /as 'select false'/);
  assert.match(pre, /if to_regprocedure\('private\.legacy_internal_signup_enabled\(\)'\) is null then/);
  assert.match(pre, /and not private\.legacy_internal_signup_enabled\(\)/);
});

test("identity collision is serialized; client self write has no grants or policies", () => {
  assert.match(pre, /from auth\.users u where u\.id = identity_id for update/);
  for (const table of ["profiles", "client_profiles"]) assert.match(pre, new RegExp(`before insert or update on public\\.${table}`));
  assert.match(pre, /not exists \(select 1 from public\.profiles p where p.id = auth.uid\(\)\)/);
  assert.doesNotMatch(pre, /create policy[^;]*for (insert|update|delete|all)/i);
  assert.doesNotMatch(pre, /grant (?:all|insert|update|delete).*on (?:table )?public\.client_/i);
  assert.doesNotMatch(pre, /create policy[^;]*on public\.objects/i);
});

test("client DB queries scope by active current identity and explicit live grant; no arbitrary user ID", () => {
  const list = pre.match(/function public\.get_client_objects\([\s\S]*?\$function\$([\s\S]*?)\$function\$/)[1];
  const detail = pre.match(/function public\.get_client_object\([\s\S]*?\$function\$([\s\S]*?)\$function\$/)[1];
  assert.match(list, /if not private\.is_active_client\(\)/);
  assert.match(list, /a.client_user_id = auth.uid\(\) and a.revoked_at is null/);
  assert.match(list, /limit 21 offset/);
  assert.match(detail, /o.id = p_object_id and private.client_has_object_access\(o.id\)/);
  assert.doesNotMatch(list + detail, /select\s+\*|cost_budget|client_price|phone|customer/);
  assert.match(pre, /set revoked_at = now\(\), revoked_by = auth.uid\(\)/);
});

test("final audit pins all reviewed function bodies and retains sequence optimization fence", () => {
  const definitions = [...pre.matchAll(/create or replace function ([\s\S]*?)\nreturns [\s\S]*?as \$function\$([\s\S]*?)\$function\$;/g)];
  assert.equal(definitions.length, 12);
  for (const [, declaration, body] of definitions) {
    const signature = declaration.replace(/\bp_\w+ /g, "").replace(/ default (?:''|1)/g, "").replace(/,\s*/g, ",");
    const hash = createHash("md5").update(body).digest("hex");
    assert.ok(audit.includes(`('${signature}', '${hash}'`), `Audit body hash drift: ${signature}`);
  }
  assert.match(audit, /public_sequences as materialized[\s\S]*from pg_sequence s/);
  assert.match(audit, /set transaction read only/);
  assert.match(audit, /'runtime_session_proof',false/);
  assert.match(audit, /'EXISTING_DIRECT_API_OBSERVATION', 'REVIEW'/);
  assert.doesNotMatch(audit, /^\s*(create|alter|drop|grant|revoke|insert|update|delete)\s/gim);
});

test("PRE/POST do not redefine internal helpers, modify internal role constraints or grant internal tables", () => {
  assert.doesNotMatch(pre + post, /create or replace function private\.(is_active_user|has_role|is_admin)\(/);
  assert.doesNotMatch(pre + post, /alter table public\.profiles/);
  assert.doesNotMatch(pre + post, /grant\s+[^;]*on (?:table )?public\.(objects|warehouse|employees)/);
});
