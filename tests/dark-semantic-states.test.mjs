// Focused shared Dark-mode semantic state contracts. Static only; no network or SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("shared semantic state tokens provide restrained Light and Dark presentations", () => {
  const globals = read("app/globals.css");

  for (const token of [
    "--vc-success-border",
    "--vc-warning-border",
    "--vc-danger-border",
    "--vc-info-border",
    "--vc-selected-bg",
    "--vc-selected-text",
    "--vc-selected-border",
    "--vc-check",
  ]) {
    assert.equal((globals.match(new RegExp(token, "g")) ?? []).length >= 2, true);
  }

  for (const presentation of [
    ".vc-state-selected",
    ".vc-state-today",
    ".vc-tab-active",
    ".vc-control-checked",
    ".vc-checkbox",
    ".vc-alert-success",
    ".vc-alert-warning",
    ".vc-alert-danger",
    ".vc-alert-info",
  ]) {
    assert.ok(globals.includes(presentation));
  }

  assert.match(globals, /\.dark[\s\S]*--vc-success-bg: oklch\(0\.255/);
  assert.match(globals, /\.dark[\s\S]*--vc-selected-bg: oklch\(0\.265/);
});

test("legacy semantic utilities are normalized only inside Dark internal workspaces", () => {
  const globals = read("app/globals.css");
  const scopedRules = globals.slice(globals.indexOf("@layer utilities"));

  assert.match(scopedRules, /\.dark \.vc-app-shell/);
  assert.match(scopedRules, /\.bg-green-50[\s\S]*--vc-success-bg/);
  assert.match(scopedRules, /\.bg-amber-50[\s\S]*--vc-warning-bg/);
  assert.match(scopedRules, /\.bg-red-50[\s\S]*--vc-danger-bg/);
  assert.match(scopedRules, /\.bg-blue-50[\s\S]*--vc-info-bg/);
  assert.match(scopedRules, /\.bg-green-600[\s\S]*--vc-selected-bg/);
  assert.match(scopedRules, /\.accent-green-600[\s\S]*--vc-check/);
});

test("affected workspaces use shared selected, alert, status, and checked presentations", () => {
  const calendar = read("components/calendar/WeeklyTaskCalendar.tsx");
  const notifications = read("app/notifications/page.tsx");
  const reportTabs = read("components/reports/ReportsSectionNavigation.tsx");
  const reportPage = read("app/reports/page.tsx");
  const equipment = read("components/equipment/EquipmentOverview.tsx");
  const checklist = read("components/tasks/TaskChecklist.tsx");

  assert.match(calendar, /vc-state-today/);
  assert.match(calendar, /vc-state-selected/);
  assert.match(calendar, /vc-control-checked/);
  assert.match(notifications, /vc-tab-active/);
  assert.match(notifications, /vc-alert-danger/);
  assert.match(notifications, /vc-alert-warning/);
  assert.match(notifications, /vc-alert-info/);
  assert.match(reportTabs, /vc-tab-active/);
  assert.match(reportPage, /vc-alert-warning/);
  assert.match(equipment, /vc-alert-success/);
  assert.match(equipment, /vc-alert-danger/);
  assert.match(checklist, /vc-control-checked/);
});

test("native checkboxes in affected settings and reports use the shared accent", () => {
  for (const file of [
    "components/notifications/AutomaticPushSettings.tsx",
    "components/reports/EmployeeWorkReport.tsx",
    "components/tasks/TaskTemplatesPanel.tsx",
  ]) {
    assert.match(read(file), /vc-checkbox/);
  }
});
