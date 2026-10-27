// Real report/service execution against mocked queries, plus a SQL-expression model.
// SQL is never executed here; deployed SQL/RLS and monetary parity still need smoke.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, "utf8");
const pre = read("database/reports-4.0b2-period-totals-pre-deploy.sql");
const audit = read("database/reports-4.0b2-period-totals-production-audit.sql");
const body = pre.split("as $function$")[1].split("$function$")[0];
function loader(mocks = {}) {
  const cache = new Map();
  const load = (file) => {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} }; cache.set(filename, mod);
    const code = ts.transpileModule(read(filename), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    new Function("require", "module", "exports", code)((name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) {
        const base = name.slice(2);
        return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
      }
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  };
  return load;
}
const load = loader();
const { getKyivDateStartUtc, addDaysToDateValue } = load("lib/kyivDate.ts");
const { objectExpenseCategories } = load("constants/objectExpenses.ts");
const filters = { dateFrom: "2026-10-01", dateTo: "2026-10-02", objectId: null, employeeId: null, expenseCategory: null, movementType: null };
const zero = { labor_cost: 0, other_expenses_cost: 0, total_hours: 0, purchased_cost: 0, payments_received: 0 };
const input = (overrides = {}) => ({ ...filters, ...overrides });
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = (rows, fn) => rows.reduce((total, row) => total + fn(row), 0);
function sqlCents(amount) {
  const scaled = amount * 100;
  return Math.floor(scaled) + (scaled - Math.floor(scaled) >= 0.5 ? 1 : 0);
}
const byId = (a, b) => a.id - b.id;
const inclusive = (value, f) => value != null && value >= f.dateFrom && value <= f.dateTo;
function sqlModel(data, f) {
  const inObject = (r) => f.objectId === null || r.object_id === f.objectId;
  const work = data.work.filter((r) => inclusive(r.work_date, f) && r.object_id > 0 && inObject(r)
    && (f.employeeId === null || r.employee_id === f.employeeId)).sort(byId);
  const expenses = data.expenses.filter((r) => inclusive(r.expense_date, f) && r.object_id > 0 && inObject(r)
    && (f.expenseCategory === null || r.category === f.expenseCategory)).sort(byId);
  const payments = data.payments.filter((r) => inclusive(r.payment_date, f) && inObject(r))
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const start = Date.parse(getKyivDateStartUtc(f.dateFrom)), end = Date.parse(getKyivDateStartUtc(addDaysToDateValue(f.dateTo, 1)));
  const purchases = data.purchases.filter((r) => r.status === "Закуплено" && r.purchased_at != null
    && Date.parse(r.purchased_at) >= start && Date.parse(r.purchased_at) < end).sort(byId);
  return {
    labor_cost: sum(work, (r) => finite(r.hours) * finite(r.hourly_rate)),
    other_expenses_cost: sum(expenses, (r) => finite(r.amount)),
    total_hours: sum(work, (r) => finite(r.hours)),
    purchased_cost: sum(purchases, (r) => sqlCents(finite(r.quantity) * finite(r.purchase_price))) / 100,
    payments_received: sum(payments, (r) => Math.max(sqlCents(finite(r.amount)), 0)) / 100,
  };
}
const work = (id, object_id, employee_id, hours, hourly_rate, work_date = "2026-10-01") =>
  ({ id, object_id, employee_id, hours, hourly_rate, work_date, workers: "Тест" });
const expense = (id, object_id, amount, category = "Послуги", expense_date = "2026-10-01") =>
  ({ id, object_id, amount, category, expense_date, description: "INTERNAL_NOTE", note: "INTERNAL_NOTE" });
const payment = (id, object_id, amount, payment_date = "2026-10-01", created_at = "2026-10-01T10:00:00Z") =>
  ({ id, object_id, amount, payment_date, created_at, note: "INTERNAL_PAYMENT", payment_method: "Готівка" });
