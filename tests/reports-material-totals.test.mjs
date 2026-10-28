// Reports 4.0B3 focused parity/application/static tests. SQL is never executed here.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(file, "utf8");
const pre = read("database/reports-4.0b3-material-totals-pre-deploy.sql");
const audit = read("database/reports-4.0b3-material-totals-production-audit.sql");
const body = pre.split("as $function$")[1].split("$function$")[0];

function sourceBody(file, signatureStart) {
  const source = read(file);
  const start = source.indexOf(`create or replace function ${signatureStart}`);
  assert.notEqual(start, -1, signatureStart);
  const bodyStart = source.indexOf("as $function$", start) + "as $function$".length;
  return source.slice(bodyStart, source.indexOf("$function$", bodyStart));
}

function loader(mocks = {}) {
  const cache = new Map();
  const load = (file) => {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
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

const baseLoad = loader();
const { getKyivDateStartUtc, addDaysToDateValue } = baseLoad("lib/kyivDate.ts");
const { toMoneyInCents } = baseLoad("lib/objectPayments.ts");
const { getReportMaterialPeriodMode } = baseLoad("services/reportMaterialLedgerService.ts");
const filters = { dateFrom: "2026-10-01", dateTo: "2026-10-02", objectId: null,
  employeeId: null, expenseCategory: null, movementType: null };
const cutover = (at = "2026-10-01T12:00:00.000Z", boundary = 10) =>
  ({ ledgerVersion: 3, boundaryMovementId: boundary, cutoverAt: at });
const material = (id, object_id, quantity, price, created_at = "2026-10-01T09:00:00.000Z") =>
  ({ id, object_id, quantity, price, created_at });
const movement = (id, object_id, movement_code, total_cost, created_at = "2026-10-01T13:00:00.000Z",
  ledger_version = 3) => ({ id, object_id, movement_code, total_cost, created_at, ledger_version });

const signedCodes = new Map([
  ["issue_to_object", 1], ["direct_to_object", 1],
  ["return_from_object", -1], ["direct_object_reversal", -1],
]);
const sqlRound = (scaled) => Math.floor(scaled) + (scaled - Math.floor(scaled) >= 0.5 ? 1 : 0);
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function existingJsModel(data, input = filters) {
  const timestampFrom = getKyivDateStartUtc(input.dateFrom);
  const timestampToExclusive = getKyivDateStartUtc(addDaysToDateValue(input.dateTo, 1));
  const mode = getReportMaterialPeriodMode(timestampFrom, timestampToExclusive, data.cutover);
  const inObject = (row) => input.objectId === null || row.object_id === input.objectId;
  const legacyCents = mode === "legacy" ? data.materials
    .filter((row) => row.object_id > 0 && inObject(row)
      && Date.parse(row.created_at) >= Date.parse(timestampFrom)
      && Date.parse(row.created_at) < Date.parse(timestampToExclusive))
    .sort((a, b) => a.id - b.id)
    .reduce((sum, row) => sum + toMoneyInCents(finite(row.quantity) * finite(row.price)), 0) : 0;
  const exactCents = mode === "legacy" ? 0 : data.movements
    .filter((row) => row.ledger_version === 3 && row.id > data.cutover.boundaryMovementId
      && row.object_id !== null && inObject(row)
      && Date.parse(row.created_at) >= Date.parse(timestampFrom)
      && Date.parse(row.created_at) < Date.parse(timestampToExclusive)
      && signedCodes.has(row.movement_code))
    .reduce((sum, row) => sum + signedCodes.get(row.movement_code) * toMoneyInCents(finite(row.total_cost)), 0);
  const exact = exactCents / 100;
  const legacy = legacyCents / 100;
  return { materials_cost: mode === "legacy" ? legacy : exact, exact_cost: exact,
    legacy_approximate_cost: mode === "mixed" ? null : legacy,
    period_mode: mode, cutover_at: data.cutover?.cutoverAt ?? null };
}

function sqlExpressionModel(data, input = filters) {
  const timestampFrom = getKyivDateStartUtc(input.dateFrom);
  const timestampToExclusive = getKyivDateStartUtc(addDaysToDateValue(input.dateTo, 1));
  const mode = !data.cutover || Date.parse(timestampToExclusive) <= Date.parse(data.cutover.cutoverAt)
    ? "legacy" : Date.parse(timestampFrom) >= Date.parse(data.cutover.cutoverAt) ? "exact" : "mixed";
  const inObject = (row) => input.objectId === null || row.object_id === input.objectId;
  const legacy = mode === "legacy" ? data.materials.filter((row) => row.object_id > 0 && inObject(row)
    && Date.parse(row.created_at) >= Date.parse(timestampFrom)
    && Date.parse(row.created_at) < Date.parse(timestampToExclusive)).sort((a, b) => a.id - b.id)
    .reduce((sum, row) => sum + sqlRound(finite(row.quantity) * finite(row.price) * 100), 0) / 100 : 0;
  const exact = mode === "legacy" ? 0 : data.movements.filter((row) => row.ledger_version === 3
    && row.id > data.cutover.boundaryMovementId && row.object_id !== null && inObject(row)
    && Date.parse(row.created_at) >= Date.parse(timestampFrom)
    && Date.parse(row.created_at) < Date.parse(timestampToExclusive) && signedCodes.has(row.movement_code))
    .sort((a, b) => a.id - b.id)
    .reduce((sum, row) => sum + signedCodes.get(row.movement_code) * finite(row.total_cost), 0);
  return { materials_cost: mode === "legacy" ? legacy : exact, exact_cost: exact,
    legacy_approximate_cost: mode === "mixed" ? null : legacy,
    period_mode: mode, cutover_at: data.cutover?.cutoverAt ?? null };
}

test("legacy/no-cutover and boundary-equality modes preserve the existing period contract", () => {
  const rows = [material(1, 1, 1, 1.005), material(2, 1, 2, 2.675)];
  assert.deepEqual(sqlExpressionModel({ cutover: null, materials: rows, movements: [] }),
    { materials_cost: 6.35, exact_cost: 0, legacy_approximate_cost: 6.35, period_mode: "legacy", cutover_at: null });
  const periodEnd = getKyivDateStartUtc(addDaysToDateValue(filters.dateTo, 1));
  assert.equal(sqlExpressionModel({ cutover: cutover(periodEnd), materials: rows, movements: [] }).period_mode, "legacy");
  const periodStart = getKyivDateStartUtc(filters.dateFrom);
  assert.equal(sqlExpressionModel({ cutover: cutover(periodStart), materials: rows, movements: [] }).period_mode, "exact");
});

test("mixed omits legacy half; exact starts at cutover and uses ID boundary, not snapshot rows", () => {
  const data = { cutover: cutover(), materials: [material(1, 1, 100, 100)], movements: [
    movement(10, 1, "issue_to_object", 999),
    movement(11, 1, "object_opening_balance", 999),
    movement(12, 1, "issue_to_object", 4.25),
  ] };
  assert.deepEqual(sqlExpressionModel(data), { materials_cost: 4.25, exact_cost: 4.25,
    legacy_approximate_cost: null, period_mode: "mixed", cutover_at: data.cutover.cutoverAt });
  assert.deepEqual(sqlExpressionModel(data), existingJsModel(data));
});

test("all four signed exact codes apply; non-cost codes are ignored and negative totals are retained", () => {
  const start = getKyivDateStartUtc(filters.dateFrom);
  const ignored = ["legacy_receipt", "legacy_write_off", "purchase_receipt", "adjustment_in", "adjustment_out",
    "opening_balance", "object_opening_balance"];
  const data = { cutover: cutover(start, 10), materials: [], movements: [
    movement(11, 1, "issue_to_object", 10), movement(12, 1, "direct_to_object", 5),
    movement(13, 1, "return_from_object", 8), movement(14, 1, "direct_object_reversal", 9),
    ...ignored.map((code, index) => movement(20 + index, 1, code, 1000)),
  ] };
  assert.deepEqual(sqlExpressionModel(data), existingJsModel(data));
  assert.equal(sqlExpressionModel(data).materials_cost, -2);
});

test("date/object are the only material filters; empty and zero-cost scopes return one zero DTO", () => {
  const data = { cutover: null, materials: [material(1, 1, 2, 3), material(2, 2, 4, 5),
    material(3, 1, 99, 99, "2026-09-30T20:59:59.999Z"),
    material(4, 1, 99, 99, "2026-10-02T21:00:00.000Z"), material(5, 1, 0, 99)], movements: [] };
  const base = sqlExpressionModel(data);
  const filtered = sqlExpressionModel(data, { ...filters, objectId: 1, employeeId: 999,
    expenseCategory: "SECRET", movementType: "Прихід" });
  assert.equal(base.materials_cost, 26);
  assert.equal(filtered.materials_cost, 6);
  assert.deepEqual(sqlExpressionModel({ cutover: null, materials: [], movements: [] }),
    { materials_cost: 0, exact_cost: 0, legacy_approximate_cost: 0, period_mode: "legacy", cutover_at: null });
});

for (const [date, start, end, hours] of [
  ["2026-01-01", "2025-12-31T22:00:00.000Z", "2026-01-01T22:00:00.000Z", 24],
  ["2026-07-01", "2026-06-30T21:00:00.000Z", "2026-07-01T21:00:00.000Z", 24],
  ["2026-03-29", "2026-03-28T22:00:00.000Z", "2026-03-29T21:00:00.000Z", 23],
  ["2026-10-25", "2026-10-24T21:00:00.000Z", "2026-10-25T22:00:00.000Z", 25],
]) test(`Kyiv half-open material bounds: ${date} (${hours}h)`, () => {
  assert.equal(getKyivDateStartUtc(date), start);
  assert.equal(getKyivDateStartUtc(addDaysToDateValue(date, 1)), end);
  const input = { ...filters, dateFrom: date, dateTo: date };
  const data = { cutover: null, movements: [], materials: [
    material(1, 1, 99, 99, new Date(Date.parse(start) - 1).toISOString()), material(2, 1, 1, 1.005, start),
    material(3, 1, 1, 2.675, new Date(Date.parse(end) - 1).toISOString()), material(4, 1, 99, 99, end),
  ] };
  assert.equal(sqlExpressionModel(data, input).materials_cost, 3.68);
});

test("legacy uses current mutable rows and reproduces per-row JS binary64 Math.round", () => {
  const edges = [1.005, 2.675, .145, .285, .565, .004999999999999999, 0, 100.999, 99999.995];
  for (const value of edges) assert.equal(sqlRound(value * 100), toMoneyInCents(value), String(value));
  const data = { cutover: null, movements: [], materials: [material(1, 1, 1, 1.005)] };
  assert.equal(sqlExpressionModel(data).materials_cost, 1);
  data.materials[0].price = 2.675;
  assert.equal(sqlExpressionModel(data).materials_cost, 2.68, "mutable current row is deliberately observed");
  let seed = 20261027;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 250; i++) {
    const sample = { cutover: null, movements: [], materials: Array.from({ length: 10 }, (_, j) =>
      material(j + 1, j % 2 + 1, random() * 100, random() * 1000)) };
    const input = { ...filters, objectId: i % 3 === 0 ? 1 : null };
    assert.deepEqual(sqlExpressionModel(sample, input), existingJsModel(sample, input), `case ${i}`);
  }
});

const dto = { materials_cost: -12.34, exact_cost: -12.34, legacy_approximate_cost: 0,
  period_mode: "exact", cutover_at: "2026-10-01T00:00:00.000Z" };
function serviceFixture({ identity = "internal", role = "admin", active = true,
  result = { data: [dto], error: null } } = {}) {
  const calls = [];
  const load = loader({
    "@/services/accountIdentityService": { getAccountIdentity: async () => identity },
    "@/services/profileService": { getCurrentUserProfile: async () => ({ role, is_active: active }) },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: (...args) => {
      calls.push(args); return typeof result === "function" ? result() : Promise.resolve(result);
    } }) },
  });
  return { calls, get: load("services/reportMaterialTotalsService.ts").getReportOverviewMaterialTotals };
}

