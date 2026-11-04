// Focused UI Refresh R3A presentation contracts. No browser, network, service, or SQL execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("object passport keeps role-gated tabs and loaders while adopting the R1 shell", () => {
  const page = read("app/objects/[id]/page.tsx");
  const tabs = read("components/ObjectTabs.tsx");
  const header = read("components/objects/ObjectInfo.tsx");

  assert.match(page, /canViewFinance=\{\s*canViewFinance\s*\}/);
  assert.match(page, /activeTab === "finance" &&\s*canManageObject/);
  assert.match(page, /getManagementObject\(/);
  assert.match(page, /getObject\(objectId\)/);
  assert.match(page, /vc-surface h-28/);
  assert.match(tabs, /item\.id !== "finance" \|\|\s*canViewFinance/);
  assert.match(tabs, /item\.id !== "history" \|\|\s*canViewHistory/);
  assert.match(tabs, /href=\{`\/objects\/\$\{objectId\}\?tab=\$\{item\.id\}`\}/);
  assert.match(tabs, /aria-current=/);
  assert.match(tabs, /focus-visible:ring-2/);
  assert.match(tabs, /overflow-x-auto overscroll-x-contain/);
  assert.match(tabs, /w-max min-w-full/);
  assert.match(tabs, /Розділи можна гортати горизонтально/);
  assert.match(header, /vc-page-title/);
  assert.match(header, /vc-surface/);
});

test("object sections use bounded responsive surfaces without changing actions", () => {
  const cases = [
    ["components/objects/ObjectTasks.tsx", /deleteObjectTask/, /AddTaskForm/],
    ["components/objects/ObjectWorkLogs.tsx", /AddWorkLogForm/, /totalCount/],
    ["components/objects/ObjectMaterials.tsx", /deleteMaterial/, /AddMaterialForm/],
    ["components/objects/ObjectExpenses.tsx", /deleteObjectExpense/, /AddObjectExpenseForm/],
    ["components/objects/ObjectDocuments.tsx", /createObjectDocumentSignedUrl/, /ObjectDocumentForm/],
  ];

  for (const [file, actionContract, formContract] of cases) {
    const source = read(file);
    assert.match(source, /vc-surface/);
    assert.match(source, /min-w-0/);
    assert.match(source, actionContract);
    assert.match(source, formContract);
  }
});

test("management finance remains isolated and uses polished finance surfaces", () => {
  const page = read("app/objects/[id]/page.tsx");
  const summary = read("components/objects/ObjectSummary.tsx");
  const payments = read("components/objects/ObjectPayments.tsx");
  const schedule = read("components/objects/ObjectPaymentSchedule.tsx");

  assert.match(page, /activeTab === "finance" &&\s*canManageObject/);
  assert.match(page, /<ObjectSummary\s+finance=\{finance\}/);
  assert.match(summary, /calculateObjectFinancials/);
  assert.match(summary, /vc-surface/);
  assert.match(payments, /vc-surface/);
  assert.match(schedule, /calculateObjectPaymentSchedule/);
  assert.match(schedule, /id="payment-schedule"/);
  assert.match(schedule, /vc-surface/);
});

test("object create and edit forms retain payload names and gain shared fields", () => {
  const createPage = read("app/objects/new/page.tsx");
  const editForm = read("components/objects/ObjectInfo.tsx");
  const forms = [
    "components/objects/AddTaskForm.tsx",
    "components/objects/AddWorkLogForm.tsx",
    "components/objects/AddMaterialForm.tsx",
    "components/objects/AddObjectExpenseForm.tsx",
    "components/objects/ObjectDocumentForm.tsx",
    "components/objects/ObjectPaymentForm.tsx",
    "components/objects/ObjectPaymentScheduleForm.tsx",
  ].map(read);

  for (const name of ["name", "customer", "phone", "address", "responsible_employee_id", "cost_budget", "client_price"]) {
    assert.match(createPage, new RegExp(`name="${name}"`));
  }
  assert.match(createPage, /action=\{createObject\}/);
  assert.match(editForm, /action=\{handleSubmit\}/);
  assert.match(editForm, /name="object_id"/);
  assert.match(editForm, /updateObject\(/);
  assert.ok(forms.every((source) => source.includes("vc-field")));
});

test("photos stay delegated to the existing isolated component", () => {
  const page = read("app/objects/[id]/page.tsx");
  assert.match(page, /activeTab === "photos"/);
  assert.match(page, /<ObjectPhotos/);
  assert.match(page, /getObjectPhotosPage\(/);
});