const purchase = (id, quantity, purchase_price, purchased_at = "2026-10-01T09:00:00Z", status = "Закуплено") =>
  ({ id, item_id: 1, quantity, purchase_price, status, purchased_at, created_at: "2026-09-01T09:00:00Z" });
function dataFixture(overrides = {}) {
  return {
    work: [work(3, 2, 12, 3.25, 80), work(1, 1, 11, .125, 10.005), work(2, 1, 12, 1.2, 20.15),
      work(4, 2, 11, 8, 100, "2026-10-02"), work(5, 1, 11, 999, 999, "2026-09-30")],
    expenses: [expense(3, 2, 3.145), expense(1, 1, 1.005), expense(2, 1, 2.675, "Паливо", "2026-10-02"),
      expense(4, 1, 999, "Паливо", "2026-10-03")],
    payments: [payment(1, 1, 1.005), payment(2, 1, -10), payment(3, 2, 2.675, "2026-10-02"),
      payment(4, 1, 999, "2026-09-30"), payment(5, 1, 999, "2026-10-03")],
    purchases: [purchase(3, 2, 2.675), purchase(1, 1, 1.005), purchase(2, -1, .125),
      purchase(4, 999, 999, "2026-10-01T09:00:00Z", "Заплановано"), purchase(5, 999, 999, null)],
    ...overrides,
  };
}
function reportFixture(data = dataFixture(), { aggregateError = null, materialMode = "legacy" } = {}) {
  const queries = [], aggregateCalls = [], currentCalls = [], materialCalls = [], equipmentCalls = [];
  const rows = {
    get_management_objects: [1, 2].map((id) => ({ id, name: `Об’єкт ${id}`, client_price: 10000, cost_budget: 10000 })),
    employees: [11, 12].map((id) => ({ id, first_name: `Працівник ${id}`, last_name: "Тест", hourly_rate: 99999 })),
    get_management_work_logs: data.work,
    object_expenses: data.expenses, object_payments: data.payments, warehouse_purchases: data.purchases,
    get_management_materials: [{ id: 1, object_id: 1, name: "Матеріал", quantity: 2, price: 3, created_at: "2026-10-01T09:00:00Z" }],
  };
  const query = (name) => {
    const log = { name, operations: [] }; queries.push(log);
    const evaluate = () => {
      let result = [...(rows[name] || [])];
      for (const [op, column, value] of log.operations) {
        if (op === "eq") result = result.filter((r) => r[column] === value);
        if (op === "in") result = result.filter((r) => value.includes(r[column]));
        if (["gte", "lte", "lt"].includes(op)) result = result.filter((r) => {
          if (r[column] == null) return false;
          const timestamp = column.endsWith("_at");
          const a = timestamp ? Date.parse(r[column]) : r[column], b = timestamp ? Date.parse(value) : value;
          return op === "gte" ? a >= b : op === "lte" ? a <= b : a < b;
        });
        if (op === "order") result.sort((a, b) => value.ascending ? a[column] - b[column] : b[column] - a[column]);
        if (op === "range") result = result.slice(column, value + 1);
      }
      return { data: result, error: null };
    };
    const chain = new Proxy({}, { get: (_, method) => method === "then"
      ? (done) => Promise.resolve(evaluate()).then(done)
      : (...args) => { log.operations.push([method, ...args]); return chain; } });
    return chain;
  };
  const cutover = materialMode === "legacy" ? null : { ledgerVersion: 3, boundaryMovementId: 10, cutoverAt: "2026-10-01T00:00:00Z" };
  const load = loader({
    "@/lib/supabase/server": { createClient: async () => ({ from: query, rpc: query }) },
    "@/services/reportPeriodTotalsService": { getReportOverviewPeriodTotals: async (f) => {
      aggregateCalls.push(f); if (aggregateError) throw aggregateError; return sqlModel(data, f);
    } },
    "@/services/reportCurrentFinanceService": { getReportOverviewCurrentFinance: async (...args) => {
      currentCalls.push(args); return { outstanding_receivables: 150, objects_without_client_price: 0, overdue_schedule_amount: 20 };
    } },
    "@/services/reportMaterialLedgerService": {
      getMaterialLedgerCutover: async () => cutover, getReportMaterialPeriodMode: () => materialMode,
      getMaterialLedgerReport: async (...args) => { materialCalls.push(args); return {
        cutover, periodMode: materialMode, costs: materialMode === "legacy" ? [] : [
          { objectId: 1, periodExactCost: 7.25, lifetimeExactCost: 7.25, periodMovementCount: 1 },
        ], movements: [],
      }; },
    },
    "@/services/equipmentService": { getManagementEquipmentServiceRecordsRange: async (...args) => { equipmentCalls.push(args); return []; } },
  });
  return { get: load("services/reportService.ts").getReportsData, queries, aggregateCalls, currentCalls, materialCalls, equipmentCalls };
}
function dtoFromKpis(k) {
  return { labor_cost: k.laborCost, other_expenses_cost: k.otherExpensesCost, total_hours: k.totalHours,
    purchased_cost: k.purchasedCost, payments_received: k.paymentsReceived };
}
for (const [label, override] of [
  ["no filters", {}], ["object", { objectId: 1 }], ["employee", { employeeId: 11 }],
  ["object + employee", { objectId: 1, employeeId: 12 }], ["category", { expenseCategory: "Паливо" }],
  ["object + category", { objectId: 1, expenseCategory: "Паливо" }],
  ["all filters", { objectId: 1, employeeId: 11, expenseCategory: "Паливо" }],
  ["movement type irrelevant", { movementType: "Списання" }],
]) test(`B2 parity with actual raw ReportsData: ${label}`, async () => {
  const data = dataFixture(), f = input(override), app = reportFixture(data);
  const old = await app.get(f), compact = await app.get(f, ["overview"]);
  assert.deepEqual(dtoFromKpis(old.kpis), sqlModel(data, f));
  assert.deepEqual(compact.kpis, { ...old.kpis, outstandingReceivables: 150, objectsWithoutClientPrice: 0, overdueScheduleAmount: 20 });
  assert.equal(compact.kpis.totalObjectCost, compact.kpis.materialsCost + compact.kpis.laborCost + compact.kpis.otherExpensesCost);
});
test("labor/expenses preserve fractions and historical snapshot rates; no new cents rounding", async () => {
  const data = dataFixture({ work: [work(1, 1, 11, .125, 10.005)], expenses: [expense(1, 1, 1.005)], payments: [], purchases: [] });
  const app = reportFixture(data), old = await app.get(input()), compact = await app.get(input(), ["overview"]);
  assert.equal(compact.kpis.laborCost, .125 * 10.005);
  assert.equal(compact.kpis.totalHours, .125);
  assert.equal(compact.kpis.otherExpensesCost, 1.005);
  assert.notEqual(compact.kpis.laborCost, Math.round(.125 * 10.005 * 100) / 100);
  assert.deepEqual(dtoFromKpis(compact.kpis), dtoFromKpis(old.kpis));
});
test("null/nonfinite operands become zero, signed rows stay signed, invalid object IDs skipped only where legacy does", async () => {
  const data = dataFixture({
    work: [work(1, 1, null, null, 100), work(2, 1, 11, 1, "NaN"), work(3, 1, 11, "Infinity", 100),
      work(4, 1, 11, -2, 3), work(5, 0, 11, 999, 999)],
    expenses: [expense(1, 1, null), expense(2, 1, "NaN"), expense(3, 1, "-Infinity"), expense(4, 1, -.125), expense(5, null, 999)],
    payments: [payment(1, 1, null), payment(2, 1, "NaN"), payment(3, 1, -10), payment(4, 1, 1.005)],
    purchases: [purchase(1, null, 999), purchase(2, 1, "NaN"), purchase(3, -1, .125)],
  });
  const actual = dtoFromKpis((await reportFixture(data).get(input())).kpis);
  assert.deepEqual(actual, sqlModel(data, input()));
  assert.deepEqual(actual, { labor_cost: -6, other_expenses_cost: -.125, total_hours: -1, purchased_cost: -.12, payments_received: 1 });
});
test("period payments use positive row cents, not lifetime net payments", async () => {
  for (const amounts of [[1.005], [-50], [1.005, -50, 2.675], [.145, .285]]) {
    const data = dataFixture({ payments: amounts.map((n, i) => payment(i + 1, 1, n)) });
    const old = await reportFixture(data).get(input());
    assert.equal(old.kpis.paymentsReceived, sqlModel(data, input()).payments_received);
    assert.equal(old.kpis.paymentsReceived, sum(amounts, (n) => Math.max(Math.round(n * 100), 0)) / 100);
  }
});
test("purchases count only Закуплено in purchased_at range and round each signed row", async () => {
  const data = dataFixture(), base = sqlModel(data, input());
  assert.equal(base.purchased_cost, 6.23);
  for (const f of [input(), input({ objectId: 1, employeeId: 11, expenseCategory: "Паливо" }), input({ objectId: 2 })]) {
    const old = await reportFixture(data).get(f);
    assert.equal(old.kpis.purchasedCost, base.purchased_cost);
    assert.equal(sqlModel(data, f).purchased_cost, base.purchased_cost);
  }
});
test("date-column bounds inclusive; filters never leak from employee/category into payments or purchases", async () => {
  const data = dataFixture(), a = sqlModel(data, input()), b = sqlModel(data, input({ employeeId: 11, expenseCategory: "Паливо" }));
  assert.equal(a.payments_received, 3.68); assert.equal(b.payments_received, a.payments_received);
  assert.equal(b.purchased_cost, a.purchased_cost);
  assert.equal(b.other_expenses_cost, 2.675);
  assert.equal(b.total_hours, 8.125);
  const onlyLastDay = input({ dateFrom: "2026-10-02" });
  assert.deepEqual(dtoFromKpis((await reportFixture(data).get(onlyLastDay)).kpis), sqlModel(data, onlyLastDay));
});
for (const [date, start, end, hours] of [
  ["2026-01-01", "2025-12-31T22:00:00.000Z", "2026-01-01T22:00:00.000Z", 24],
  ["2026-07-01", "2026-06-30T21:00:00.000Z", "2026-07-01T21:00:00.000Z", 24],
  ["2026-03-29", "2026-03-28T22:00:00.000Z", "2026-03-29T21:00:00.000Z", 23],
  ["2026-10-25", "2026-10-24T21:00:00.000Z", "2026-10-25T22:00:00.000Z", 25],
]) test(`Kyiv half-open timestamp parity: ${date} (${hours}h)`, async () => {
  assert.equal(getKyivDateStartUtc(date), start);
  assert.equal(getKyivDateStartUtc(addDaysToDateValue(date, 1)), end);
  assert.equal((Date.parse(end) - Date.parse(start)) / 3600000, hours);
  const data = dataFixture({ purchases: [
    purchase(1, 1, 999, new Date(Date.parse(start) - 1).toISOString()), purchase(2, 1, 1.005, start),
    purchase(3, 1, 2.675, new Date(Date.parse(end) - 1).toISOString()), purchase(4, 1, 999, end),
  ] });
  const f = input({ dateFrom: date, dateTo: date });
  assert.equal((await reportFixture(data).get(f)).kpis.purchasedCost, 3.68);
  assert.equal(sqlModel(data, f).purchased_cost, 3.68);
});
test("deterministic fractional parity (250 cases) and precision beyond 15 significant digits", async () => {
  let seed = 20261026;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const data = dataFixture(), app = reportFixture(data);
  for (let i = 0; i < 250; i++) {
    // Mutate the existing arrays observed by the same mocked raw service.
    data.work.splice(0, data.work.length, ...Array.from({ length: 5 }, (_, j) => work(j + 1, j % 2 + 1, j % 2 + 11, random() * 10, random() * 100)));
    data.expenses.splice(0, data.expenses.length, ...Array.from({ length: 5 }, (_, j) => expense(j + 1, j % 2 + 1, (random() - .2) * 100)));
    data.payments.splice(0, data.payments.length, ...Array.from({ length: 5 }, (_, j) => payment(j + 1, j % 2 + 1, (random() - .2) * 100)));
    data.purchases.splice(0, data.purchases.length, ...Array.from({ length: 5 }, (_, j) => purchase(j + 1, random() * 10, random() * 100)));
    const f = input({ objectId: i % 3 === 0 ? 1 : null, employeeId: i % 4 === 0 ? 11 : null });
    assert.deepEqual(dtoFromKpis((await app.get(f)).kpis), sqlModel(data, f), `case ${i}`);
  }
  data.expenses.splice(0, data.expenses.length, expense(1, 1, 12345678901234.56));
  assert.equal((await app.get(input())).kpis.otherExpensesCost, 12345678901234.56);
  assert.match(pre, /set extra_float_digits = 3/);
  assert.equal((body.match(/::text::numeric/g) || []).length, 5);
});

