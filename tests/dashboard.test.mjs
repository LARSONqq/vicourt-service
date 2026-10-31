// node --test tests/*.test.mjs — bounded dashboard reads; no SQL/network/browser.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);

function loader(mocks) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
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
    new Function("require", "module", "exports", code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}

const today = "2026-09-19";
const equipment = (id, date, usage = 0, threshold = 100) => ({
  id, name: `Техніка ${id}`, next_service_date: date, maintenance_interval_days: 30,
  usage_type: "hours", current_usage: usage, maintenance_interval_usage: 100, next_maintenance_usage: threshold,
});
const task = (id, status, date, employee = 7) => ({
  id, title: `Завдання ${id}`, status, due_date: date, assigned_employee_id: employee,
  task_source: "manual", task_template_id: null, assignee: "Працівник", object_id: null, equipment_id: null,
  object: null, equipment: null, priority: "Середній",
});
const fixtures = {
  warehouse_items: Array.from({ length: 12 }, (_, index) => ({
    id: index + 1, name: `Матеріал ${index}`,
    quantity: index < 5 ? 0 : index < 9 ? 2 : 10,
    unit: "шт", min_quantity: 3,
  })),
  equipment: [equipment(1, "2026-09-18", 101), equipment(2, today), equipment(3, "2026-09-24"), equipment(4, null, 101)],
  objects: [
    { id: 1, name: "Один", status: "В роботі", responsible_employee_id: 7 },
    { id: 2, name: "Два", status: "На постійному обслуговуванні", responsible_employee_id: 8 },
    { id: 3, name: "Три", status: "Під періодичним наглядом", responsible_employee_id: 7 },
    { id: 4, name: "Готово", status: "Завершено", responsible_employee_id: 7 },
  ],
  object_tasks: [task(1, "Заплановано", today), task(2, "В роботі", "2026-09-18"), task(3, "Виконано", today),
    task(4, "Заплановано", "2026-09-18", 8), task(5, "Заплановано", today, 8),
    ...Array.from({ length: 8 }, (_, i) => task(10 + i, "Заплановано", today))],
  activity_logs: Array.from({ length: 8 }, (_, index) => ({ id: index, action: "task.created", entity_type: "task", entity_id: String(index + 1), entity_name: "Завдання", object_id: null, actor_name: "Адміністратор", created_at: "2026-09-19T10:00:00Z", metadata: { cost: 999 }, actor_id: "not-for-preview" })),
};

