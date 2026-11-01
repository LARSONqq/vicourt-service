// Focused UI Refresh R4 presentation contracts. No browser, network, service, action, or SQL execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("detail tab bars scroll safely and keep touch-sized keyboard-accessible links", () => {
  for (const file of [
    "components/ObjectTabs.tsx",
    "components/equipment/EquipmentPassportSections.tsx",
    "components/employees/EmployeePassportNavigation.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /overflow-x-auto overscroll-x-contain/);
    assert.match(source, /min-h-11 shrink-0/);
    assert.match(source, /focus-visible:ring-2/);
    assert.match(source, /aria-current=/);
  }
});

test("wide internal tables retain data in contained horizontal scrollers", () => {
  for (const file of [
    "components/warehouse/WarehouseList.tsx",
    "components/equipment/EquipmentList.tsx",
    "components/objects/ObjectDocuments.tsx",
    "components/objects/ObjectPaymentSchedule.tsx",
    "components/equipment/EquipmentServiceHistory.tsx",
    "components/equipment/EquipmentUsagePanel.tsx",
  ]) {
    assert.match(read(file), /overflow-x-auto overscroll-x-contain/);
  }
});

test("employee and equipment pagination controls remain canonical and touch sized", () => {
  const employees = read("components/employees/EmployeePassportNavigation.tsx");
  const equipment = read("components/equipment/EquipmentTabPagination.tsx");
  assert.match(employees, /return `\/employees\/\$\{employeeId\}\?\$\{params\.toString\(\)\}`/);
  assert.match(equipment, /return `\/equipment\/\$\{equipmentId\}\?\$\{params\.toString\(\)\}`/);
  for (const source of [employees, equipment]) {
    assert.match(source, /min-h-11/);
    assert.match(source, /focus-visible:ring-2/);
  }
});

test("role and finance visibility gates remain in server detail workspaces", () => {
  const objects = read("app/objects/[id]/page.tsx");
  const equipment = read("app/equipment/[id]/page.tsx");
  const employees = read("app/employees/[id]/page.tsx");
  assert.match(objects, /activeTab === "finance" &&\s*canManageObject/);
  assert.match(equipment, /canViewServiceCost\s*\? getEquipmentServiceCostKpis/);
  assert.match(equipment, /canManageEquipment\(/);
  assert.match(employees, /canManageEmployees\(/);
  assert.match(employees, /hourlyRate=\{hourlyRate\}/);
});
