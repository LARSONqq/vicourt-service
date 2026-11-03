import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
const read = (file) => readFileSync(file, "utf8");

test("Employees presentation uses semantic colors throughout bounded routes and components", () => {
  const files = readdirSync("components/employees").filter(f => f.endsWith(".tsx")).map(f => `components/employees/${f}`);
  files.push("app/employees/page.tsx", "app/employees/[id]/page.tsx", "app/employees/error.tsx");
  for (const file of files) assert.doesNotMatch(read(file), /(?:text|bg|border|ring)-(?:gray|green|blue|red|orange|purple|amber)-\d/);
});
test("directory preserves permission, paginated loading and workload contracts", () => {
  const page = read("app/employees/page.tsx");
  for (const call of ["requireSectionAccess", "canManageEmployees", "getManagementEmployeesPage", "getManagementEmployeeDirectoryStats", "getEmployeeDirectoryWorkloads"]) assert.match(page, new RegExp(`${call}\\(`));
  assert.match(page, /fallback=\{<DirectoryLoading \/>\}/);
  const nav = read("components/employees/EmployeeDirectoryNavigation.tsx");
  assert.match(nav, /action="\/employees"[\s\S]*method="get"/);
  for (const key of ["q", "status", "type", "page"]) assert.match(nav, new RegExp(`"${key}"`));
  assert.match(nav, /vc-field/);
});
test("employee identity, contact actions and workload remain readable on mobile", () => {
  const list = read("components/employees/EmployeeList.tsx");
  assert.match(list, /href={`tel:\$\{employee.phone\}`}/);
  assert.match(list, /href={`mailto:\$\{employee.email\}`}/);
  for (const key of ["activeTasks", "objects", "equipment"]) assert.match(list, new RegExp(`workload\\.${key}`));
  assert.match(list, /grid-cols-1/);
  assert.match(list, /tabular-nums/);
  assert.match(list, /vc-status-success/);
  assert.doesNotMatch(list, /hover:shadow-md|👤/);
});
test("forms retain employee payloads and canonical actions with shared fields", () => {
  for (const [file, action] of [["AddEmployeeForm", "createEmployee"], ["EditEmployeeForm", "updateEmployee"]]) {
    const source = read(`components/employees/${file}.tsx`);
    assert.match(source, new RegExp(`await ${action}\\(`));
    for (const key of ["first_name", "last_name", "phone", "email", "position", "employment_type", "status", "hire_date", "hourly_rate", "notes"]) assert.match(source, new RegExp(`name="${key}"`));
    assert.match(source, /vc-field/);
    assert.match(source, /disabled=\{/);
  }
});
test("passport keeps lazy sections, rate privacy and URL pagination", () => {
  const route = read("app/employees/[id]/page.tsx");
  assert.match(route, /const hourlyRate = isAdmin/);
  assert.match(route, /hideEmployeeRatesFromActivityLog/);
  assert.match(route, /<Suspense/);
  assert.match(route, /<EmployeeTabErrorBoundary/);
  const nav = read("components/employees/EmployeePassportNavigation.tsx");
  for (const key of ["workPage", "changesPage", "actionsPage"]) assert.match(nav, new RegExp(`"${key}"`));
  assert.match(nav, /aria-current=/);
  assert.match(nav, /overflow-x-auto/);
  assert.match(nav, /bg-primary text-primary-foreground/);
});
test("empty and error states use the shared semantic foundation", () => {
  assert.match(read("components/employees/EmployeePassport.tsx"), /Завдань немає/);
  assert.match(read("components/employees/EmployeeTabErrorBoundary.tsx"), /role="alert"/);
  assert.match(read("app/employees/error.tsx"), /onClick=\{reset\}/);
  assert.match(read("app/employees/error.tsx"), /bg-primary/);
});
