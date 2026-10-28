// No SQL/network execution. Real TS services plus a binary64 SQL-expression model.
// Catalog/body assertions do not replace production session/SQL parity smoke.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, "utf8");
const pre = read("database/reports-4.0b1-current-finance-pre-deploy.sql");
const audit = read("database/reports-4.0b1-current-finance-production-audit.sql");
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
const money = load("lib/objectPayments.ts");
const { calculateObjectPaymentSchedule } = load("lib/objectPaymentSchedule.ts");
const today = "2026-10-06";
const row = (id, object_id, amount, due_date = "2026-10-01", created_at = "2026-09-01T00:00:00+00:00") =>
  ({ id, object_id, amount, due_date, created_at });
const fixture = (price, amounts = [], schedule = []) => ({
  objects: [{ id: 1, client_price: price }], payments: amounts.map((v, i) => row(i + 1, 1, v)), schedule,
});

// Equivalent to the reviewed SQL floor + fractional comparison, NOT Math.round.
function sqlRound(scaled) {
  return Math.floor(scaled) + (scaled - Math.floor(scaled) >= 0.5 ? 1 : 0);
}
function sqlCents(input) {
  const amount = Number(input);
  return sqlRound(Number.isFinite(amount) ? amount * 100 : 0);
}
function sqlModel(data, objectId = null, businessDate = today) {
  const objects = data.objects.filter((o) => objectId === null || o.id === objectId);
  let outstanding = 0, missing = 0, overdue = 0;
  const allocations = [];
  for (const o of objects) {
    const payments = data.payments.filter((p) => p.object_id === o.id).sort((a, b) => a.id - b.id);
    const paid = sqlCents(payments.reduce((sum, p) => sum + Math.max(sqlCents(p.amount), 0), 0) / 100);
    if (o.client_price === null) missing++;
    else outstanding += Math.max(sqlCents(sqlCents(o.client_price) / 100) - paid, 0) / 100;
    const ordered = data.schedule.filter((s) => s.object_id === o.id).sort((a, b) =>
      a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at) || a.id - b.id);
    let before = 0;
    for (const s of ordered) {
      const amount = Math.max(sqlCents(s.amount), 0);
      const allocated = Math.min(Math.max(paid - before, 0), amount);
      const remaining = amount - allocated;
      before += amount;
      allocations.push({ id: s.id, paid: allocated, remaining });
      if (s.due_date < businessDate) overdue += sqlCents(remaining / 100);
    }
  }
  return { dto: { outstanding_receivables: outstanding, objects_without_client_price: missing, overdue_schedule_amount: overdue / 100 }, allocations };
}
function existingTS(data, objectId = null, businessDate = today) {
  let outstanding = 0, missing = 0, overdue = 0;
  const allocations = [];
  for (const o of data.objects.filter((o) => objectId === null || o.id === objectId)) {
    const paid = data.payments.filter((p) => p.object_id === o.id).sort((a, b) => a.id - b.id)
      .reduce((sum, p) => sum + Math.max(money.toMoneyInCents(Number(p.amount)), 0), 0) / 100;
    const summary = money.calculateObjectPaymentSummary(o.client_price, [paid]);
    if (o.client_price === null) missing++;
    else outstanding += summary.remainingToPay ?? 0;
    const result = calculateObjectPaymentSchedule(data.schedule.filter((s) => s.object_id === o.id), paid, o.client_price, businessDate);
    for (const s of result.items) {
      overdue += money.toMoneyInCents(s.overdueAmount);
      allocations.push({ id: s.id, paid: money.toMoneyInCents(s.paidAmount), remaining: money.toMoneyInCents(s.remainingAmount) });
    }
  }
  return { dto: { outstanding_receivables: outstanding, objects_without_client_price: missing, overdue_schedule_amount: overdue / 100 }, allocations };
}
const cases = [
  ["no payments", fixture(100), [100, 0, 0]],
  ["unpriced object still has schedule", fixture(null, [], [row(1, 1, 40)]), [0, 1, 40]],
  ["positive lifetime payments", fixture(100, [20, 30]), [50, 0, 0]],
  ["negative payments ignored", fixture(100, [40, -60]), [60, 0, 0]],
  ["fully paid", fixture(100, [100]), [0, 0, 0]],
  ["overpayment", fixture(100, [150]), [0, 0, 0]],
  ["multiple rows and partial allocation", fixture(100, [45], [row(3, 1, 30), row(1, 1, 30), row(2, 1, 40)]), [55, 0, 55]],
  ["fully paid overdue row", fixture(100, [40], [row(1, 1, 40), row(2, 1, 60, "2026-10-07")]), [60, 0, 0]],
  ["today and future are not overdue", fixture(100, [], [row(1, 1, 40, today), row(2, 1, 60, "2026-10-07")]), [100, 0, 0]],
  ["fractional cents round per row, not total", fixture(10.005, [1.005, 0.145], [row(1, 1, 2.005), row(2, 1, 2.675)]), [8.87, 0, 3.55]],
  ["same due date orders by created_at then id", fixture(100, [25], [
    row(4, 1, 30, "2026-10-01", "2026-09-03T00:00:00+00:00"),
    row(3, 1, 30), row(2, 1, 40),
  ]), [75, 0, 75]],
];
for (const [name, data, expected] of cases) {
  test(`current finance cents parity: ${name}`, () => {
    const actual = sqlModel(data);
    assert.deepEqual(actual, existingTS(data));
    assert.deepEqual(Object.values(actual.dto).map((n) => Math.round(n * 100)), expected.map((n) => Math.round(n * 100)));
    if (name.startsWith("same due")) assert.deepEqual(actual.allocations, [
      { id: 2, paid: 2500, remaining: 1500 }, { id: 3, paid: 0, remaining: 3000 }, { id: 4, paid: 0, remaining: 3000 },
    ]);
  });
}
test("object filter affects all three current KPIs; empty scope gives one zero row", () => {
  const data = { objects: [{ id: 1, client_price: 100 }, { id: 2, client_price: null }, { id: 3, client_price: 50 }],
    payments: [row(1, 1, 30), row(2, 3, 60)], schedule: [row(1, 1, 100), row(2, 2, 20), row(3, 3, 50)] };
  for (const id of [null, 1, 2, 3]) assert.deepEqual(sqlModel(data, id), existingTS(data, id));
  assert.deepEqual(Object.values(sqlModel(data).dto), [70, 1, 90]);
  assert.deepEqual(Object.values(sqlModel(data, 2).dto), [0, 1, 20]);
  assert.deepEqual(Object.values(sqlModel({ objects: [], payments: [], schedule: [] }).dto), [0, 0, 0]);
});
test("binary64 rounding matches JS including below-half edges where floor(x+0.5) is wrong", () => {
  for (const value of [1.005, 2.675, .145, .285, .565, -1.005, -.005, .004999999999999999, 0, 100.999, 99999.995]) {
    assert.equal(sqlCents(value), money.toMoneyInCents(value) || 0, String(value));
  }
  assert.equal(sqlCents(1.005), 100); // numeric round(1.005,2) would return 1.01.
  assert.equal(sqlRound(0.49999999999999994), 0);
  let seed = 20261006;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 250; i++) {
    const data = fixture(random() * 1000, Array.from({ length: 8 }, () => (random() - .2) * 100),
      Array.from({ length: 10 }, (_, j) => row(j + 1, 1, random() * 300, j % 3 ? "2026-10-01" : today)));
    assert.deepEqual(sqlModel(data), existingTS(data));
  }
});
test("numeric wire retains the JS result beyond 15 significant digits", () => {
  for (const price of [12345678901234.56, 1000000000000.01, 10.005]) {
    const actual = sqlModel(fixture(price)).dto;
    assert.deepEqual(actual, existingTS(fixture(price)).dto);
    assert.equal(Number(String(actual.outstanding_receivables)), actual.outstanding_receivables);
  }
  assert.notEqual(Number((12345678901234.56).toPrecision(15)), 12345678901234.56);
  assert.match(pre, /set extra_float_digits = 3/);
  assert.equal((body.match(/::text::numeric/g) || []).length, 2);
  assert.match(body, /order by o.object_first_id,o.due_date,o.created_at,o.row_id/);
  for (const sql of [pre, audit]) assert.match(sql, /'search_path=""','extra_float_digits=3'/);
});