function serviceFixture({ identity = "internal", role = "admin", active = true, result = { data: [zero], error: null } } = {}) {
  const calls = [];
  const load = loader({
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => ({ role, is_active: active }) },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: (...args) => {
      calls.push(args); return typeof result === "function" ? result() : Promise.resolve(result);
    } }) },
  });
  return { calls, get: load("services/reportPeriodTotalsService.ts").getReportOverviewPeriodTotals };
}
test("admin/manager use one user-scoped RPC and only exact five-field DTO survives", async () => {
  for (const role of ["admin", "object_manager"]) {
    const dto = { labor_cost: -1.005, other_expenses_cost: 2.675, total_hours: .125, purchased_cost: -.12, payments_received: 5 };
    const f = serviceFixture({ role, result: { data: [{ ...dto, total_hours: ".125", note: "SECRET", materials: 999, actor: "SECRET" }], error: null } });
    const params = input({ objectId: 1, employeeId: 11, expenseCategory: "Послуги", movementType: "Прихід" });
    assert.deepEqual(await f.get(params), dto);
    assert.deepEqual(f.calls, [["get_report_overview_period_totals", {
      p_date_from: params.dateFrom, p_date_to: params.dateTo, p_object_id: 1, p_employee_id: 11, p_expense_category: "Послуги",
    }]]);
  }
});
test("worker/inactive/client/guest/denied identity performs ZERO period finance RPCs", async () => {
  for (const opts of [{ role: "worker" }, { active: false }, ...["client", "guest", "denied"].map((identity) => ({ identity }))]) {
    const f = serviceFixture(opts); await assert.rejects(() => f.get(input()), /Недостатньо прав/); assert.deepEqual(f.calls, []);
  }
});
test("invalid dates/IDs/category fail before RPC; missing domain objects and DB failures return safe error", async () => {
  const f = serviceFixture();
  for (const overrides of [
    { dateFrom: null }, { dateTo: null }, { dateFrom: "infinity" }, { dateTo: "2026-02-30" }, { dateFrom: "2026-10-03" },
    { objectId: 0 }, { objectId: -1 }, { objectId: 1.2 }, { objectId: Number.MAX_SAFE_INTEGER + 1 },
    { employeeId: 0 }, { employeeId: -1 }, { employeeId: 1.2 }, { employeeId: Number.MAX_SAFE_INTEGER + 1 },
    { expenseCategory: "unknown" }, { expenseCategory: "" },
  ]) await assert.rejects(() => f.get(input(overrides)), /Некоректні параметри/);
  assert.deepEqual(f.calls, []);
  for (const result of [
    { data: null, error: { code: "22023", message: "SECRET_MISSING_OBJECT" } },
    { data: null, error: { code: "42501", message: "SECRET_DENIAL" } }, () => { throw new Error("SECRET_SYNC"); },
    () => Promise.reject(new Error("SECRET_ASYNC")), { data: [], error: null }, { data: [zero, zero], error: null },
    ...[null, "", " ", "NaN", Infinity].map((labor_cost) => ({ data: [{ ...zero, labor_cost }], error: null })),
    { data: [{ ...zero, payments_received: -1 }], error: null },
  ]) await assert.rejects(() => serviceFixture({ result }).get(input()), (e) => /Не вдалося/.test(e.message) && !/SECRET/.test(e.message));
});
test("Overview/summary make no raw KPI queries, keep B1/materials independent and totalObjectCost app-side", async () => {
  for (const scopes of [["overview"], ["overview", "equipment"]]) {
    const app = reportFixture(); const data = await app.get(input(), scopes);
    assert.equal(app.aggregateCalls.length, 1); assert.equal(app.currentCalls.length, 1);
    for (const name of ["get_management_work_logs", "object_expenses", "object_payments", "object_payment_schedule", "warehouse_purchases"])
      assert.equal(app.queries.filter((q) => q.name === name).length, 0, name);
    assert.ok(app.queries.some((q) => q.name === "get_management_materials"));
    assert.equal(app.materialCalls.length, 1); assert.equal(data.kpis.materialsCost, 6);
    assert.equal(app.equipmentCalls.length, scopes.includes("equipment") ? 1 : 0);
    assert.deepEqual(Object.keys(sqlModel(dataFixture(), input())), Object.keys(zero));
    assert.doesNotMatch(JSON.stringify(data), /INTERNAL_NOTE|INTERNAL_PAYMENT/);
  }
});
test("detail scopes and full Excel retain raw loaders; compact error never falls back to histories", async () => {
  const expectations = [
    [["objects"], ["get_management_work_logs", "object_expenses", "object_payments"]],
    [["workforce"], ["get_management_work_logs"]], [["cashflow"], ["object_expenses", "object_payments", "warehouse_purchases"]],
    [["warehouse"], ["warehouse_purchases"]], [undefined, ["get_management_work_logs", "object_expenses", "object_payments", "warehouse_purchases"]],
  ];
  for (const [scopes, names] of expectations) {
    const app = reportFixture(); await app.get(input(), scopes); assert.equal(app.aggregateCalls.length, 0);
    for (const name of names) assert.ok(app.queries.some((q) => q.name === name), name);
  }
  const equipment = reportFixture(); await equipment.get(input(), ["equipment"]); assert.equal(equipment.aggregateCalls.length, 0);
  const failure = reportFixture(dataFixture(), { aggregateError: new Error("Safe failure") });
  await assert.rejects(() => failure.get(input(), ["overview"]), /Safe failure/);
  assert.equal(failure.queries.filter((q) => ["get_management_work_logs", "object_expenses", "object_payments", "warehouse_purchases"].includes(q.name)).length, 0);
});
test("empty/invalid period remains zero; exact/legacy/mixed materials remain on their original contract", async () => {
  const empty = reportFixture({ work: [], expenses: [], payments: [], purchases: [] });
  assert.deepEqual(dtoFromKpis((await empty.get(input(), ["overview"])).kpis), zero);
  const invalid = reportFixture(); const data = await invalid.get(input({ dateFrom: "2026-10-03" }), ["overview"]);
  assert.equal(data.invalidPeriod, true); assert.deepEqual(dtoFromKpis(data.kpis), zero); assert.equal(invalid.aggregateCalls.length, 0);
  for (const materialMode of ["legacy", "mixed", "exact"]) {
    const app = reportFixture(dataFixture(), { materialMode });
    const old = await app.get(input()), compact = await app.get(input(), ["overview"]);
    assert.deepEqual(compact.materialAccounting, old.materialAccounting);
    assert.deepEqual(dtoFromKpis(compact.kpis), dtoFromKpis(old.kpis));
  }
});