function fixture(role = "worker", options = {}) {
  const requests = [];
  const rpcRequests = [];
  const financeCalls = [];
  const events = [];
  let authCalls = 0;
  const profile = role && !options.inactive
    ? { id: "auth-uuid", role, employee_id: options.unlinked ? null : 7, full_name: "Ім’я", is_active: true }
    : null;
  const client = { rpc(name, args) {
    rpcRequests.push({ name, args });
    const response = {
      overrideTypes() { return response; },
      then(done, reject) {
        let data;
        if (name === "get_warehouse_stock_summary") {
          const rows = options.empty ? [] : fixtures.warehouse_items;
          const out = rows.filter((row) => row.quantity <= 0).length;
          const low = rows.filter((row) => row.quantity > 0 && row.min_quantity != null && row.quantity <= row.min_quantity).length;
          data = [{ out_of_stock_count: out, low_stock_count: low, attention_count: out + low }];
        } else if (name === "get_dashboard_warehouse_attention_items") {
          const rows = options.empty ? [] : fixtures.warehouse_items
            .filter((row) => row.quantity <= 0 || (row.quantity > 0 && row.min_quantity != null && row.quantity <= row.min_quantity))
            .sort((a, b) => Number(a.quantity > 0) - Number(b.quantity > 0) || a.quantity - b.quantity || a.id - b.id)
            .slice(0, 5);
          data = rows.map((row) => ({ item_id: row.id, name: row.name, quantity: row.quantity,
            min_quantity: row.min_quantity, stock_state: row.quantity <= 0 ? "out" : "low" }));
        } else if (name === "get_equipment_maintenance_summary") {
          const rows = options.empty ? [] : fixtures.equipment;
          const states = rows.map((row) => {
            const dateOverdue = row.maintenance_interval_days > 0 && row.next_service_date != null && row.next_service_date < args.p_business_date;
            const dateToday = row.maintenance_interval_days > 0 && row.next_service_date === args.p_business_date;
            const dateUpcoming = row.maintenance_interval_days > 0 && row.next_service_date > args.p_business_date && row.next_service_date <= "2026-09-26";
            const usageDue = ["hours", "km"].includes(row.usage_type) && row.maintenance_interval_usage > 0 && row.next_maintenance_usage >= 0 && row.current_usage >= 0 && row.current_usage >= row.next_maintenance_usage;
            return { dateOverdue, dueNow: !dateOverdue && (usageDue || dateToday), upcoming: !dateOverdue && !usageDue && dateUpcoming, usageDue };
          });
          data = [{
            overdue_count: states.filter((state) => state.dateOverdue).length,
            due_now_count: states.filter((state) => state.dueNow).length,
            upcoming_7_count: states.filter((state) => state.upcoming).length,
            usage_due_count: states.filter((state) => state.usageDue).length,
            attention_count: states.filter((state) => state.dateOverdue || state.dueNow || state.upcoming).length,
          }];
        } else if (name === "get_dashboard_equipment_attention_items") {
          const rows = options.empty ? [] : fixtures.equipment.map((row) => {
            const dateOverdue = row.maintenance_interval_days > 0 && row.next_service_date != null && row.next_service_date < args.p_business_date;
            const dateToday = row.maintenance_interval_days > 0 && row.next_service_date === args.p_business_date;
            const dateUpcoming = row.maintenance_interval_days > 0 && row.next_service_date > args.p_business_date && row.next_service_date <= "2026-09-26";
            const usageDue = ["hours", "km"].includes(row.usage_type) && row.maintenance_interval_usage > 0 && row.next_maintenance_usage >= 0 && row.current_usage >= 0 && row.current_usage >= row.next_maintenance_usage;
            const state = dateOverdue ? "overdue" : usageDue || dateToday ? "due_now" : dateUpcoming ? "upcoming" : null;
            return { row, state, usageDue };
          }).filter(({ state }) => state)
            .sort((a, b) => ["overdue", "due_now", "upcoming"].indexOf(a.state) - ["overdue", "due_now", "upcoming"].indexOf(b.state)
              || (a.row.next_service_date == null ? 1 : b.row.next_service_date == null ? -1 : a.row.next_service_date.localeCompare(b.row.next_service_date)) || a.row.id - b.row.id)
            .slice(0, 5);
          data = rows.map(({ row, state, usageDue }) => ({ equipment_id: row.id, name: row.name,
            next_service_date: row.next_service_date, attention_state: state, usage_due: usageDue }));
        } else data = [];
        return Promise.resolve({ data, error: options.fail === name ? { message: "private failure details" } : null }).then(done, reject);
      },
    };
    return response;
  }, from(table) {
    const request = { table, filters: [], limit: null, orders: [], select: "", options: {} }; requests.push(request);
    const compare = (column, value, fn) => { request.filters.push((row) => row[column] != null && fn(row[column], value)); return query; };
    const query = {
      select(columns, opts) { request.select = columns; request.options = opts ?? {}; return query; },
      eq(column, value) { request.filters.push((row) => row[column] === value); return query; },
      neq(column, value) { return compare(column, value, (a, b) => a !== b); },
      lt(column, value) { return compare(column, value, (a, b) => a < b); },
      gt(column, value) { return compare(column, value, (a, b) => a > b); },
      lte(column, value) { return compare(column, value, (a, b) => a <= b); },
      is(column, value) { return query.eq(column, value); },
      not(column, operator, value) { assert.equal(operator, "is"); return query.neq(column, value); },
      in(column, values) { request.filters.push((row) => values.includes(row[column])); return query; },
      order(column, order = {}) { request.orders.push([column, order.ascending !== false]); return query; },
      limit(n) { request.limit = n; return query; },
      range(from, to) { request.range = [from, to]; return query; },
      overrideTypes() { return query; },
      then(done, reject) {
        let rows = (options.empty ? [] : fixtures[table] ?? []).filter((row) => request.filters.every((filter) => filter(row)));
        const count = rows.length;
        rows.sort((a, b) => { for (const [column, ascending] of request.orders) { const cmp = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0; if (cmp) return ascending ? cmp : -cmp; } return 0; });
        if (request.limit !== null) rows = rows.slice(0, request.limit);
        if (request.range) rows = rows.slice(request.range[0], request.range[1] + 1);
        // Simulate explicit projections, including to-one relation aliases.
        const columns = request.select.replace(/\([^)]*\)/g, "").split(",").map((c) => c.trim().split(":")[0]);
        rows = rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
        return Promise.resolve({ data: request.options.head ? null : rows, count: request.options.count ? count : null,
          error: options.fail === table ? { message: "private failure details" } : null }).then(done, reject);
      },
    }; return query;
  } };
  const load = loader({
    react: { ...React, cache: (fn) => { let result; return (...args) => result ??= fn(...args); } },
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "next/navigation": { unstable_rethrow: (error) => { if (error.message === "AUTH_REDIRECT") throw error; } },
    "@/components/dashboard/TodayTasksSection": () => React.createElement("p", {}, "Today preview"),
    "@/lib/supabase/server": { createClient: async () => client },
    "@/services/profileService": { getCurrentUserProfile: async () => profile },
    "@/lib/auth/requireAccess": { requireSectionAccess: async () => { authCalls++; events.push("role"); if (!profile) throw new Error("AUTH_REDIRECT"); return profile; } },
    "@/lib/kyivDate": { ...loader({})("lib/kyivDate.ts"), getKyivDateValue: () => today },
    "@/services/reportCurrentFinanceService": { getReportOverviewCurrentFinance: async (...args) => {
      events.push("finance"); financeCalls.push(args);
      return options.finance ?? { outstanding_receivables: 12500.5, objects_without_client_price: 1, overdue_schedule_amount: 2300 };
    } },
    "@/services/settingsService": { getAppSettings: async () => ({ currency: "UAH" }) },
  });
  return { requests, rpcRequests, financeCalls, events, load, service: load("services/dashboardService.ts"), authCalls: () => authCalls };
}

