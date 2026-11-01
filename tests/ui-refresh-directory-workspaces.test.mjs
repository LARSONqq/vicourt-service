// Focused UI Refresh R2B contracts. Static only; no browser, network, service, or SQL execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("Warehouse keeps canonical stock evaluation while distinguishing OUT, LOW, and NORMAL visually", () => {
  const page = read("app/warehouse/page.tsx");
  const navigation = read("components/warehouse/WarehouseDirectoryNavigation.tsx");
  const list = read("components/warehouse/WarehouseList.tsx");
  assert.match(page, /vc-page-title/);
  assert.match(page, /warehouseDirectoryHref\(\{ q: "", category: "", stock: card\.stock \}/);
  assert.match(navigation, /action="\/warehouse" method="get"/);
  assert.match(navigation, /vc-field/);
  assert.match(list, /getWarehouseStockStatus\(item\)/g);
  assert.match(list, /status === "OUT_OF_STOCK"/g);
  assert.match(list, /status !== "NORMAL"/g);
  assert.match(list, /border-amber-300/);
  assert.match(list, /vc-table-shell/);
});

test("Equipment presentation reuses canonical maintenance logic and preserves directory query controls", () => {
  const page = read("app/equipment/page.tsx");
  const navigation = read("components/equipment/EquipmentDirectoryNavigation.tsx");
  const list = read("components/equipment/EquipmentList.tsx");
  assert.match(page, /getEquipmentDirectoryPage\(/);
  assert.match(page, /getEquipmentDirectoryStats\(/);
  assert.match(page, /vc-page-title/);
  assert.match(navigation, /action="\/equipment"[\s\S]*method="get"/);
  assert.match(navigation, /name="status"/);
  assert.match(navigation, /name="category"/);
  assert.match(list, /evaluateEquipmentMaintenance\(/g);
  assert.match(list, /getEquipmentMaintenanceOverallKind\(/g);
  assert.match(list, /vc-table-shell/);
  assert.match(list, /focus-visible:ring-2/);
});

test("Employees preserve permission, query and workload contracts with accessible contact cards", () => {
  const page = read("app/employees/page.tsx");
  const navigation = read("components/employees/EmployeeDirectoryNavigation.tsx");
  const list = read("components/employees/EmployeeList.tsx");
  assert.match(page, /canManageEmployees\(/);
  assert.match(page, /getManagementEmployeesPage\(/);
  assert.match(page, /getEmployeeDirectoryWorkloads\(/);
  assert.match(navigation, /action="\/employees"[\s\S]*method="get"/);
  assert.match(navigation, /name="status"/);
  assert.match(navigation, /name="type"/);
  assert.match(list, /href={`tel:\$\{employee\.phone\}`}/);
  assert.match(list, /href={`mailto:\$\{employee\.email\}`}/);
  assert.match(list, /vc-surface/);
  assert.match(list, /focus-visible:ring-2/);
});

test("R2B directories expose neutral loading and recoverable error states", () => {
  const warehouseLoading = read("app/warehouse/loading.tsx");
  assert.match(warehouseLoading, /role="status"/);
  assert.match(warehouseLoading, /motion-reduce:animate-none/);
  for (const file of ["app/warehouse/error.tsx", "app/equipment/error.tsx", "app/employees/error.tsx"]) {
    const source = read(file);
    assert.match(source, /role="alert"/);
    assert.match(source, /onClick=\{reset\}/);
    assert.match(source, /vc-surface/);
  }
});
