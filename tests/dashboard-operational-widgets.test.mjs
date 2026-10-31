// Focused Dashboard 4.0D3B tests. No SQL/network/browser execution.
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
    const mod = { exports: {} }; cache.set(filename, mod);
    const code = ts.transpileModule(read(filename), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
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

function rpcResult(result) {
  return { overrideTypes() { return Promise.resolve(result); } };
}

test("warehouse preview service exposes only the reviewed operational allowlist", async () => {
  const calls = [];
  const service = loader({
    "@/lib/supabase/server": { createClient: async () => ({ rpc(name, args) {
      calls.push([name, args]);
      return rpcResult({ data: [
        { item_id: 1, name: "Пісок", quantity: 0, min_quantity: 5, stock_state: "out" },
        { item_id: 2, name: "Добриво", quantity: 3, min_quantity: 4, stock_state: "low" },
      ], error: null });
    } }) },
  })("services/dashboardOperationalPreviewService.ts");
  assert.deepEqual(await service.getDashboardWarehouseAttentionItems(), [
    { id: 1, name: "Пісок", quantity: 0, minQuantity: 5, stockStatus: "OUT_OF_STOCK" },
    { id: 2, name: "Добриво", quantity: 3, minQuantity: 4, stockStatus: "LOW_STOCK" },
  ]);
  assert.deepEqual(calls, [["get_dashboard_warehouse_attention_items", undefined]]);
});

test("equipment preview includes usage-only due and passes the Kyiv business date", async () => {
  const calls = [];
  const service = loader({
    "@/lib/supabase/server": { createClient: async () => ({ rpc(name, args) {
      calls.push([name, args]);
      return rpcResult({ data: [
        { equipment_id: 1, name: "Тример", next_service_date: null, attention_state: "due_now", usage_due: true },
        { equipment_id: 2, name: "Косарка", next_service_date: "2026-11-04", attention_state: "upcoming", usage_due: false },
        { equipment_id: 3, name: "Пила", next_service_date: null, attention_state: "repair_required", usage_due: false },
      ], error: null });
    } }) },
  })("services/dashboardOperationalPreviewService.ts");
  const items = await service.getDashboardEquipmentAttentionItems("2026-10-31");
  assert.equal(items[0].state, "due_now");
  assert.equal(items[0].date, null);
  assert.equal(items[0].usageDue, true);
  assert.equal(items[2].state, "repair_required");
  assert.deepEqual(calls, [["get_dashboard_equipment_attention_items", { p_business_date: "2026-10-31" }]]);
});

test("operational preview services fail closed on broad, malformed or oversized rows", async () => {
  for (const [name, data] of [
    ["get_dashboard_warehouse_attention_items", [{ item_id: 1, name: "X", quantity: 0, min_quantity: 1, stock_state: "out", unit_price: 99 }]],
    ["get_dashboard_warehouse_attention_items", [{ item_id: 1, name: "X", quantity: 2, min_quantity: 1, stock_state: "low" }]],
    ["get_dashboard_equipment_attention_items", Array.from({ length: 6 }, (_, index) => ({ equipment_id: index + 1, name: "X", next_service_date: null, attention_state: "due_now", usage_due: true }))],
    ["get_dashboard_equipment_attention_items", [{ equipment_id: 1, name: "X", next_service_date: null, attention_state: "unknown", usage_due: false }]],
  ]) {
    const service = loader({
      "@/lib/supabase/server": { createClient: async () => ({ rpc() { return rpcResult({ data, error: null }); } }) },
    })("services/dashboardOperationalPreviewService.ts");
    const call = name.includes("warehouse")
      ? service.getDashboardWarehouseAttentionItems()
      : service.getDashboardEquipmentAttentionItems("2026-10-31");
    await assert.rejects(call, /Не вдалося завантажити/);
  }
});

test("Recent Activity selects no metadata and resolves only deterministic safe destinations", async () => {
  const requests = [];
  const rows = [
    { id: 1, action: "task.created", entity_type: "task", entity_id: "12", entity_name: "Огляд", object_id: 7, actor_name: "Анна", created_at: "2026-10-31T08:00:00Z" },
    { id: 2, action: "equipment.updated", entity_type: "equipment", entity_id: "4", entity_name: "Тример", object_id: null, actor_name: "Анна", created_at: "2026-10-31T07:00:00Z" },
    { id: 3, action: "material.updated", entity_type: "material", entity_id: "8", entity_name: "Пісок", object_id: 7, actor_name: null, created_at: "2026-10-31T06:00:00Z" },
    { id: 4, action: "employee.updated", entity_type: "employee", entity_id: "3", entity_name: "Іван", object_id: null, actor_name: "Анна", created_at: "2026-10-31T05:00:00Z" },
    { id: 5, action: "object.deleted", entity_type: "object", entity_id: "9", entity_name: "Старий", object_id: 9, actor_name: "Анна", created_at: "2026-10-31T04:00:00Z" },
  ];
  const query = { select(value) { requests.push(value); return query; }, order() { return query; }, limit(value) { assert.equal(value, 5); return query; }, overrideTypes() { return Promise.resolve({ data: rows, error: null }); } };
  const service = loader({
    "@/services/profileService": { getCurrentUserProfile: async () => ({ role: "admin" }) },
    "@/lib/supabase/server": { createClient: async () => ({ from(table) { assert.equal(table, "activity_logs"); return query; } }) },
  })("services/activityLogService.ts");
  const result = await service.getRecentActivityPreview();
  assert.deepEqual(result.map((row) => row.href), ["/tasks/12", "/equipment/4", "/objects/7", "/employees/3", null]);
  assert.doesNotMatch(requests[0], /metadata|description|actor_id|object_name/);
  assert.deepEqual(Object.keys(result[0]).sort(), ["action", "actor_name", "created_at", "entity_name", "href", "id"]);
});

test("Dashboard widgets render LOW minimums, usage-only due and linked Activity without finance", async () => {
  const dashboard = {
    getDashboardContext: async () => ({ profile: { role: "admin" } }),
    getDashboardWarehouse: async () => ({ out: 1, low: 1, attention: 2, items: [
      { id: 2, name: "Добриво", quantity: 3, minQuantity: 4, stockStatus: "LOW_STOCK" },
    ] }),
    getDashboardEquipment: async () => ({ overdue: 0, dueNow: 1, upcoming: 0, usageDue: 1, attention: 1, items: [
      { id: 4, name: "Тример", date: null, state: "due_now", usageDue: true },
    ] }),
    getDashboardActivity: async () => [{ id: 1, action: "task.created", entity_name: "Огляд", actor_name: "Анна", created_at: "2026-10-31T08:00:00Z", href: "/tasks/12" }],
  };
  const load = loader({
    react: React,
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "next/navigation": { unstable_rethrow: () => {} },
    "@/components/dashboard/TodayTasksSection": () => null,
    "@/services/dashboardService": dashboard,
  });
  const components = load("components/dashboard/OperationalDashboard.tsx");
  async function render(name) {
    const element = components[name]();
    return renderToStaticMarkup(await element.type(element.props));
  }
  const warehouse = await render("DashboardWarehouseAttention");
  assert.match(warehouse, /Мінімум: 4/);
  assert.match(warehouse, /href="\/warehouse\/2"/);
  const equipment = await render("DashboardEquipmentAttention");
  assert.match(equipment, /За напрацюванням/);
  assert.match(equipment, /Поріг напрацювання/);
  const activity = await render("DashboardRecentActivity");
  assert.match(activity, /href="\/tasks\/12"/);
  assert.doesNotMatch(`${warehouse}${equipment}${activity}`, /purchase_price|service_cost|hourly_rate|metadata/);
});

test("warehouse PRE has the exact worker-safe canonical rules, ranking, ACL and body hash", () => {
  const sql = read("database/dashboard-4.0d3b-warehouse-preview-pre-deploy.sql");
  const body = sql.split("as $function$")[1].split("$function$")[0];
  assert.equal(createHash("md5").update(body).digest("hex"), "40cad7bc056198450ee0407df79b9689");
  assert.match(sql, /get_dashboard_warehouse_attention_items\(\)/);
  assert.match(body, /w\.quantity<=0 or \(w\.quantity>0 and w\.min_quantity is not null and w\.quantity<=w\.min_quantity\)/);
  assert.match(body, /order by \(case when w\.quantity<=0 then 0 else 1 end\),w\.quantity,w\.id/);
  assert.match(body, /limit 5/);
  assert.doesNotMatch(body, /select\s+(p|w)\.\*|purchase_price|unit_price|service_cost|hourly_rate|object_payments/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/);
  assert.match(sql, /revoke all[\s\S]*from public,anon,authenticated,service_role/);
  assert.match(sql, /grant execute[\s\S]*to authenticated/);
});

test("equipment PRE exactly preserves canonical combined maintenance rules and deterministic ranking", () => {
  const sql = read("database/dashboard-4.0d3b-equipment-preview-pre-deploy.sql");
  const body = sql.split("as $function$")[1].split("$function$")[0];
  assert.equal(createHash("md5").update(body).digest("hex"), "8e48f5499d8107c8ac985afac132506a");
  assert.match(body, /e\.next_service_date<=p_business_date\+7/);
  assert.match(body, /e\.current_usage>=e\.next_maintenance_usage/);
  assert.match(body, /not s\.date_overdue and \(s\.usage_due or s\.date_today\)/);
  assert.match(body, /not s\.date_overdue and not s\.usage_due and s\.date_upcoming/);
  assert.match(body, /s\.equipment_status='Потребує ремонту'[\s\S]*s\.equipment_status='На ремонті'/);
  assert.match(body, /order by case c\.attention_state when 'overdue' then 0 when 'due_now' then 1[\s\S]*when 'repair_required' then 2 when 'in_repair' then 3 else 4 end,[\s\S]*c\.next_service_date nulls last,c\.equipment_id/);
  assert.match(body, /limit 5/);
  assert.doesNotMatch(body, /select\s+(p|e|s|c)\.\*|purchase_price|unit_price|service_cost|hourly_rate|object_payments/i);
});

test("D3B audit is read-only, has 14 consolidated checks and pins D2/D3A/Reports", () => {
  const audit = read("database/dashboard-4.0d3b-operational-widgets-production-audit.sql");
  assert.match(audit, /set transaction read only/);
  assert.match(audit, /count\(\*\)=14/);
  assert.match(audit, /'expected_checks',14/);
  assert.match(audit, /40cad7bc056198450ee0407df79b9689/);
  assert.match(audit, /8e48f5499d8107c8ac985afac132506a/);
  for (const hash of ["84b68bbb2972bba102c5ca846a80ec22", "f66d1a1533c26c065096c44218ce5063",
    "375c13b6a13c81bf03369c4dd3d3779b", "45b54fb2471f832aa8d52b818dceb9ea",
    "d12d67564a3b54c9e5208e8f6e56f23b", "b7b83ede0fc3114d40055c4e9e6447af",
    "12ac36c5e65ffcf130187d0ab09f2da1"]) assert.match(audit, new RegExp(hash));
  assert.match(audit, /runtime_authorization_tested',false/);
});
