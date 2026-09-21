// Mocked TS services + static SQL contracts only. Does not execute SQL.
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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
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
const mapping = loader()("lib/clientPortal.ts");
const stage = (id = 1, sort_order = 0) => ({ id, title: "Підготовка", status: "planned", sort_order });
const progress = () => ({
  object_id: 47, overall_percent: 25, completed_summary: "Підготовлено", next_summary: "Посадка",
  updated_at: "2026-09-21T12:00:00.000Z", stages: [stage()], version: 1,
});
const input = () => ({
  object_id: 47, overall_percent: 25, completed_summary: " Підготовлено ", next_summary: "  ",
  stages: [{ title: " Підготовка ", status: "planned", sort_order: 0 }], expected_version: 0,
});
const pre = read("database/client-portal-1.0b-pre-deploy.sql");
const audit = read("database/client-portal-1.0b-production-audit.sql");
const functions = [...pre.matchAll(/create or replace function\s+(public\.\w+)\(([^)]*)\)([\s\S]*?)as \$function\$([\s\S]*?)\$function\$/gu)];
const body = (name) => functions.find((m) => m[1] === `public.${name}`)[4];

test("client allowlist strips actors, version, created_at and arbitrary internals at both levels", () => {
  const dto = mapping.clientObjectProgressDto({ ...progress(), created_by: "secret", updated_by: "secret", created_at: "private", cost: 10, employee_id: 4,
    stages: [{ ...stage(), version: 8, cost: 20, note: "internal", created_at: "private" }] });
  assert.deepEqual(Object.keys(dto), ["object_id", "overall_percent", "completed_summary", "next_summary", "updated_at", "stages"]);
  assert.deepEqual(dto.stages, [stage()]);
  const management = mapping.managementClientObjectProgressDto({ ...progress(), created_by: "secret" });
  assert.deepEqual(Object.keys(management), [...Object.keys(dto), "version"]);
  assert.equal(management.version, 1);
  for (const version of [0, -1, null, "1", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => mapping.managementClientObjectProgressDto({ ...progress(), version }));
  }
});

test("percentage is manual 0..100 integer, never derived from stages", () => {
  for (const overall_percent of [0, 50, 100]) {
    assert.equal(mapping.clientObjectProgressDto({ ...progress(), overall_percent, stages: [] }).overall_percent, overall_percent);
    assert.equal(mapping.clientProgressSaveInput({ ...input(), overall_percent }).overall_percent, overall_percent);
  }
  for (const overall_percent of [-1, 101, 0.5, NaN, Infinity, null, "25"]) {
    assert.throws(() => mapping.clientObjectProgressDto({ ...progress(), overall_percent }));
    assert.throws(() => mapping.clientProgressSaveInput({ ...input(), overall_percent }));
  }
});

test("stage limit/order/status, IDs and duplicate checks fail closed", () => {
  const stages = Array.from({ length: 50 }, (_, i) => stage(i + 1, i));
  assert.equal(mapping.clientObjectProgressDto({ ...progress(), stages }).stages.length, 50);
  assert.equal(mapping.clientProgressSaveInput({ ...input(), stages }).stages.length, 50);
  for (const value of [null, {}, [...stages, stage(51, 50)], [stage(1), stage(1, 2)], [stage(1), stage(2)]]) {
    assert.throws(() => mapping.clientObjectProgressDto({ ...progress(), stages: value }));
    assert.throws(() => mapping.clientProgressSaveInput({ ...input(), stages: value }));
  }
  for (const status of ["planned", "in_progress", "completed"]) {
    assert.equal(mapping.clientObjectProgressDto({ ...progress(), stages: [{ ...stage(), status }] }).stages[0].status, status);
  }
  for (const changes of [{ id: "1" }, { id: 0 }, { status: "internal" }, { status: null }, { sort_order: -1 }, { sort_order: 2147483648 }, { title: " " }, { title: "A".repeat(121) }]) {
    assert.throws(() => mapping.clientObjectProgressDto({ ...progress(), stages: [{ ...stage(), ...changes }] }));
    assert.throws(() => mapping.clientProgressSaveInput({ ...input(), stages: [{ ...stage(), ...changes }] }));
  }
  assert.deepEqual(mapping.clientObjectProgressDto({ ...progress(), stages: [stage(2, 9), stage(1, 0)] }).stages, [stage(1, 0), stage(2, 9)]);
});

