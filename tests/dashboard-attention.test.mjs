// Focused Dashboard 4.0D2 tests. No SQL/network/browser execution.
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

const today = "2026-10-29";
const operationalRow = (id = 7, overrides = {}) => ({
  item_id: `task_overdue:${id}`,
  kind: "task_overdue",
  severity: "critical",
  timing: "overdue",
  title: "Прострочене завдання",
  description: `Завдання ${id}`,
  entity_type: "task",
  entity_id: id,
  object_id: 11,
  relevant_date: "2026-10-28",
  href: `/tasks/${id}`,
  ...overrides,
});
const financeRow = (id = 21, overrides = {}) => ({
  item_id: `payment_overdue:${id}`,
  kind: "payment_overdue",
  severity: "critical",
  timing: "overdue",
  title: "Прострочений платіж",
  description: "Етап 1 · Об’єкт",
  entity_type: "payment_schedule",
  entity_id: id,
  object_id: 11,
  relevant_date: "2026-10-27",
  href: "/objects/11?tab=finance#payment-schedule",
  amount: "1250.50",
  ...overrides,
});

function fixture(role, responses = {}) {
  const calls = [];
  const client = { rpc(name, args) {
    calls.push([name, args]);
    const value = responses[name] ?? { data: [], error: null };
    return typeof value === "function" ? value() : Promise.resolve(value);
  } };
  const load = loader({
    react: { ...React, cache: (fn) => fn },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/services/dashboardService": { getDashboardContext: async () => ({
      profile: { role, employee_id: role === "worker" ? 7 : null }, today,
    }) },
    "@/services/settingsService": { getAppSettings: async () => ({ currency: "UAH" }) },
  });
  return { calls, service: load("services/dashboardAttentionService.ts"), load };
}

test("worker executes only the operational RPC and receives a finance-free structural DTO", async () => {
  const current = fixture("worker", {
    get_dashboard_operational_attention: { data: [operationalRow()], error: null },
  });
  const data = await current.service.getDashboardAttention();
  assert.deepEqual(current.calls, [["get_dashboard_operational_attention", { p_business_date: today }]]);
  assert.equal(data.kind, "worker");
  assert.equal(data.items[0].source, "operational");
  assert.doesNotMatch(JSON.stringify(data), /amount|finance|payment|cost|price|hourly_rate/i);
  const workerType = read("types/dashboardAttention.ts").slice(
    read("types/dashboardAttention.ts").indexOf("export type WorkerDashboardAttentionData"),
    read("types/dashboardAttention.ts").indexOf("export type ManagementDashboardAttentionData")
  );
  assert.doesNotMatch(workerType, /Finance|currency|amount|payment|cost|price/i);
});

test("admin/object_manager load both bounded sources and merge deterministically to eight", async () => {
  for (const role of ["admin", "object_manager"]) {
    const operational = Array.from({ length: 8 }, (_, index) => operationalRow(index + 1, {
      item_id: `warehouse_low:${index + 1}`, kind: "warehouse_low", severity: "warning", timing: "current",
      entity_type: "warehouse_item", entity_id: index + 1, object_id: null, relevant_date: null,
      href: `/warehouse/${index + 1}`,
    }));
    const current = fixture(role, {
      get_dashboard_operational_attention: { data: operational, error: null },
      get_dashboard_finance_attention: { data: [financeRow()], error: null },
    });
    const data = await current.service.getDashboardAttention();
    assert.equal(data.kind, "management");
    assert.equal(data.currency, "UAH");
    assert.equal(data.items.length, 8);
    assert.equal(data.items[0].source, "finance");
    assert.deepEqual(current.calls.map(([name]) => name).sort(), [
      "get_dashboard_finance_attention", "get_dashboard_operational_attention",
    ]);
  }
});

test("strict RPC allowlists, source bounds and safe errors reject data drift", async () => {
  for (const row of [
    { ...operationalRow(), storage_path: "SECRET" },
    operationalRow(7, { href: "/tasks/999" }),
    operationalRow(7, { severity: "info" }),
  ]) {
    const current = fixture("worker", {
      get_dashboard_operational_attention: { data: [row], error: null },
    });
    await assert.rejects(() => current.service.getDashboardAttention(), (error) =>
      error.message === "Не вдалося завантажити перелік уваги." && !error.message.includes("SECRET"));
  }
  const overLimit = fixture("worker", {
    get_dashboard_operational_attention: { data: Array.from({ length: 9 }, (_, i) => operationalRow(i + 1)), error: null },
  });
  await assert.rejects(() => overLimit.service.getDashboardAttention(), /Не вдалося завантажити/);

  const financeDrift = fixture("admin", {
    get_dashboard_operational_attention: { data: [], error: null },
    get_dashboard_finance_attention: { data: [{ ...financeRow(), client_price: 999999 }], error: null },
  });
  const safePartial = await financeDrift.service.getDashboardAttention();
  assert.equal(safePartial.partialFailure, true);
  assert.deepEqual(safePartial.items, []);
  assert.doesNotMatch(JSON.stringify(safePartial), /client_price|999999/);
});