test("worker dashboard: operational tables only, no Activity/mutation/management queries, bounded rows and exact counts", async () => {
  const { service, requests, rpcRequests, authCalls } = fixture();
  const [summary, preview, warehouse, equipment, objects, activity] = await Promise.all([
    service.getDashboardTasksSummary(), service.getDashboardTasksPreview("today"), service.getDashboardWarehouse(),
    service.getDashboardEquipment(), service.getDashboardObjects(), service.getDashboardActivity(),
  ]);
  assert.equal(summary.today, 9); assert.equal(preview.tasks.length, 5);
  assert.deepEqual([warehouse.out, warehouse.low, warehouse.attention], [5, 4, 9]); assert.equal(warehouse.items.length, 5);
  assert.deepEqual([equipment.overdue, equipment.dueNow, equipment.upcoming, equipment.usageDue, equipment.attention], [1, 2, 1, 2, 4]);
  assert.equal(objects.total, 2); assert.equal(objects.scope, "assigned"); assert.equal(activity, null); assert.equal(authCalls(), 1);
  assert.ok(requests.every((r) => ["object_tasks", "objects"].includes(r.table)));
  assert.deepEqual(rpcRequests.map((request) => request.name).sort(), ["get_dashboard_equipment_attention_items", "get_dashboard_warehouse_attention_items", "get_equipment_maintenance_summary", "get_warehouse_stock_summary"]);
  assert.deepEqual(rpcRequests.find((request) => request.name === "get_equipment_maintenance_summary").args, { p_business_date: today });
  assert.deepEqual(rpcRequests.find((request) => request.name === "get_dashboard_equipment_attention_items").args, { p_business_date: today });
  for (const request of requests) {
    assert.doesNotMatch(request.select, /\*|cost|price|metadata|hourly_rate|checklist_items/);
    if (!request.options.head) assert.equal(request.limit, 5);
    else assert.equal(request.options.count, "exact");
  }
  assert.equal(requests.filter((r) => r.table === "object_tasks" && r.options.head).length, 3);
});

