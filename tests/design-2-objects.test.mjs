// Focused Design 2.0 Phase 2A presentation contracts. Static only; no network or SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("Objects list uses semantic Design 2 controls, statuses and navigation", () => {
  const page = read("app/objects/page.tsx");
  const list = read("components/objects/ObjectsList.tsx");
  assert.match(page, /bg-primary[\s\S]*href="\/objects\/new"|href="\/objects\/new"[\s\S]*bg-primary/);
  assert.match(list, /vc-field/);
  assert.match(list, /vc-status-(?:info|success|warning|neutral)/);
  assert.match(list, /hover:bg-muted\/35/);
  assert.match(list, /focus-visible:ring-ring/);
  assert.doesNotMatch(list, /hover:bg-gray-50|text-gray-950/);
});

test("Object passport and bounded sections share semantic surfaces without changing contracts", () => {
  const page = read("app/objects/[id]/page.tsx");
  const tabs = read("components/ObjectTabs.tsx");
  const header = read("components/objects/ObjectInfo.tsx");
  assert.match(page, /getManagementObject\(/);
  assert.match(page, /getObject\(objectId\)/);
  assert.match(tabs, /bg-primary text-primary-foreground/);
  assert.match(tabs, /hover:bg-muted hover:text-foreground/);
  assert.match(header, /vc-object-panel vc-surface/);
  assert.match(header, /bg-muted\/35/);
  for (const file of [
    "components/objects/ObjectTasks.tsx",
    "components/objects/ObjectWorkLogs.tsx",
    "components/objects/ObjectMaterials.tsx",
    "components/objects/ObjectExpenses.tsx",
    "components/objects/ObjectDocuments.tsx",
    "components/objects/ObjectPayments.tsx",
    "components/objects/ObjectPaymentSchedule.tsx",
    "components/objects/ObjectSummary.tsx",
  ]) assert.match(read(file), /vc-object-panel/);
});

test("Object forms preserve payloads while using shared fields and semantic actions", () => {
  const create = read("app/objects/new/page.tsx");
  for (const name of ["name", "customer", "phone", "address", "responsible_employee_id", "cost_budget", "client_price"]) {
    assert.match(create, new RegExp(`name="${name}"`));
  }
  assert.match(create, /action=\{createObject\}/);
  assert.match(create, /bg-primary/);
  assert.match(create, /bg-muted\/40/);
  assert.match(read("components/objects/ObjectInfo.tsx"), /action=\{handleSubmit\}/);
});

test("Phase 2A dark compatibility is scoped away from ObjectPhotos", () => {
  const globals = read("app/globals.css");
  const photos = read("components/objects/ObjectPhotos.tsx");
  assert.match(globals, /\.dark \.vc-object-panel/);
  assert.doesNotMatch(photos, /vc-object-panel/);
});