test("publish input uses explicit fields, trimmed bounded summaries and zero first-version", () => {
  const actual = mapping.clientProgressSaveInput({ ...input(), version: 8, updated_by: "fake", created_at: "fake",
    stages: [{ ...input().stages[0], created_at: "fake", employee_id: 5 }] });
  assert.deepEqual(actual, { ...input(), completed_summary: "Підготовлено", next_summary: null,
    stages: [{ id: null, title: "Підготовка", status: "planned", sort_order: 0 }] });
  assert.equal(mapping.clientProgressSaveInput({ ...input(), completed_summary: "🌿".repeat(2000) }).completed_summary.length, 4000);
  for (const expected_version of [null, -1, 0.5, "0"]) assert.throws(() => mapping.clientProgressSaveInput({ ...input(), expected_version }));
  assert.equal(mapping.clientProgressSaveInput({ ...input(), expected_version: 4 }).expected_version, 4);
  assert.throws(() => mapping.clientProgressSaveInput({ ...input(), completed_summary: "A".repeat(2001) }));
  assert.throws(() => mapping.clientObjectProgressDto({ ...progress(), next_summary: { secret: true } }));
});

const navigation = { redirect: (path) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("not-found"); } };
test("client read scopes by object only, preserves access gate, strips metadata and handles unpublished", async () => {
  let identity = "client", result = { data: [progress()], error: null }, created = 0;
  const calls = [];
  const service = loader({
    "next/navigation": navigation,
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/lib/supabase/server": { createClient: async () => {
      created++;
      return { rpc: async (name, args) => { calls.push([name, args]); return result; }, from: () => assert.fail("no table reads") };
    } },
  })("services/clientPortalService.ts");
  assert.equal((await service.getClientObjectProgress(47)).overall_percent, 25);
  assert.deepEqual(calls, [["get_client_object_progress", { p_object_id: 47 }]]);
  assert.equal("version" in await service.getClientObjectProgress(47), false);
  result = { data: [], error: null }; assert.equal(await service.getClientObjectProgress(47), null);
  result = { data: null, error: { code: "42501", message: "private" } };
  for (const id of [47, 48, 999]) await assert.rejects(() => service.getClientObjectProgress(id), /not-found/);
  result = { data: [{ ...progress(), object_id: 48 }], error: null };
  await assert.rejects(() => service.getClientObjectProgress(47), /not-found/);
  const before = created;
  for (identity of ["denied", "guest", "internal"]) await assert.rejects(() => service.getClientObjectProgress(47), /redirect:/);
  identity = "client";
  await assert.rejects(() => service.getClientObjectProgress(-1), /not-found/);
  assert.equal(created, before);
});

test("only active admin/object_manager reach management progress RPCs; clients and workers do not", async () => {
  let profile = null, created = 0, result = { data: [progress()], error: null };
  const calls = [];
  const service = loader({
    "@/services/profileService": { getCurrentUserProfile: async () => profile },
    "@/lib/supabase/server": { createClient: async () => { created++; return { rpc: async (name, args) => { calls.push([name, args]); return result; } }; } },
  })("services/clientProgressManagementService.ts");
  for (profile of [null, { role: "worker", is_active: true }, { role: "client", is_active: true }, { role: "admin", is_active: false }]) {
    await assert.rejects(() => service.getManagementClientObjectProgress(47), /лише активному/);
    await assert.rejects(() => service.saveClientObjectProgress(input()), /лише активному/);
  }
  assert.equal(created, 0);
  for (const role of ["admin", "object_manager"]) {
    profile = { role, is_active: true };
    assert.equal((await service.getManagementClientObjectProgress(47)).version, 1);
    assert.equal((await service.saveClientObjectProgress(input())).version, 1);
    assert.deepEqual(calls.at(-1), ["save_client_object_progress", {
      p_object_id: 47, p_overall_percent: 25, p_completed_summary: "Підготовлено", p_next_summary: null,
      p_stages: [{ id: null, title: "Підготовка", status: "planned", sort_order: 0 }], p_expected_version: 0,
    }]);
  }
  result = { data: [], error: null }; assert.equal(await service.getManagementClientObjectProgress(47), null);
  const before = created;
  await assert.rejects(() => service.saveClientObjectProgress({ ...input(), overall_percent: 101 }));
  assert.equal(created, before);
});