test("role-aware command data keeps management finance and worker personal data structurally separate", async () => {
  for (const role of ["admin", "object_manager"]) {
    const current = fixture(role);
    const data = await current.service.getDashboardCommandData();
    assert.deepEqual(data, {
      kind: "management", role, today, userName: "Ім’я", currency: "UAH",
      kpis: { outstandingReceivables: 12500.5, overdueScheduleAmount: 2300, overdueTasks: 2, activeObjects: 3 },
    });
    assert.deepEqual(current.financeCalls, [[null, today]]);
    assert.ok(current.events.indexOf("role") < current.events.indexOf("finance"));
  }

  const worker = fixture("worker");
  const data = await worker.service.getDashboardCommandData();
  assert.deepEqual(data, {
    kind: "worker", role: "worker", today, userName: "Ім’я", employeeLinked: true,
    taskLinks: {
      today: "/tasks?view=today&assignee=7",
      overdue: "/tasks?view=overdue&assignee=7",
      open: "/tasks?view=my&status=open&assignee=7",
    },
    kpis: { myTodayTasks: 9, myOverdueTasks: 1, myOpenTasks: 10, assignedActiveObjects: 2 },
  });
  assert.equal(worker.financeCalls.length, 0);
  assert.doesNotMatch(JSON.stringify(data), /finance|receivable|schedule|payment|cost|price/i);
  assert.ok(worker.requests.every((request) => !["object_payments", "object_payment_schedule", "warehouse_purchases", "equipment_service_records"].includes(request.table)));
  assert.ok(worker.rpcRequests.every((request) => !/report_overview_(current_finance|period_totals|material_totals)/.test(request.name)));
});

test("worker personal metrics are assignment-scoped and unlinked worker never falls back to team data", async () => {
  const linked = fixture("worker");
  const summary = await linked.service.getDashboardTasksSummary();
  const objects = await linked.service.getDashboardObjects();
  assert.deepEqual({ today: summary.today, overdue: summary.overdue, open: summary.myOpen }, { today: 9, overdue: 1, open: 10 });
  assert.equal(objects.total, 2);
  assert.ok(objects.items.every((object) => [1, 3].includes(object.id)));

  const unlinked = fixture("worker", { unlinked: true });
  const command = await unlinked.service.getDashboardCommandData();
  assert.equal(command.kind, "worker");
  assert.equal(command.employeeLinked, false);
  assert.deepEqual(command.kpis, { myTodayTasks: 0, myOverdueTasks: 0, myOpenTasks: 0, assignedActiveObjects: 0 });
  assert.equal(unlinked.requests.length, 0);
  assert.equal(unlinked.financeCalls.length, 0);
});

test("admin and object_manager have the same bounded Activity service; worker cannot call it directly", async () => {
  for (const role of ["admin", "object_manager"]) {
    const { service, requests } = fixture(role);
    const logs = await service.getDashboardActivity();
    assert.equal(logs.length, 5); assert.equal(requests.length, 1);
    assert.equal(requests[0].table, "activity_logs");
    assert.deepEqual(Object.keys(logs[0]).sort(), ["action", "actor_name", "created_at", "entity_name", "href", "id"]);
    assert.equal(logs[0].href, "/tasks/8");
    assert.doesNotMatch(requests[0].select, /metadata|description|actor_id/);
  }
  const worker = fixture();
  await assert.rejects(() => worker.load("services/activityLogService.ts").getRecentActivityPreview());
  assert.equal(worker.requests.length, 0);
});

test("dashboard task links normalize to supported views with exact open semantics", async () => {
  const { load, service } = fixture("admin");
  const { taskDashboardLinks, normalizeTaskWorkspace } = load("lib/taskWorkspace.ts");
  const summary = await service.getDashboardTasksSummary();
  const workspace = load("services/taskWorkspaceService.ts");
  for (const [key, href] of Object.entries(taskDashboardLinks)) {
    const { filters } = normalizeTaskWorkspace(Object.fromEntries(new URL(href, "https://local.invalid").searchParams));
    const page = await workspace.getTaskWorkspacePage(filters, 1, 7, summary.businessDate);
    assert.equal(page.total, summary[key]);
    assert.ok(page.tasks.every((task) => task.status !== "Виконано"));
  }
  assert.equal(normalizeTaskWorkspace({ status: "invalid" }).filters.status, "");
});

