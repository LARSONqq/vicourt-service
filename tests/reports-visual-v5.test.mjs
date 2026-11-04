// Focused Visual Simplification V5 presentation contracts. Static only; no SQL/network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dashboard = readFileSync(
  "components/reports/ReportsDashboard.tsx",
  "utf8"
);
const page = readFileSync(
  "app/reports/page.tsx",
  "utf8"
);

test("report overview keeps exact KPIs and a restrained stacked cost composition", () => {
  assert.match(dashboard, /function CostComposition/);
  assert.match(dashboard, /materials=\{[\s\S]*?data\.kpis[\s\S]*?\.materialsCost/);
  assert.match(dashboard, /labor=\{[\s\S]*?data\.kpis\.laborCost/);
  assert.match(dashboard, /other=\{[\s\S]*?data\.kpis[\s\S]*?\.otherExpensesCost/);
  assert.match(dashboard, /formatMoney\([\s\S]*?part\.value/);
  assert.doesNotMatch(dashboard, /(?:Pie|Donut|conic-gradient)/i);
});

test("object finance uses only existing budget and payment denominators", () => {
  assert.match(dashboard, /function ProgressMeter/);
  assert.match(dashboard, /total=\{[\s\S]*?object\.costBudget/);
  assert.match(dashboard, /total=\{[\s\S]*?object\.clientPrice/);
  assert.match(dashboard, /total === null \|\|[\s\S]*?total <= 0/);
  assert.match(dashboard, /Бюджет майже вичерпано/);
  assert.match(dashboard, /Перевищено бюджет/);
  assert.match(dashboard, /object\.budgetOverrun[\s\S]*?object\.budgetRemaining/);
  assert.match(dashboard, /object\.overpayment[\s\S]*?object\.remainingToPay/);
});

test("workforce is ordered by hours and uses comparison bars without utilization", () => {
  assert.match(dashboard, /right\.hours - left\.hours/);
  assert.match(dashboard, /maximumEmployeeHours/);
  assert.match(dashboard, /employee\.objectsCount[\s\S]*?employee\.recordsCount/);
  assert.doesNotMatch(dashboard, /capacity|utilization|завантажен/i);
});

test("expense distribution stays compact while all detailed rows remain available", () => {
  const distribution = dashboard.slice(
    dashboard.indexOf("data.expenseCategories.map"),
    dashboard.indexOf("data.expenseHighlights")
  );
  assert.match(distribution, /category\.share \*[\s\S]*?100/);
  assert.doesNotMatch(distribution, /formatPercent/);
  assert.match(dashboard, /data\.expenseDetails\.map/);
  assert.match(dashboard, /Деталізація інших витрат/);
});

test("report access remains guarded before finance data loading", () => {
  assert.ok(
    page.indexOf('requireSectionAccess(\n    "reports"') <
      page.indexOf("getReportsData(\n      filters")
  );
  assert.match(page, /getReportsData\([\s\S]*?filters,[\s\S]*?\[section\]/);
});
