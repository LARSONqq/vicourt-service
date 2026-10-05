// node --test tests/*.test.mjs — static/scoped Reports checks; no SQL/network/browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

function loadTypeScript(file) {
  const filename = resolve(file);
  const loaded = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(filename, "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;
  const localRequire = (name) => {
    if (name === "@/types/report") {
      return loadTypeScript("types/report.ts");
    }
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function(
    "require",
    "module",
    "exports",
    code
  )(
    localRequire,
    loaded,
    loaded.exports
  );
  return loaded.exports;
}

test("Reports section normalization defaults to overview and accepts only supported sections", () => {
  const {
    normalizeReportsSection,
  } = loadTypeScript(
    "lib/reportSections.ts"
  );

  assert.equal(
    normalizeReportsSection(),
    "overview"
  );
  assert.equal(
    normalizeReportsSection(""),
    "overview"
  );
  assert.equal(
    normalizeReportsSection("invalid"),
    "overview"
  );

  for (const section of [
    "overview",
    "objects",
    "workforce",
    "cashflow",
    "warehouse",
    "equipment",
  ]) {
    assert.equal(
      normalizeReportsSection(
        section
      ),
      section
    );
  }
});

test("section navigation and filter form preserve URL report filters", () => {
  const navigation = readFileSync(
    "components/reports/ReportsSectionNavigation.tsx",
    "utf8"
  );
  const filters = readFileSync(
    "components/reports/ReportsFilters.tsx",
    "utf8"
  );

  assert.match(
    navigation,
    /createReportExportSearchParams\([\s\S]*?filters[\s\S]*?\)/
  );
  assert.match(
    navigation,
    /params\.set\("section", section\)/
  );
  assert.match(
    navigation,
    /aria-current=/
  );
  assert.match(
    filters,
    /type="hidden"[\s\S]*?name="section"[\s\S]*?value=\{section\}/
  );
});

test("page requests only the active section and renders section-specific content", () => {
  const page = readFileSync(
    "app/reports/page.tsx",
    "utf8"
  );
  const dashboard = readFileSync(
    "components/reports/ReportsDashboard.tsx",
    "utf8"
  );

  assert.match(
    page,
    /getReportsData\([\s\S]*?filters,[\s\S]*?\[section\][\s\S]*?\)/
  );
  assert.match(
    page,
    /requireSectionAccess\([\s\S]*?"reports"[\s\S]*?\)/
  );

  for (const section of [
    "overview",
    "objects",
    "workforce",
    "cashflow",
    "warehouse",
    "equipment",
  ]) {
    assert.match(
      dashboard,
      new RegExp(
        `section === "${section}"`
      )
    );
  }
});

test("scoped loaders gate full-history and domain queries", () => {
  const service = readFileSync(
    "services/reportService.ts",
    "utf8"
  );

  for (const guard of [
    "needsWorkLogs",
    "needsMaterialCosts",
    "needsExpenses",
    "needsPayments",
    "needsPaymentSchedule",
    "needsPeriodPurchases",
    "needsWarehouse",
    "needsEquipment",
  ]) {
    assert.match(
      service,
      new RegExp(guard)
    );
  }

  assert.match(
    service,
    /needsObjects &&[\s\S]*?reportObjectIds\.length > 0[\s\S]*?loadLifetimeWorkLogs/
  );
  assert.match(
    service,
    /needsEquipment[\s\S]*?loadEquipmentServiceRecords\(\)/
  );
  assert.match(
    service,
    /needsWarehouse[\s\S]*?loadWarehousePlanningPurchases\(\)/
  );
});

test("period CSV dispatch includes summary and maps each export to a scoped loader", () => {
  const route = readFileSync(
    "app/reports/export/route.ts",
    "utf8"
  );

  assert.match(
    route,
    /function getPeriodExportScopes/
  );
  assert.match(
    route,
    /case "summary":[\s\S]*?"overview"[\s\S]*?"equipment"/
  );
  assert.match(
    route,
    /case "object-costs":[\s\S]*?return \["objects"\]/
  );
  assert.match(
    route,
    /case "employee-work":[\s\S]*?return \["workforce"\]/
  );
  assert.match(
    route,
    /case "warehouse-movements":[\s\S]*?return \["warehouse"\]/
  );
  assert.match(
    route,
    /getReportsData\([\s\S]*?filters,[\s\S]*?getPeriodExportScopes/
  );
  assert.match(
    route,
    /const result = \[[\s\S]*?"summary"[\s\S]*?\]\.includes\(type\)[\s\S]*?getPeriodCsv/
  );
});

test("worker guards precede CSV/Excel report loading and Excel keeps the full management flow", () => {
  const csv = readFileSync(
    "app/reports/export/route.ts",
    "utf8"
  );
  const excel = readFileSync(
    "app/reports/export/excel/route.ts",
    "utf8"
  );
  const csvGet = csv.slice(
    csv.indexOf("export async function GET")
  );
  const excelGet = excel.slice(
    excel.indexOf("export async function GET")
  );

  assert.ok(
    csvGet.indexOf("canViewReports") <
      csvGet.indexOf("getPeriodCsv")
  );
  assert.ok(
    excelGet.indexOf("canViewReports") <
      excelGet.indexOf("getReportsData")
  );
  assert.match(
    excelGet,
    /getReportsData\([\s\S]*?filters[\s\S]*?\)/
  );
  assert.doesNotMatch(
    excelGet,
    /getPeriodExportScopes/
  );
});