test("date reuse, absent employee mapping and server-side today/overdue preview scopes", async () => {
  const { service, requests } = fixture("worker", { unlinked: true });
  const summary = await service.getDashboardTasksSummary();
  assert.equal(summary.myOpen, 0); assert.equal(summary.hasEmployeeLink, false);
  assert.equal(requests.length, 0);
  const preview = await service.getDashboardTasksPreview("overdue");
  assert.equal(preview.today, summary.businessDate);
  assert.deepEqual(preview.tasks, []);
  assert.equal(requests.length, 0);
});

test("quick actions are role-correct, touch-sized and use canonical Tasks route", async () => {
  const expected = {
    admin: ["/objects/new", "/tasks", "/purchases#new-purchase", "/equipment"],
    object_manager: ["/objects/new", "/tasks", "/purchases#new-purchase"],
    worker: ["/tasks"],
  };
  for (const role of Object.keys(expected)) {
    const current = fixture(role);
    const { permissions } = await current.service.getDashboardContext();
    const QuickActions = current.load("components/dashboard/DashboardQuickActions.tsx").default;
    const html = renderToStaticMarkup(React.createElement(QuickActions, { permissions }));
    assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), expected[role]);
    assert.doesNotMatch(html, /href="\/task"/);
    assert.match(html, /min-h-11/);
  }
});

test("worker render contains no management finance cards; internal Dashboard rejects non-internal/inactive access", async () => {
  const worker = fixture("worker");
  const command = worker.load("components/dashboard/DashboardCommandSurface.tsx").DashboardCommandSurface;
  const html = renderToStaticMarkup(await command());
  assert.match(html, /Мої сьогодні/);
  assert.doesNotMatch(html, /Дебіторська|Прострочено за графіком/);
  const denied = fixture(null);
  await assert.rejects(() => denied.service.getDashboardCommandData(), /AUTH_REDIRECT/);
  assert.equal(denied.requests.length, 0);
  assert.equal(denied.financeCalls.length, 0);
  const inactive = fixture("worker", { inactive: true });
  await assert.rejects(() => inactive.service.getDashboardCommandData(), /AUTH_REDIRECT/);
  assert.equal(inactive.requests.length, 0);
  assert.equal(inactive.financeCalls.length, 0);
  const { accountRedirect } = denied.load("lib/auth/accountRouting.ts");
  assert.equal(accountRedirect("client", "/"), "/client");
});

test("D1 imports only B1 finance and worker contract has no finance placeholders", () => {
  const service = readFileSync("services/dashboardService.ts", "utf8");
  assert.match(service, /getReportOverviewCurrentFinance/);
  assert.doesNotMatch(service, /getReportOverviewPeriodTotals|getReportOverviewMaterialTotals|reportPeriodTotalsService|reportMaterialTotalsService/);
  const types = readFileSync("types/dashboard.ts", "utf8");
  const worker = types.slice(types.indexOf("export type WorkerDashboardData"), types.indexOf("export type DashboardCommandData"));
  assert.doesNotMatch(worker, /finance|receivable|schedule|payment|cost|price/i);
});