test("admin/object_manager call one user-scoped B3 RPC and receive only the five-field DTO", async () => {
  for (const role of ["admin", "object_manager"]) {
    const f = serviceFixture({ role, result: { data: [{ ...dto, materials_cost: "-12.34",
      boundary_movement_id: 10, quantity: 99, price: 88, note: "SECRET", actor: "SECRET" }], error: null } });
    assert.deepEqual(await f.get(filters), dto);
    assert.deepEqual(f.calls, [["get_report_overview_material_totals", {
      p_date_from: filters.dateFrom, p_date_to: filters.dateTo, p_object_id: null,
    }]]);
    assert.deepEqual(Object.keys(await f.get(filters)), ["materials_cost", "exact_cost",
      "legacy_approximate_cost", "period_mode", "cutover_at"]);
  }
});

test("worker/client/inactive/guest/denied identities execute zero B3 RPCs", async () => {
  for (const options of [{ role: "worker" }, { active: false },
    ...["client", "guest", "denied"].map((identity) => ({ identity }))]) {
    const f = serviceFixture(options);
    await assert.rejects(() => f.get(filters), /Недостатньо прав/);
    assert.deepEqual(f.calls, []);
  }
});

test("invalid inputs and missing object/DB/DTO failures fail closed without raw errors", async () => {
  const f = serviceFixture();
  for (const override of [{ dateFrom: null }, { dateTo: null }, { dateFrom: "2026-02-30" },
    { dateFrom: "2026-10-03" }, { objectId: 0 }, { objectId: -1 }, { objectId: 1.2 },
    { objectId: Number.MAX_SAFE_INTEGER + 1 }])
    await assert.rejects(() => f.get({ ...filters, ...override }), /Некоректні параметри/);
  assert.deepEqual(f.calls, []);
  for (const result of [
    { data: null, error: { code: "22023", message: "SECRET_OBJECT" } },
    { data: null, error: { code: "42501", message: "SECRET_DENIED" } },
    () => { throw new Error("SECRET_SYNC"); }, () => Promise.reject(new Error("SECRET_ASYNC")),
    { data: [], error: null }, { data: [dto, dto], error: null },
    { data: [{ ...dto, period_mode: "other" }], error: null },
    { data: [{ ...dto, exact_cost: "NaN" }], error: null },
    { data: [{ ...dto, period_mode: "mixed", legacy_approximate_cost: 1 }], error: null },
    { data: [{ ...dto, period_mode: "exact", cutover_at: null }], error: null },
  ]) await assert.rejects(() => serviceFixture({ result }).get(filters),
    (error) => /Не вдалося/.test(error.message) && !/SECRET/.test(error.message));
});