const dto = { outstanding_receivables: 123.45, objects_without_client_price: 2, overdue_schedule_amount: 67.89 };
function serviceFixture({ identity = "internal", role = "admin", active = true, result = { data: [dto], error: null } } = {}) {
  const calls = [];
  const load = loader({
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => ({ role, is_active: active }) },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => {
      calls.push(args); return typeof result === "function" ? result() : result;
    } }) },
  });
  return { calls, get: load("services/reportCurrentFinanceService.ts").getReportOverviewCurrentFinance };
}
test("admin/object_manager use one user RPC and receive the exact allowlist", async () => {
  for (const role of ["admin", "object_manager"]) {
    const f = serviceFixture({ role, result: { data: [{ ...dto, outstanding_receivables: "123.45", unexpected_secret: "SECRET" }], error: null } });
    assert.deepEqual(await f.get(47, today), dto);
    assert.deepEqual(f.calls, [["get_report_overview_current_finance", { p_object_id: 47, p_business_date: today }]]);
    assert.deepEqual(Object.keys(await f.get(null, today)), Object.keys(dto));
  }
});
test("worker/inactive/client/guest/denied identities execute ZERO new finance RPCs", async () => {
  for (const options of [{ role: "worker" }, { active: false }, ...["client", "guest", "denied"].map((identity) => ({ identity }))]) {
    const f = serviceFixture(options);
    await assert.rejects(() => f.get(null, today), /Недостатньо прав/);
    assert.deepEqual(f.calls, []);
  }
});
test("invalid date/object fails before RPC; missing object/DB errors yield safe failure without raw fallback", async () => {
  const f = serviceFixture();
  for (const [id, date] of [[0, today], [-1, today], [1.2, today], [Number.MAX_SAFE_INTEGER + 1, today],
    [null, null], [null, "2026-02-30"], [null, "infinity"], [null, ""], [null, "2026-10-06T00:00:00Z"]]) {
    await assert.rejects(() => f.get(id, date), /Некоректні параметри/);
  }
  assert.deepEqual(f.calls, []);
  for (const result of [
    { data: null, error: { code: "22023", message: "SECRET_OBJECT" } },
    { data: null, error: { code: "42501", message: "SECRET_AUTH" } },
    () => { throw new Error("SECRET_NETWORK"); }, { data: [], error: null }, { data: [dto, dto], error: null },
    { data: [{ ...dto, objects_without_client_price: 1.2 }], error: null },
    { data: [{ ...dto, overdue_schedule_amount: -1 }], error: null },
    { data: [{ ...dto, outstanding_receivables: "NaN" }], error: null },
  ]) await assert.rejects(() => serviceFixture({ result }).get(999, today), (e) => !/SECRET/.test(e.message) && /Не вдалося/.test(e.message));
});