test("warehouse and equipment summaries preserve canonical LOW/OUT and combined maintenance semantics", async () => {
  const { service, rpcRequests } = fixture();
  const warehouse = await service.getDashboardWarehouse();
  for (const row of warehouse.items) assert.equal(row.stockStatus, row.quantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK");
  assert.deepEqual({ out: warehouse.out, low: warehouse.low, attention: warehouse.attention }, { out: 5, low: 4, attention: 9 });
  const equipment = await service.getDashboardEquipment();
  assert.equal(equipment.items.find((item) => item.id === 1).usageDue, true);
  assert.equal(equipment.items.some((item) => item.id === 4), true); // Usage-only due is part of the bounded preview.
  assert.deepEqual({ overdue: equipment.overdue, dueNow: equipment.dueNow, upcoming: equipment.upcoming, usageDue: equipment.usageDue }, { overdue: 1, dueNow: 2, upcoming: 1, usageDue: 2 });
  assert.equal(rpcRequests.length, 4);
});

async function renderSection(current, name) {
  const component = current.load("components/dashboard/OperationalDashboard.tsx")[name];
  const element = await component();
  return renderToStaticMarkup(await element.type(element.props));
}

test("empty states are scope-honest and do not promise all usage/stock issues are resolved", async () => {
  const current = fixture("admin", { empty: true });
  const cases = [
    ["DashboardOverdueTasks", "Прострочених завдань немає"],
    ["DashboardWarehouseAttention", "Залишки не потребують уваги"],
    ["DashboardEquipmentAttention", "Техніка не потребує уваги"],
    ["DashboardRecentActivity", "Останніх дій поки немає"],
  ];
  for (const [name, text] of cases) assert.ok((await renderSection(current, name)).includes(text));
});

test("secondary query failure is local, never fake zero; auth redirects are not swallowed", async () => {
  const current = fixture("worker", { fail: "get_dashboard_warehouse_attention_items" });
  const originalError = console.error; console.error = () => {};
  try {
    const html = await renderSection(current, "DashboardWarehouseAttention");
    assert.match(html, /Не вдалося завантажити дані/);
    assert.doesNotMatch(html, /private failure details/);
    const equipment = await current.service.getDashboardEquipment();
    assert.equal(equipment.overdue, 1);
    const denied = fixture(null);
    await assert.rejects(() => renderSection(denied, "DashboardWarehouseAttention"), /AUTH_REDIRECT/);
    assert.equal(denied.requests.length, 0);
  } finally { console.error = originalError; }
});

test("page streams independent sections and gates Activity; canonical completion remains untouched", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.equal((page.match(/<Suspense /g) ?? []).length, 7);
  assert.match(page, /activityVisible && <Suspense/);
  assert.match(page, /DashboardCommandSurface/);
  assert.doesNotMatch(page, /DashboardTaskSummary/);
  assert.doesNotMatch(page, /getDashboardData|getAllTasks|getWarehouseItems|getEquipment\(/);
  const actions = readFileSync("app/actions/dashboardTaskActions.ts", "utf8");
  assert.match(actions, /return updateTaskStatus\(taskId, "Виконано"\)/);
  assert.match(readFileSync("components/dashboard/TodayTasksSection.tsx", "utf8"), /href={`\/tasks\/\$\{task.id\}`}/);
  assert.match(readFileSync("app/dashboard/page.tsx", "utf8"), /redirect\("\/"\)/);
});

test("Sidebar keeps Notifications navigation without eagerly loading Notification Center", () => {
  const sidebar = readFileSync("components/layout/Sidebar.tsx", "utf8");
  assert.match(sidebar, /name: "Сповіщення"/);
  assert.match(sidebar, /href: "\/notifications"/);
  assert.doesNotMatch(sidebar, /getNotificationCenter|notificationCenter|services\/notificationService/);
  const notificationsPage = readFileSync("app/notifications/page.tsx", "utf8");
  assert.match(notificationsPage, /getNotificationCenter\(\)/);
});

test("Dashboard 3.0B SQL is operational-only, exact, role-safe and aligned with canonical predicates", () => {
  const deploy = readFileSync("database/dashboard-3.0b-operational-metrics-pre-deploy.sql", "utf8");
  assert.match(deploy, /quantity <= 0/);
  assert.match(deploy, /quantity > 0[\s\S]*min_quantity is not null[\s\S]*quantity <= min_quantity/);
  assert.match(deploy, /current_usage >= next_maintenance_usage/);
  assert.match(deploy, /not date_overdue[\s\S]*usage_due or date_today/);
  assert.match(deploy, /security invoker/gi);
  assert.match(deploy, /set search_path = ''/g);
  assert.match(deploy, /grant execute[\s\S]*to authenticated, service_role/g);
  assert.doesNotMatch(deploy, /service_record|purchase_price|unit_cost|total_cost/);
  const audit = readFileSync("database/dashboard-3.0b-operational-metrics-production-audit.sql", "utf8");
  assert.match(audit, /DASHBOARD_3_0B_AUDIT_SUMMARY/);
  assert.match(audit, /set transaction read only/);
});

test("Dashboard header is concise while Kyiv remains the internal business timezone", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, />Оперативний огляд</);
  assert.match(page, /formatLongDateValue\(today\)/);
  assert.doesNotMatch(page, /Вітаємо|· Київ/);
  const dates = readFileSync("lib/kyivDate.ts", "utf8");
  assert.match(dates, /Europe\/Kyiv/);
  const { formatLongDateValue } = loader({})("lib/kyivDate.ts");
  assert.equal(formatLongDateValue(today), "19 вересня 2026");
});