test("management stale/domain errors stay safe; no raw details, automatic retry or refresh on failure", async () => {
  let result, calls = 0;
  const service = loader({
    "@/services/profileService": { getCurrentUserProfile: async () => ({ role: "admin", is_active: true }) },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async () => { calls++; return result; } }) },
  })("services/clientProgressManagementService.ts");
  for (const [code, message] of [["40001", /уже змінено/], ["22023", /Перевірте/], ["42501", /Недостатньо прав/], ["P0002", /не знайдено/], ["XX000", /Не вдалося/]]) {
    result = { data: null, error: { code, message: "SECRET" } };
    await assert.rejects(() => service.saveClientObjectProgress(input()), (e) => { assert.match(e.message, message); assert.doesNotMatch(e.message, /SECRET/); return true; });
  }
  assert.equal(calls, 5);
  result = { data: [{ ...progress(), version: 5 }], error: null };
  assert.equal((await service.saveClientObjectProgress({ ...input(), expected_version: 4 })).version, 5);
  result = { data: [progress()], error: null };
  await assert.rejects(() => service.saveClientObjectProgress({ ...input(), expected_version: 4 }), /Не вдалося/);
});

test("SQL creates only isolated schema, identity, FK, RLS default-deny and deferred ordering contracts", () => {
  assert.match(pre, /object_id bigint primary key references public\.objects\(id\) on delete cascade/u);
  assert.match(pre, /id bigint generated always as identity primary key/u);
  assert.equal([...pre.matchAll(/uuid references auth\.users\(id\) on delete set null/gu)].length, 2);
  assert.match(pre, /unique \(object_id, sort_order\) deferrable initially deferred/u);
  assert.match(pre, /overall_percent between 0 and 100/u);
  assert.match(pre, /version >= 1/u);
  assert.doesNotMatch(pre, /create policy|grant\s+(?:select|insert|update|delete)/iu);
  assert.match(pre, /revoke all on table public\.client_object_progress, public\.client_object_progress_stages from public, anon, authenticated/u);
  assert.match(pre, /revoke all on sequence public\.client_object_progress_stages_id_seq from public, anon, authenticated/u);
  assert.equal([...pre.matchAll(/enable row level security/gu)].length, 2);
});

test("SQL client RPC independently enforces session/active/grant and exact nested allowlist", () => {
  const sql = body("get_client_object_progress");
  for (const guard of ["auth.uid() is null", "private.is_active_client()", "private.client_has_object_access(p_object_id)"]) assert.ok(sql.includes(guard));
  assert.ok(sql.indexOf("errcode = '42501'") < sql.indexOf("return query"));
  assert.doesNotMatch(sql, /created_by|updated_by|\bversion\b|created_at|p_client_user_id/u);
  const keys = [...sql.matchAll(/'(id|title|status|sort_order)'/gu)].map((m) => m[1]);
  assert.deepEqual(keys, ["id", "title", "status", "sort_order"]);
  assert.match(sql, /order by st\.sort_order, st\.id limit 50/u);
  assert.match(sql, /where p\.object_id = p_object_id/u);
  assert.equal(functions.length, 3);
  for (const fn of functions) assert.match(fn[3], /security definer set search_path = ''/u);
});

test("SQL both management RPCs require auth/active/management roles before accessing data", () => {
  for (const name of ["get_management_client_object_progress", "save_client_object_progress"]) {
    const sql = body(name);
    for (const guard of ["auth.uid() is null", "private.is_active_user()", "private.has_role(array['admin','object_manager']::text[])"]) assert.ok(sql.includes(guard));
    assert.ok(sql.indexOf("errcode = '42501'") < sql.indexOf("from public."));
    assert.match(sql, /errcode = 'P0002'/u);
  }
});

test("SQL atomic publish locks parent before version read, prevents stale/first-publish races", () => {
  const sql = body("save_client_object_progress");
  const parentLock = sql.indexOf("perform 1 from public.objects o where o.id = p_object_id for update");
  assert.ok(parentLock > 0 && parentLock < sql.indexOf("select p.version into v_version"));
  assert.match(sql, /p_expected_version <> coalesce\(v_version, 0\)/u);
  assert.match(sql, /errcode = '40001'/u);
  assert.ok(sql.indexOf("errcode = '40001'") < sql.indexOf("insert into public.client_object_progress("));
  assert.match(sql, /version = p\.version \+ 1/u);
  assert.match(sql, /v_next, 1, v_now, v_now, auth\.uid\(\), auth\.uid\(\)/u);
  assert.doesNotMatch(sql, /exception\s+when|update public\.objects|insert into public\.objects/iu);
  assert.match(sql, /updated_at = v_now, updated_by = auth\.uid\(\)/u);
});