function reportsFixture() {
  const queries = [], aggregates = [], materialAggregates = [];
  const query = (kind, name) => {
    const log = { kind, name, methods: [] }; queries.push(log);
    const chain = new Proxy({}, { get: (_, method) => method === "then"
      ? (done) => Promise.resolve({ data: [], error: null }).then(done)
      : (...args) => { log.methods.push([method, ...args]); return chain; } });
    return chain;
  };
  const load = loader({
    "@/lib/supabase/server": { createClient: async () => ({ from: (name) => query("from", name), rpc: (name) => query("rpc", name) }) },
    "@/services/reportCurrentFinanceService": { getReportOverviewCurrentFinance: async (...args) => { aggregates.push(args); return dto; } },
    "@/services/reportPeriodTotalsService": { getReportOverviewPeriodTotals: async () => ({
      labor_cost: 0, other_expenses_cost: 0, total_hours: 0, purchased_cost: 0, payments_received: 0,
    }) },
    "@/services/reportMaterialTotalsService": { getReportOverviewMaterialTotals: async (...args) => {
      materialAggregates.push(args); return { materials_cost: 0, exact_cost: 0,
        legacy_approximate_cost: 0, period_mode: "legacy", cutover_at: null };
    } },
    "@/services/equipmentService": { getManagementEquipmentServiceRecordsRange: async () => [] },
    "@/services/reportMaterialLedgerService": {
      getMaterialLedgerCutover: async () => null, getReportMaterialPeriodMode: () => "legacy",
      getMaterialLedgerReport: async () => ({ cutover: null, periodMode: "legacy", costs: [], movements: [] }),
    },
  });
  return { queries, aggregates, materialAggregates, get: load("services/reportService.ts").getReportsData };
}
const filters = { dateFrom: "2026-01-01", dateTo: "2026-01-03", objectId: 47, employeeId: null, expenseCategory: null, movementType: null };
test("Overview and summary CSV retain B1 current finance DTO while B2 replaces period loaders", async () => {
  for (const scope of [["overview"], ["overview", "equipment"]]) {
    const f = reportsFixture();
    const data = await f.get(filters, scope);
    assert.equal(f.aggregates.length, 1); assert.equal(f.aggregates[0][0], 47);
    assert.equal(f.aggregates[0][1], load("lib/kyivDate.ts").getKyivDateValue());
    assert.notEqual(f.aggregates[0][1], filters.dateTo, "current not period KPI");
    assert.equal(data.kpis.outstandingReceivables, dto.outstanding_receivables);
    assert.equal(data.kpis.objectsWithoutClientPrice, dto.objects_without_client_price);
    assert.equal(data.kpis.overdueScheduleAmount, dto.overdue_schedule_amount);
    assert.equal(f.queries.filter((q) => q.name === "object_payment_schedule").length, 0);
    const payments = f.queries.filter((q) => q.name === "object_payments");
    assert.equal(payments.length, 0);
    for (const name of ["get_management_work_logs", "object_expenses", "warehouse_purchases"])
      assert.equal(f.queries.filter((q) => q.name === name).length, 0, `${name} moved to B2 period aggregate`);
    assert.equal(f.materialAggregates.length, 1);
    assert.equal(f.queries.some((q) => q.name === "get_management_materials"), false,
      "B3 material aggregate replaces the independent raw Overview path");
  }
});
test("Objects/Cashflow/full Excel retain old raw contracts; non-overview sections do not call new RPC", async () => {
  for (const scope of [["objects"], ["cashflow"], undefined]) {
    const f = reportsFixture(); await f.get(filters, scope);
    assert.equal(f.aggregates.length, 0);
    assert.equal(f.queries.filter((q) => q.name === "object_payments").length, 2);
    assert.equal(f.queries.filter((q) => q.name === "object_payment_schedule").length, scope?.[0] === "objects" ? 0 : 1);
  }
  for (const scope of [["workforce"], ["equipment"], ["warehouse"]]) {
    const f = reportsFixture(); await f.get(filters, scope); assert.equal(f.aggregates.length, 0);
  }
});

