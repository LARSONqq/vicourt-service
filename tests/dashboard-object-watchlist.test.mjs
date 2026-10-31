// Focused Dashboard 4.0D3A tests. No SQL/network/browser execution.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, "utf8");

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const code = ts.transpileModule(read(filename), { compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    } }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) {
        const base = resolve(name.slice(2));
        return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
      }
      return require(name);
    };
    new Function("require", "module", "exports", code)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

const today = "2026-10-31";
const workerRow = (id = 11, overrides = {}) => ({
  object_id: id,
  name: `Об’єкт ${id}`,
  status: "В роботі",
  responsible_employee_name: "Іван Петренко",
  overdue_task_count: 2,
  supervision_overdue: false,
  ...overrides,
});
const managementRow = (id = 11, overrides = {}) => ({
  ...workerRow(id),
  has_overdue_payment: true,
  overdue_payment_amount: "1250.50",
  missing_client_price: true,
  ...overrides,
});

function fixture(role, responses = {}, employeeId = role === "worker" ? 7 : null) {
  const calls = [];
  let settingsCalls = 0;
  const client = { rpc(name, args) {
    calls.push([name, args]);
    return Promise.resolve(responses[name] ?? { data: [], error: null });
  } };
  const load = loader({
    react: { ...React, cache: (fn) => fn },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/services/dashboardService": { getDashboardContext: async () => ({
      profile: { role, employee_id: employeeId }, today,
    }) },
    "@/services/settingsService": { getAppSettings: async () => {
      settingsCalls += 1;
      return { currency: "UAH" };
    } },
  });
  return { calls, get settingsCalls() { return settingsCalls; }, service: load("services/dashboardObjectWatchlistService.ts"), load };
}

test("worker calls only its operational RPC and receives a physically finance-free DTO", async () => {
  const current = fixture("worker", {
    get_dashboard_worker_object_watchlist: { data: [workerRow()], error: null },
  });
  const data = await current.service.getDashboardObjectWatchlist();
  assert.deepEqual(current.calls, [["get_dashboard_worker_object_watchlist", { p_business_date: today }]]);
  assert.equal(current.settingsCalls, 0);
  assert.deepEqual(data, { kind: "worker", items: [{
    objectId: 11, name: "Об’єкт 11", status: "В роботі",
    responsibleEmployeeName: "Іван Петренко", overdueTaskCount: 2,
    supervisionOverdue: false, href: "/objects/11",
  }] });
  assert.doesNotMatch(JSON.stringify(data), /finance|payment|amount|price|cost|purchase|expense|hourly/i);
  const types = read("types/dashboardObjectWatchlist.ts");
  const workerTypes = types.slice(types.indexOf("export type WorkerObjectWatchlistItem"),
    types.indexOf("export type ManagementObjectWatchlistItem"));
  assert.doesNotMatch(workerTypes, /payment|amount|price|cost|finance/i);
});

test("unlinked worker returns an empty personal watchlist with no RPC or team fallback", async () => {
  const current = fixture("worker", {}, null);
  assert.deepEqual(await current.service.getDashboardObjectWatchlist(), { kind: "worker", items: [] });
  assert.deepEqual(current.calls, []);
  assert.equal(current.settingsCalls, 0);
});

test("admin and object_manager call only the management RPC after role determination", async () => {
  for (const role of ["admin", "object_manager"]) {
    const current = fixture(role, {
      get_dashboard_management_object_watchlist: { data: [managementRow()], error: null },
    });
    const data = await current.service.getDashboardObjectWatchlist();
    assert.equal(data.kind, "management");
    assert.equal(data.currency, "UAH");
    assert.equal(data.items[0].hasOverduePayment, true);
    assert.equal(data.items[0].overduePaymentAmount, 1250.5);
    assert.equal(data.items[0].missingClientPrice, true);
    assert.deepEqual(current.calls, [["get_dashboard_management_object_watchlist", { p_business_date: today }]]);
    assert.equal(current.settingsCalls, 1);
  }
});