test("SQL validates stage count/shape/ownership/duplicates before mutation, preserves retained IDs", () => {
  const sql = body("save_client_object_progress");
  assert.match(sql, /jsonb_array_length\(p_stages\) > 50/u);
  assert.ok(sql.indexOf("Stages must be an array") < sql.indexOf("pg_catalog.jsonb_array_length"));
  assert.match(sql, /v_order = any\(v_orders\)/u);
  assert.match(sql, /v_id = any\(v_ids\)/u);
  assert.match(sql, /where s\.id = i\.id and s\.object_id = p_object_id/u);
  assert.ok(sql.indexOf("Stage does not belong") < sql.indexOf("insert into public.client_object_progress("));
  assert.match(sql, /delete from public\.client_object_progress_stages s where s\.object_id = p_object_id and not \(s\.id = any\(v_ids\)\)/u);
  assert.match(sql, /where s\.id = v_id and s\.object_id = p_object_id/u);
  assert.doesNotMatch(sql, /set[\s\S]{0,80}created_at\s*=/u);
});

test("new feature uses no Tasks/Work Logs/finance/services or service role; no 1.0A mutations", () => {
  for (const name of ["services/clientProgressManagementService.ts", "services/clientPortalService.ts"]) {
    const text = read(name);
    assert.match(text, /import "server-only"/u);
    assert.doesNotMatch(text, /service.role|supabaseAdmin|taskService|workLogService|\.from\(/iu);
  }
  assert.doesNotMatch(pre, /public\.(?:profiles|client_profiles|client_object_access|object_tasks|work_logs|object_expenses|employees|activity_logs|warehouse\w*)\b/u);
  assert.doesNotMatch(pre, /(?:create or replace|alter|drop) function (?:private\.|public\.(?:handle_new_user|get_application_identity|get_client_object\())/iu);
});

test("audit reviewed body hashes/signatures match PRE exactly (no SQL execution)", () => {
  for (const [, name, args, , source] of functions) {
    const types = args.trim().split(",").map((p) => p.trim().split(/\s+/u).slice(1).join(" ")).join(",");
    const signature = `${name}(${types})`;
    const hash = createHash("md5").update(source).digest("hex");
    assert.ok(audit.includes(`('${signature}','${hash}'`), signature);
    assert.ok(pre.includes(`${signature} from public`) || pre.includes(`${signature},`), `ACL signature: ${signature}`);
  }
  const legacyAudit = read("database/client-portal-1.0a-production-audit.sql");
  for (const match of legacyAudit.matchAll(/\('([^']+)', '([0-9a-f]{32})'/gu)) {
    assert.ok(audit.includes(`('${match[1]}','${match[2]}'`), `1.0A hash: ${match[1]}`);
  }
});

test("audit is catalog-only, one consolidated summary, safe sequence/ACL catalog handling", () => {
  const executable = audit.replace(/--[^\n]*/gu, "");
  assert.match(executable, /begin;\s*set transaction read only;/u);
  assert.doesNotMatch(executable, /\b(?:create|alter|drop|grant|revoke|insert|update|delete)\s+(?:table|function|policy|into|from|all|execute|public\.)/iu);
  assert.doesNotMatch(executable, /\b(?:from|join) (?:public|auth)\./iu);
  assert.doesNotMatch(executable, /\bselect (?:private|public)\.\w+\(/iu);
  assert.match(executable, /identity_sequence as materialized \([\s\S]+from pg_sequence/u);
  assert.match(executable, /array_ndims\(f\.proacl\)=1/u);
  assert.match(executable, /CLIENT_PORTAL_1_0B_STRUCTURAL_SUMMARY/u);
  assert.match(executable, /case when bool_and\(matches\) then 'PASS' else 'FAIL'/u);
  assert.match(executable, /select check_name, status, evidence, notes from results order by summary_order, check_name;\s*commit;/u);
});