test("SQL exact signature/DTO/body pins and idempotent preservation baseline agree", () => {
  assert.match(pre, /p_business_date date,\s+p_object_id bigint default null/);
  assert.match(pre, /returns table \(\s+outstanding_receivables numeric,\s+objects_without_client_price bigint,\s+overdue_schedule_amount numeric\s+\)/);
  const hash = createHash("md5").update(body).digest("hex");
  assert.match(pre, new RegExp(`md5\\(p.prosrc\\)='${hash}'`));
  assert.match(audit, new RegExp(`md5\\(p.prosrc\\)='${hash}'`));
  const snapshots = [...(pre + audit).matchAll(/-- REPORTS PRESERVATION BEGIN\n([\s\S]*?)\n-- REPORTS PRESERVATION END/g)].map((m) => m[1]);
  assert.equal(snapshots.length, 3); assert.equal(new Set(snapshots).size, 1);
  assert.match(pre, /v_existing<>v_baseline::text/);
  assert.match(pre, /do not refresh the baseline/);
  assert.match(audit, /runtime_authorization_tested',false/);
});
test("SQL authorization precedes every finance read; business date/object validation is explicit", () => {
  assert.match(body, /auth\.uid\(\) is null/);
  assert.match(body, /private\.is_active_user\(\) is distinct from true/);
  assert.match(body, /private\.has_role\(array\['admin','object_manager'\]::text\[\]\) is distinct from true/);
  assert.doesNotMatch(body, /'worker'|'client'|current_date|now\(\)|service_role/);
  assert.ok(body.indexOf("errcode = '42501'") < body.indexOf("from public.objects"));
  assert.match(body, /p_business_date is null or not pg_catalog\.isfinite\(p_business_date\)/);
  assert.match(body, /p_object_id is not null and p_object_id <= 0/);
  assert.match(body, /not exists \(\s+select 1 from public.objects o where o.id = p_object_id/);
  assert.match(pre, /stable\s+security definer\s+set search_path = ''/);
  assert.match(pre, /owner to postgres/);
  assert.match(pre, /revoke all on function public.get_report_overview_current_finance\(date,bigint\) from public, anon, authenticated, service_role/);
  assert.match(pre, /grant execute on function public.get_report_overview_current_finance\(date,bigint\) to authenticated/);
  assert.doesNotMatch(pre, /with grant option/i);
  for (const s of [pre, audit]) assert.match(s, /a\.is_grantable/);
});
test("SQL binary64 cents/FIFO expression and source scope match the parity model", () => {
  assert.match(body, /m\.amount \* 100::double precision/);
  assert.match(body, /pg_catalog\.floor\(m\.scaled\)\s+\+ case when m\.scaled - pg_catalog\.floor\(m\.scaled\) >= 0\.5::double precision/);
  assert.match(body, /sum\(greatest\(c.value,0::double precision\) order by c.row_id\)/);
  assert.match(body, /order by c\.due_date, c\.created_at, c\.row_id\s+rows between unbounded preceding and 1 preceding/);
  assert.match(body, /where s\.due_date < p_business_date/);
  assert.match(body, /from public.object_payments p join scoped_objects o on o.id = p.object_id/);
  assert.match(body, /from public.object_payment_schedule s join scoped_objects o on o.id = s.object_id/);
  assert.doesNotMatch(body, /\bround\s*\([^)]*,\s*2\)|\b(current_date|payment_date)\b/);
});
test("deploy changes only new RPC; audit remains read-only isolated checks with one summary", () => {
  assert.equal((pre.match(/create or replace function/gi) || []).length, 1);
  assert.doesNotMatch(pre, /\b(?:create|alter|drop)\s+(?:table|policy|index)|\b(?:insert into|update public|delete from)\b/i);
  assert.match(audit, /begin;\s+set transaction read only;\s+set local search_path = pg_catalog;/);
  assert.doesNotMatch(audit, /\b(?:create|alter|drop|grant|revoke|insert|update|delete)\s+(?:table|function|policy|on|into|from|public\.)/i);
  const checks = [...audit.matchAll(/\('([a-z_]+)', \$check\$/g)].map((m) => m[1]);
  assert.equal(checks.length, 12); assert.equal(new Set(checks).size, 12);
  assert.match(audit, /count\(\*\)=12/); assert.match(audit, /'expected_checks',12/);
  assert.match(audit, /get stacked diagnostics v_state=returned_sqlstate/);
  assert.doesNotMatch(pre + audit, /andrelkind|endif\b|usingerrcode|with_checkis|BODY_MD5/);
});