test("strict row allowlists, active statuses, source bound and safe errors reject contract drift", async () => {
  for (const row of [
    { ...workerRow(), overdue_payment_amount: 999 },
    workerRow(11, { status: "Завершено" }),
    workerRow(11, { overdue_task_count: -1 }),
  ]) {
    const current = fixture("worker", {
      get_dashboard_worker_object_watchlist: { data: [row], error: null },
    });
    await assert.rejects(() => current.service.getDashboardObjectWatchlist(), (error) =>
      error.message === "Не вдалося завантажити об’єкти під контролем." && !error.message.includes("999"));
  }
  const overLimit = fixture("worker", {
    get_dashboard_worker_object_watchlist: {
      data: Array.from({ length: 6 }, (_, index) => workerRow(index + 1)), error: null,
    },
  });
  await assert.rejects(() => overLimit.service.getDashboardObjectWatchlist(), /Не вдалося завантажити/);
  const inconsistent = fixture("admin", {
    get_dashboard_management_object_watchlist: {
      data: [managementRow(11, { has_overdue_payment: false })], error: null,
    },
  });
  await assert.rejects(() => inconsistent.service.getDashboardObjectWatchlist(), /Не вдалося завантажити/);
});

test("Watchlist replaces Active Objects, keeps D2 and Today, and renders at most two useful badges", async () => {
  const load = loader({
    react: { ...React, cache: (fn) => fn },
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "next/navigation": { unstable_rethrow: () => {} },
    "@/services/dashboardObjectWatchlistService": { getDashboardObjectWatchlist: async () => ({
      kind: "management", currency: "UAH", items: [{
        objectId: 11, name: "Довга назва об’єкта", status: "Під періодичним наглядом",
        responsibleEmployeeName: "Іван Петренко", overdueTaskCount: 3, supervisionOverdue: true,
        hasOverduePayment: true, overduePaymentAmount: 1250.5, missingClientPrice: true,
        href: "/objects/11",
      }],
    }) },
  });
  const html = renderToStaticMarkup(await load("components/dashboard/DashboardObjectWatchlist.tsx").DashboardObjectWatchlist());
  assert.match(html, /Об’єкти під контролем/);
  assert.match(html, /href="\/objects\/11"/);
  assert.match(html, /Платіж прострочено/);
  assert.match(html, /Огляд прострочено/);
  assert.doesNotMatch(html, /3 прострочені завдання|Не вказана ціна/);
  assert.match(html, /min-h-20|min-h-11/);
  assert.doesNotMatch(read("components/dashboard/DashboardObjectWatchlist.tsx"), /["']use client["']/);

  const page = read("app/page.tsx");
  assert.match(page, /<DashboardObjectWatchlist/);
  assert.match(page, /<DashboardAttention/);
  assert.match(page, /<DashboardTodayTasks/);
  assert.doesNotMatch(page, /DashboardObjectsOverview|Активні об’єкти/);
});

test("Watchlist empty and error states are generic, local and metadata-safe", async () => {
  const baseMocks = {
    react: { ...React, cache: (fn) => fn },
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "next/navigation": { unstable_rethrow: () => {} },
  };
  const emptyLoad = loader({ ...baseMocks,
    "@/services/dashboardObjectWatchlistService": { getDashboardObjectWatchlist: async () => ({ kind: "worker", items: [] }) },
  });
  assert.match(renderToStaticMarkup(await emptyLoad("components/dashboard/DashboardObjectWatchlist.tsx").DashboardObjectWatchlist()),
    /немає активних об’єктів, що потребують уваги/);

  const failedLoad = loader({ ...baseMocks,
    "@/services/dashboardObjectWatchlistService": { getDashboardObjectWatchlist: async () => { throw new Error("DB_SECRET"); } },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const html = renderToStaticMarkup(await failedLoad("components/dashboard/DashboardObjectWatchlist.tsx").DashboardObjectWatchlist());
    assert.match(html, /Не вдалося завантажити дані/);
    assert.doesNotMatch(html, /DB_SECRET/);
  } finally { console.error = originalError; }
});

test("worker SQL is assigned-only, operational-only, deterministic and bounded to five", () => {
  const sql = read("database/dashboard-4.0d3a-worker-object-watchlist-pre-deploy.sql");
  assert.match(sql, /get_dashboard_worker_object_watchlist\(p_business_date date\)/);
  assert.match(sql, /select p\.role::text,p\.employee_id::bigint/);
  assert.match(sql, /v_role is distinct from 'worker'/);
  assert.match(sql, /if v_employee_id is null then return/);
  assert.doesNotMatch(sql, /p_employee_id|p_role/);
  assert.match(sql, /o\.responsible_employee_id=v_employee_id/);
  assert.match(sql, /t\.assigned_employee_id=v_employee_id/);
  assert.match(sql, /t\.task_source='manual'/);
  assert.match(sql, /t\.status<>'Виконано'/);
  assert.match(sql, /t\.due_date<p_business_date/);
  assert.match(sql, /coalesce\(o\.status='Під періодичним наглядом'[\s\S]*o\.next_supervision_date<p_business_date,false\)/);
  assert.match(sql, /order by c\.supervision_overdue desc,\(c\.overdue_count>0\) desc,c\.overdue_count desc,[\s\S]*c\.object_id/);
  assert.match(sql, /limit 5/);
  const body = sql.split("as $function$")[1].split("$function$")[0];
  assert.doesNotMatch(body, /object_payments|object_payment_schedule|client_price|purchase_price|service_cost|hourly_rate|select o\.\*/i);
});

test("management SQL preserves active scope, signals, allocation parity and deterministic ranking", () => {
  const sql = read("database/dashboard-4.0d3a-management-object-watchlist-pre-deploy.sql");
  assert.match(sql, /private\.has_role\(array\['admin','object_manager'\]::text\[\]\)/);
  assert.match(sql, /using errcode='42501'[\s\S]*from public\.objects/);
  assert.match(sql, /t\.task_source='manual'/);
  assert.match(sql, /t\.status<>'Виконано'/);
  assert.match(sql, /o\.client_price is null/);
  assert.match(sql, /coalesce\(o\.status='Під періодичним наглядом'[\s\S]*o\.next_supervision_date<p_business_date,false\)/);
  assert.match(sql, /greatest\(c\.value,0::double precision\)/);
  assert.match(sql, /order by c\.due_date,c\.created_at,c\.row_id/);
  assert.match(sql, /rows between unbounded preceding and 1 preceding/);
  assert.match(sql, /r\.due_date<p_business_date and r\.remaining>0/);
  assert.match(sql, /order by \(c\.overdue_amount>0\) desc,c\.supervision_overdue desc,\(c\.overdue_count>0\) desc,[\s\S]*c\.object_id/);
  assert.match(sql, /limit 5/);
  assert.doesNotMatch(sql.split("as $function$")[1].split("$function$")[0], /'worker'/);
});

test("management overdue payment examples match canonical schedule allocation", () => {
  const { calculateObjectPaymentSchedule } = loader()("lib/objectPaymentSchedule.ts");
  const schedule = [
    { id: 3, object_id: 11, title: "C", amount: 30, due_date: "2026-10-28", created_at: "2026-10-03T00:00:00Z" },
    { id: 2, object_id: 11, title: "B", amount: 40, due_date: "2026-10-28", created_at: "2026-10-01T00:00:00Z" },
    { id: 1, object_id: 11, title: "A", amount: 30, due_date: today, created_at: "2026-10-02T00:00:00Z" },
  ];
  const result = calculateObjectPaymentSchedule(schedule, 45, 100, today);
  const overdueAmount = result.items.filter((item) => item.status === "overdue")
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  assert.equal(overdueAmount, 25);
  assert.deepEqual(result.items.map(({ id, paidAmount, remainingAmount }) => ({ id, paidAmount, remainingAmount })), [
    { id: 2, paidAmount: 40, remainingAmount: 0 },
    { id: 3, paidAmount: 5, remainingAmount: 25 },
    { id: 1, paidAmount: 0, remainingAmount: 30 },
  ]);
});

test("PRE hashes, ACLs, read-only audit and D1/D2/Reports preservation are pinned", () => {
  const worker = read("database/dashboard-4.0d3a-worker-object-watchlist-pre-deploy.sql");
  const management = read("database/dashboard-4.0d3a-management-object-watchlist-pre-deploy.sql");
  const audit = read("database/dashboard-4.0d3a-object-watchlist-production-audit.sql");
  const body = (sql) => sql.split("as $function$")[1].split("$function$")[0];
  assert.equal(createHash("md5").update(body(worker)).digest("hex"), "375c13b6a13c81bf03369c4dd3d3779b");
  assert.equal(createHash("md5").update(body(management)).digest("hex"), "45b54fb2471f832aa8d52b818dceb9ea");
  for (const sql of [worker, management]) {
    assert.match(sql, /security definer/);
    assert.match(sql, /stable/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /revoke all[\s\S]*from public,anon,authenticated,service_role/);
    assert.match(sql, /grant execute[\s\S]*to authenticated/);
    assert.match(sql, /a\.is_grantable/);
    assert.match(sql, /not has_function_privilege\('service_role'/);
    assert.match(sql, /has_schema_privilege\('authenticated','public','USAGE'\)/);
  }
  assert.match(audit, /begin;\s*set transaction read only;\s*set local search_path = pg_catalog/);
  assert.match(audit, /count\(\*\)=16/);
  assert.equal([...audit.matchAll(/^    \('([^']+)', \$check\$$/gm)].length, 16);
  assert.match(audit, /runtime_authorization_tested',false/);
  assert.match(audit, /p\.prosrc !~\* \$regex\$select\[\[:space:\]\]\+\(distinct\[\[:space:\]\]\+\)\?\(p\|o\|e\|t\|c\)/);
  assert.match(audit, /select o\.id::bigint object_id,pg_catalog\.left\(coalesce\(o\.name,'Об’єкт'\),500\)::text name/);
  assert.match(audit, /concat_ws\(' ',e\.first_name,e\.last_name\)/);
  assert.match(audit, /order by c\.supervision_overdue desc,\(c\.overdue_count>0\) desc,c\.overdue_count desc,\s+c\.oldest_relevant_date nulls last,c\.object_id/);
  assert.match(audit, /order by \(c\.overdue_amount>0\) desc,c\.supervision_overdue desc,\(c\.overdue_count>0\) desc,\s+c\.missing_price desc,c\.overdue_count desc,c\.oldest_relevant_date nulls last,c\.object_id/);
  for (const hash of [
    "84b68bbb2972bba102c5ca846a80ec22", "f66d1a1533c26c065096c44218ce5063",
    "d12d67564a3b54c9e5208e8f6e56f23b", "b7b83ede0fc3114d40055c4e9e6447af",
    "12ac36c5e65ffcf130187d0ab09f2da1", "375c13b6a13c81bf03369c4dd3d3779b",
    "45b54fb2471f832aa8d52b818dceb9ea",
  ]) assert.match(audit, new RegExp(hash));
  assert.equal(read("database/dashboard-4.0d2-operational-attention-pre-deploy.sql").includes("84b68bbb2972bba102c5ca846a80ec22"), true);
  assert.equal(read("database/dashboard-4.0d2-finance-attention-pre-deploy.sql").includes("f66d1a1533c26c065096c44218ce5063"), true);
});