test("management source failures stay local, while failure of both sources is safe", async () => {
  const partial = fixture("admin", {
    get_dashboard_operational_attention: { data: null, error: { message: "OP_SECRET" } },
    get_dashboard_finance_attention: { data: [financeRow()], error: null },
  });
  const data = await partial.service.getDashboardAttention();
  assert.equal(data.partialFailure, true);
  assert.equal(data.items.length, 1);
  assert.doesNotMatch(JSON.stringify(data), /SECRET/);

  const failed = fixture("admin", {
    get_dashboard_operational_attention: { data: null, error: { message: "OP_SECRET" } },
    get_dashboard_finance_attention: { data: null, error: { message: "FIN_SECRET" } },
  });
  await assert.rejects(() => failed.service.getDashboardAttention(), (error) =>
    error.message === "Не вдалося завантажити перелік уваги." && !/SECRET/.test(error.message));
});

test("Attention is a server-rendered dense surface; the separate overdue widget is removed", async () => {
  const load = loader({
    react: { ...React, cache: (fn) => fn },
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "next/navigation": { unstable_rethrow: () => {} },
    "@/services/dashboardAttentionService": { getDashboardAttention: async () => ({
      kind: "management", currency: "UAH", partialFailure: false,
      items: [{
        source: "finance", id: "payment_overdue:21", kind: "payment_overdue", severity: "critical",
        timing: "overdue", title: "Прострочений платіж", description: "Етап · Об’єкт",
        entityType: "payment_schedule", entityId: 21, objectId: 11, relevantDate: "2026-10-27",
        href: "/objects/11?tab=finance#payment-schedule", amount: 1250.5,
      }],
    }) },
  });
  const component = load("components/dashboard/DashboardAttention.tsx");
  const html = renderToStaticMarkup(await component.DashboardAttention());
  assert.match(html, /Потребує уваги/);
  assert.match(html, /Прострочений платіж/);
  assert.match(html, /href="\/objects\/11\?tab=finance#payment-schedule"/);
  assert.match(html, /min-h-16|min-h-11/);
  assert.doesNotMatch(read("components/dashboard/DashboardAttention.tsx"), /["']use client["']/);

  const emptyLoad = loader({
    react: { ...React, cache: (fn) => fn },
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "next/navigation": { unstable_rethrow: () => {} },
    "@/services/dashboardAttentionService": { getDashboardAttention: async () => ({
      kind: "worker", partialFailure: false, items: [],
    }) },
  });
  const empty = await emptyLoad("components/dashboard/DashboardAttention.tsx").DashboardAttention();
  assert.match(renderToStaticMarkup(empty), /Зараз немає термінових дій/);

  const page = read("app/page.tsx");
  assert.match(page, /<DashboardAttention/);
  assert.match(page, /<DashboardTodayTasks/);
  assert.doesNotMatch(page, /<DashboardOverdueTasks/);
});

test("operational PRE enforces canonical bounded rules and derives worker scope from auth profile", () => {
  const sql = read("database/dashboard-4.0d2-operational-attention-pre-deploy.sql");
  assert.match(sql, /get_dashboard_operational_attention\(p_business_date date\)/);
  assert.match(sql, /select p\.role::text, p\.employee_id::bigint/);
  assert.doesNotMatch(sql, /p_employee_id|p_role/);
  assert.match(sql, /v_employee_id is not null and t\.assigned_employee_id=v_employee_id/);
  assert.match(sql, /v_employee_id is not null and o\.responsible_employee_id=v_employee_id/);
  assert.match(sql, /t\.task_source='manual'/);
  assert.match(sql, /t\.status<>'Виконано'/);
  assert.match(sql, /w\.quantity<=0 or \(w\.quantity>0 and w\.min_quantity is not null and w\.quantity<=w\.min_quantity\)/);
  assert.match(sql, /e\.current_usage>=e\.next_maintenance_usage/);
  assert.match(sql, /e\.next_service_date<=p_business_date\+7/);
  assert.match(sql, /select e\.id,e\.name,e\.next_service_date,/);
  assert.doesNotMatch(sql, /select e\.\*/i);
  assert.match(sql, /limit 8/);
  assert.doesNotMatch(sql, /object_payments|object_payment_schedule|purchase_price|service_cost|hourly_rate/);
});

test("finance PRE preserves B1 allocation, paid-row exclusion and exact object finance destination", () => {
  const sql = read("database/dashboard-4.0d2-finance-attention-pre-deploy.sql");
  assert.match(sql, /private\.has_role\(array\['admin','object_manager'\]::text\[\]\)/);
  assert.doesNotMatch(sql, /'worker'/);
  assert.match(sql, /greatest\(c\.value,0::double precision\)/);
  assert.match(sql, /order by c\.due_date,c\.created_at,c\.row_id/);
  assert.match(sql, /rows between unbounded preceding and 1 preceding/);
  assert.match(sql, /r\.due_date<=p_business_date and r\.remaining>0/);
  assert.match(sql, /case when r\.due_date<p_business_date then 'payment_overdue' else 'payment_today' end/);
  assert.match(sql, /\?tab=finance#payment-schedule/);
  assert.match(sql, /limit 8/);
  assert.doesNotMatch(sql, /client_price|warehouse_purchases|planned_purchase/);
});

test("finance allocation examples match the canonical TypeScript schedule contract", () => {
  const load = loader();
  const { calculateObjectPaymentSchedule } = load("lib/objectPaymentSchedule.ts");
  const schedule = [
    { id: 3, object_id: 11, title: "C", amount: 30, due_date: "2026-10-28", created_at: "2026-10-03T00:00:00Z" },
    { id: 2, object_id: 11, title: "B", amount: 40, due_date: "2026-10-28", created_at: "2026-10-01T00:00:00Z" },
    { id: 1, object_id: 11, title: "A", amount: 30, due_date: today, created_at: "2026-10-02T00:00:00Z" },
  ];
  const result = calculateObjectPaymentSchedule(schedule, 45, 100, today);
  assert.deepEqual(result.items.map(({ id, paidAmount, remainingAmount, status }) =>
    ({ id, paidAmount, remainingAmount, status })), [
    { id: 2, paidAmount: 40, remainingAmount: 0, status: "paid" },
    { id: 3, paidAmount: 5, remainingAmount: 25, status: "overdue" },
    { id: 1, paidAmount: 0, remainingAmount: 30, status: "due_today" },
  ]);
});

test("PRE hashes, ACL contracts and read-only consolidated audit are pinned", () => {
  const operational = read("database/dashboard-4.0d2-operational-attention-pre-deploy.sql");
  const finance = read("database/dashboard-4.0d2-finance-attention-pre-deploy.sql");
  const audit = read("database/dashboard-4.0d2-attention-production-audit.sql");
  const body = (sql) => sql.split("as $function$")[1].split("$function$")[0];
  assert.equal(createHash("md5").update(body(operational)).digest("hex"), "84b68bbb2972bba102c5ca846a80ec22");
  assert.equal(createHash("md5").update(body(finance)).digest("hex"), "f66d1a1533c26c065096c44218ce5063");
  for (const sql of [operational, finance]) {
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
  assert.match(audit, /\('required_columns'/);
  const requiredColumns = (sql) => {
    const block = sql.split("('required_columns', $check$")[1].split("$check$)")[0];
    return [...block.matchAll(/\('([^']+)','([^']+)',array\[([^\]]+)\],(true|false)\)/g)]
      .map((match) => [`${match[1]}.${match[2]}`, `${match[3]}:${match[4]}`]);
  };
  const expectedColumns = new Map([
    ...requiredColumns(operational), ...requiredColumns(finance),
  ]);
  assert.deepEqual(new Map(requiredColumns(audit)), expectedColumns,
    "PRE and production audit must pin the same column/type/nullability contract");
  assert.equal([...audit.matchAll(/^    \('([^']+)', \$check\$$/gm)].length, 16);
  assert.match(audit, /runtime_authorization_tested',false/);
  assert.match(audit, /84b68bbb2972bba102c5ca846a80ec22/);
  assert.match(audit, /f66d1a1533c26c065096c44218ce5063/);
  for (const hash of [
    "d12d67564a3b54c9e5208e8f6e56f23b",
    "b7b83ede0fc3114d40055c4e9e6447af",
    "12ac36c5e65ffcf130187d0ab09f2da1",
  ]) assert.match(audit, new RegExp(hash));
});