function reportsFixture(materialResult = { ...dto, materials_cost: 7.25, exact_cost: 7.25 }) {
  const queries = [], materialCalls = [], ledgerCalls = [], cutoverCalls = [];
  const query = (name) => {
    const log = { name, methods: [] }; queries.push(log);
    const chain = new Proxy({}, { get: (_, method) => method === "then"
      ? (done) => Promise.resolve({ data: [], error: null }).then(done)
      : (...args) => { log.methods.push([method, ...args]); return chain; } });
    return chain;
  };
  const load = loader({
    "@/lib/supabase/server": { createClient: async () => ({ from: query, rpc: query }) },
    "@/services/reportMaterialTotalsService": { getReportOverviewMaterialTotals: async (input) => {
      materialCalls.push(input); return materialResult;
    } },
    "@/services/reportCurrentFinanceService": { getReportOverviewCurrentFinance: async () => ({
      outstanding_receivables: 0, objects_without_client_price: 0, overdue_schedule_amount: 0,
    }) },
    "@/services/reportPeriodTotalsService": { getReportOverviewPeriodTotals: async () => ({
      labor_cost: 10, other_expenses_cost: 3, total_hours: 1, purchased_cost: 0, payments_received: 0,
    }) },
    "@/services/reportMaterialLedgerService": {
      getMaterialLedgerCutover: async (...args) => { cutoverCalls.push(args); return null; },
      getReportMaterialPeriodMode: () => "legacy",
      getMaterialLedgerReport: async (...args) => { ledgerCalls.push(args); return {
        cutover: null, periodMode: "legacy", costs: [], movements: [],
      }; },
    },
    "@/services/equipmentService": { getManagementEquipmentServiceRecordsRange: async () => [] },
  });
  return { get: load("services/reportService.ts").getReportsData, queries, materialCalls, ledgerCalls, cutoverCalls };
}