test("SQL signature/allowlist/defaults/proargnames and final body pins are exact", () => {
  assert.match(pre, /p_date_from date,\s+p_date_to date,\s+p_object_id bigint default null,\s+p_employee_id bigint default null,\s+p_expense_category text default null/);
  const returns = pre.match(/returns table \(([\s\S]*?)\)/)[1].trim().split(/,\s*/);
  assert.deepEqual(returns, Object.keys(zero).map((key) => `${key} numeric`));
  const hash = createHash("md5").update(body).digest("hex");
  for (const sql of [pre, audit]) {
    assert.match(sql, new RegExp(`md5\\(p.prosrc\\)='${hash}'`));
    assert.match(sql, /p\.proargnames=array\['p_date_from','p_date_to','p_object_id','p_employee_id','p_expense_category'/);
    assert.match(sql, /p\.pronargdefaults=3/); assert.doesNotMatch(sql, /pronargnames|BODY_MD5|andrelkind|endif\b|usingerrcode|with_checkis/);
  }
});
test("SQL active-management guards precede domain/finance reads; ACL/owner/search path cannot broaden", () => {
  assert.match(body, /auth.uid\(\) is null/);
  assert.match(body, /private.is_active_user\(\) is distinct from true/);
  assert.match(body, /private.has_role\(array\['admin','object_manager'\]::text\[\]\) is distinct from true/);
  assert.ok(body.indexOf("errcode = '42501'") < body.indexOf("from public.objects"));
  assert.doesNotMatch(body, /'worker'|'client'|current_date|now\(\)/);
  assert.match(pre, /stable\s+security definer\s+set search_path = ''\s+set extra_float_digits = 3/);
  assert.match(pre, /alter function public.get_report_overview_period_totals\(date,date,bigint,bigint,text\) owner to postgres/);
  assert.match(pre, /revoke all on function public.get_report_overview_period_totals\(date,date,bigint,bigint,text\) from public, anon, authenticated, service_role/);
  assert.match(pre, /grant execute on function public.get_report_overview_period_totals\(date,date,bigint,bigint,text\) to authenticated/);
  assert.match(audit, /a\.is_grantable/); assert.doesNotMatch(pre, /with grant option/i);
  for (const sql of [pre, audit]) for (const role of ["anon", "service_role"]) assert.match(sql, new RegExp(`not has_function_privilege\\('${role}',p.oid,'EXECUTE'\\)`));
  assert.doesNotMatch(read("services/reportPeriodTotalsService.ts"), /supabase\/admin|service.role|process.env|\.from\(/i);
});
test("SQL filters/date/numeric rules match canonical TS including asymmetric rounding", () => {
  for (const expression of ["p_date_from is null or p_date_to is null", "not pg_catalog.isfinite(p_date_from)", "not pg_catalog.isfinite(p_date_to)",
    "p_date_from > p_date_to", "p_object_id is not null and p_object_id <= 0", "p_employee_id is not null and p_employee_id <= 0",
    "from public.objects o where o.id = p_object_id", "from public.employees e where e.id = p_employee_id"])
    assert.ok(body.includes(expression), expression);
  for (const category of objectExpenseCategories) assert.ok(body.includes(`'${category}'`));
  assert.match(body, /p_date_from::timestamp at time zone 'Europe\/Kyiv'/);
  assert.match(body, /\(p_date_to \+ 1\)::timestamp at time zone 'Europe\/Kyiv'/);
  const labor = body.split("from public.work_logs w")[1].split("union all")[0];
  const expenses = body.split("from public.object_expenses e")[1].split("union all")[0];
  const payments = body.split("from public.object_payments p")[1].split("union all")[0];
  const purchases = body.split("from public.warehouse_purchases p")[1].split("normalized_rows")[0];
  assert.match(labor, /w.work_date >= p_date_from and w.work_date <= p_date_to/);
  assert.match(labor, /w.object_id = p_object_id/); assert.match(labor, /w.employee_id = p_employee_id/); assert.doesNotMatch(labor, /p_expense_category/);
  assert.match(expenses, /e.expense_date >= p_date_from and e.expense_date <= p_date_to/);
  assert.match(expenses, /e.object_id = p_object_id/); assert.match(expenses, /e.category = p_expense_category/); assert.doesNotMatch(expenses, /p_employee_id/);
  assert.match(payments, /p.payment_date >= p_date_from and p.payment_date <= p_date_to/);
  assert.match(payments, /p.object_id = p_object_id/); assert.doesNotMatch(payments, /p_employee_id|p_expense_category/);
  assert.match(purchases, /p.status = 'Закуплено'/);
  assert.match(purchases, /p.purchased_at >= v_timestamp_from and p.purchased_at < v_timestamp_to_exclusive/);
  assert.doesNotMatch(purchases, /p_object_id|p_employee_id|p_expense_category/);
  assert.match(body, /w.hours as first_value, w.hourly_rate as second_value/);
  assert.match(body, /sum\(r.first_value \* r.second_value order by r.row_id\)/);
  assert.match(body, /sum\(r.first_value order by r.row_id\)/);
  assert.match(body, /pg_catalog.floor\(c.scaled\)\s+\+ case when c.scaled - pg_catalog.floor\(c.scaled\) >= 0.5::double precision/);
  assert.match(body, /sum\(greatest\(c.cents,0::double precision\)/);
  assert.match(body, /sum\(c.cents order by c.row_id\)/);
  assert.match(body, /order by c.payment_date desc, c.created_at desc, c.row_id desc/);
  const executableBody = body.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(executableBody, /from public.materials|from public.warehouse_movements|join public.employees|round\([^)]*,\s*2\)/);
});
test("B2 additive PRE and isolated read-only audit preserve original B1/material contracts without baseline refresh", () => {
  const snapshots = [...(pre + audit).matchAll(/-- REPORTS PRESERVATION BEGIN\n([\s\S]*?)\n-- REPORTS PRESERVATION END/g)].map((m) => m[1]);
  assert.equal(snapshots.length, 3); assert.equal(new Set(snapshots).size, 1);
  assert.match(snapshots[0], /p.proname<>'get_report_overview_period_totals'/);
  assert.doesNotMatch(snapshots[0], /p.proname<>'get_report_overview_current_finance'/);
  assert.match(snapshots[0], /'b1_baseline',obj_description/);
  assert.match(pre, /v_existing<>v_baseline::text/);
  assert.equal((pre.match(/create or replace function/gi) || []).length, 1);
  assert.doesNotMatch(pre, /\b(?:create|alter|drop)\s+(?:table|policy|index)|\b(?:insert into|update public|delete from)\b/i);
  assert.match(audit, /begin;\s+set transaction read only;\s+set local search_path = pg_catalog;/);
  assert.doesNotMatch(audit, /\b(?:create|alter|drop|grant|revoke|insert|update|delete)\s+(?:table|function|policy|on|into|from|public\.)/i);
  const names = [...audit.matchAll(/\('([a-z_][a-z0-9_]*)', \$check\$/g)].map((m) => m[1]);
  assert.equal(names.length, 14); assert.equal(new Set(names).size, 14);
  assert.match(audit, /count\(\*\)=14/); assert.match(audit, /'expected_checks',14/);
  assert.match(audit, /'runtime_authorization_tested',false/); assert.match(audit, /get stacked diagnostics v_state=returned_sqlstate/);
  const workBody = read("database/object-3.0-security-pre-deploy.sql").split("create or replace function public.get_management_work_logs()")[1].split("as $function$")[1].split("$function$")[0];
  assert.ok(pre.includes(createHash("md5").update(workBody).digest("hex")));
  const b1Body = read("database/reports-4.0b1-current-finance-pre-deploy.sql").split("as $function$")[1].split("$function$")[0];
  assert.ok(pre.includes(createHash("md5").update(b1Body).digest("hex")));
});