test("Overview/summary use B3 once, make no raw material reads, and keep totalObjectCost app-side", async () => {
  for (const scopes of [["overview"], ["overview", "equipment"]]) {
    const f = reportsFixture();
    const data = await f.get(filters, scopes);
    assert.equal(f.materialCalls.length, 1);
    assert.deepEqual(f.materialCalls[0], filters);
    assert.equal(data.kpis.materialsCost, 7.25);
    assert.equal(data.kpis.totalObjectCost, 20.25);
    assert.equal(f.cutoverCalls.length, 0);
    assert.equal(f.ledgerCalls.length, 0);
    for (const name of ["get_report_material_ledger_cutover", "get_management_materials",
      "get_report_object_material_costs", "warehouse_movements"])
      assert.equal(f.queries.filter((q) => q.name === name).length, 0, name);
  }
  const exportRoute = read("app/reports/export/route.ts");
  assert.match(exportRoute, /case "summary":[\s\S]*?return \[[\s\S]*?"overview"[\s\S]*?"equipment"/);
});

test("Objects/Warehouse/full Excel retain existing material detail paths; compact failures never raw-fallback", async () => {
  for (const scopes of [["objects"], ["warehouse"], undefined]) {
    const f = reportsFixture();
    await f.get(filters, scopes);
    assert.equal(f.materialCalls.length, 0);
    assert.equal(f.cutoverCalls.length, 1);
    assert.equal(f.ledgerCalls.length, 1);
    if (scopes?.[0] === "objects" || scopes === undefined)
      assert.ok(f.queries.some((q) => q.name === "get_management_materials"));
  }
  const excel = read("app/reports/export/excel/route.ts");
  assert.match(excel, /getReportsData\(/);
  assert.doesNotMatch(excel, /\[\s*"overview"\s*\]/);
  const rawMaterialReads = [];
  const emptyQuery = (name) => {
    if (["get_report_material_ledger_cutover", "get_management_materials",
      "get_report_object_material_costs", "warehouse_movements"].includes(name)) rawMaterialReads.push(name);
    const chain = new Proxy({}, { get: (_, method) => method === "then"
      ? (done) => Promise.resolve({ data: [], error: null }).then(done)
      : () => chain });
    return chain;
  };
  const failing = loader({
    "@/lib/supabase/server": { createClient: async () => ({ from: emptyQuery, rpc: emptyQuery }) },
    "@/services/reportMaterialTotalsService": { getReportOverviewMaterialTotals: async () => { throw new Error("SAFE_COMPACT_FAILURE"); } },
    "@/services/reportCurrentFinanceService": { getReportOverviewCurrentFinance: async () => ({ outstanding_receivables: 0, objects_without_client_price: 0, overdue_schedule_amount: 0 }) },
    "@/services/reportPeriodTotalsService": { getReportOverviewPeriodTotals: async () => ({ labor_cost: 0, other_expenses_cost: 0, total_hours: 0, purchased_cost: 0, payments_received: 0 }) },
    "@/services/reportMaterialLedgerService": { getMaterialLedgerCutover: async () => { throw new Error("RAW_FALLBACK"); }, getReportMaterialPeriodMode: () => "legacy", getMaterialLedgerReport: async () => { throw new Error("RAW_FALLBACK"); } },
    "@/services/equipmentService": { getManagementEquipmentServiceRecordsRange: async () => [] },
  });
  await assert.rejects(() => failing("services/reportService.ts").getReportsData(filters, ["overview"]), /SAFE_COMPACT_FAILURE/);
  assert.deepEqual(rawMaterialReads, []);
});

test("SQL signature/DTO/body hash/security and guard-before-domain-read contracts are exact", () => {
  assert.match(pre, /p_date_from date,\s+p_date_to date,\s+p_object_id bigint default null/);
  assert.match(pre, /returns table \(\s+materials_cost numeric,\s+exact_cost numeric,\s+legacy_approximate_cost numeric,\s+period_mode text,\s+cutover_at timestamptz\s+\)/);
  const hash = createHash("md5").update(body).digest("hex");
  for (const sql of [pre, audit]) {
    assert.match(sql, new RegExp(`md5\\(p.prosrc\\)='${hash}'`));
    assert.match(sql, /p\.proargnames=array\['p_date_from','p_date_to','p_object_id','materials_cost'/);
    assert.doesNotMatch(sql, /pronargnames|__B3_BODY_MD5__|andrelkind|endif\b|usingerrcode|with_checkis/);
  }
  assert.match(pre, /stable\s+security definer\s+set search_path = ''\s+set extra_float_digits = 3/);
  assert.match(pre, /owner to postgres/);
  assert.match(pre, /revoke all on function public\.get_report_overview_material_totals\(date,date,bigint\)\s+from public, anon, authenticated, service_role/);
  assert.match(pre, /grant execute on function public\.get_report_overview_material_totals\(date,date,bigint\)\s+to authenticated/);
  assert.doesNotMatch(pre, /with grant option/i);
  assert.ok(body.indexOf("errcode = '42501'") < body.indexOf("from public.objects"));
  assert.doesNotMatch(body.slice(0, body.indexOf("errcode = '42501'")), /public\.(objects|materials|warehouse_movements|warehouse_ledger_cutovers)/);
});

test("SQL cutover/taxonomy/binary64 and preservation/audit contracts stay closed", () => {
  assert.match(body, /where c\.ledger_version = 3/);
  assert.match(body, /v_timestamp_to_exclusive <= v_cutover_at/);
  assert.match(body, /v_timestamp_from >= v_cutover_at/);
  assert.match(body, /wm\.ledger_version = 3\s+and wm\.id > v_boundary_movement_id/);
  assert.match(body, /'issue_to_object','return_from_object','direct_to_object','direct_object_reversal'/);
  assert.match(body, /r\.quantity \* r\.price \* 100::double precision/);
  assert.match(body, /c\.scaled - pg_catalog\.floor\(c\.scaled\) >= 0\.5::double precision/);
  assert.match(body, /sum\(r\.cents order by r\.row_id\)/);
  assert.match(body, /::text::numeric/);
  assert.doesNotMatch(body, /round\(m\.quantity \* m\.price|greatest\(/i);
  const snapshots = [...(pre + audit).matchAll(/-- REPORTS PRESERVATION BEGIN\n([\s\S]*?)\n-- REPORTS PRESERVATION END/g)].map((match) => match[1]);
  assert.equal(snapshots.length, 2);
  assert.equal(new Set(snapshots).size, 1);
  assert.equal((pre.match(/create or replace function/gi) || []).length, 1);
  assert.doesNotMatch(pre, /\b(?:create|alter|drop)\s+(?:table|policy|index)|\b(?:insert into|update public|delete from)\b/i);
  assert.match(audit, /begin;\s+set transaction read only;\s+set local search_path = pg_catalog;/);
  assert.match(audit, /runtime_authorization_tested',false/);
  assert.match(audit, /count\(\*\)=13/);
});

test("reviewed material dependency fingerprints use exact pg_proc source boundaries", () => {
  for (const [file, signature] of [
    ["database/object-3.0-security-pre-deploy.sql", "public.get_management_materials"],
    ["database/reports-3.0.sql", "public.get_report_material_ledger_cutover"],
    ["database/reports-3.0.sql", "public.get_report_object_material_costs"],
  ]) {
    const hash = createHash("md5").update(sourceBody(file, signature)).digest("hex");
    assert.match(pre, new RegExp(hash));
    assert.match(audit, new RegExp(hash));
  }
});
