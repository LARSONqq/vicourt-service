// node --test tests/*.test.mjs — mocked catalog/query boundaries, no network/SQL.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
const require = createRequire(import.meta.url);

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) {
        const base = resolve(name.slice(2));
        return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
      }
      return require(name);
    };
    new Function("require", "module", "exports", code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}

const today = "2026-09-19";
const rows = [
  [1, "Заплановано", today, 7], [2, "В роботі", "2026-09-18", 7],
  [3, "Виконано", today, 7], [4, "Заплановано", "2026-09-20", 8],
  [5, "Заплановано", null, null], [6, "В роботі", today, 8],
  [7, "Виконано", "2026-09-17", 8], [8, "Виконано", "2026-09-20", 7],
].map(([id, status, due_date, assigned_employee_id]) => ({ id, status, due_date, assigned_employee_id }));

function fixture(role = "worker", employeeId = 7) {
  const requests = [];
  let clients = 0;
  let fail = false;
  const client = { from(table) {
    const request = { table, filters: [], select: null, options: null, range: null };
    requests.push(request);
    const query = {
      select(columns, options) { request.select = columns; request.options = options; return query; },
      eq(column, value) { request.filters.push((row) => row[column] === value); return query; },
      neq(column, value) { request.filters.push((row) => row[column] !== null && row[column] !== value); return query; },
      lt(column, value) { request.filters.push((row) => row[column] !== null && row[column] < value); return query; },
      gt(column, value) { request.filters.push((row) => row[column] !== null && row[column] > value); return query; },
      is(column, value) { return query.eq(column, value); },
      not(column, operator, value) { assert.equal(operator, "is"); return query.neq(column, value); },
      order() { return query; },
      range(from, to) { request.range = [from, to]; return query; },
      overrideTypes() { return query; },
      then(done, reject) {
        let data = rows.filter((row) => request.filters.every((filter) => filter(row)));
        const count = data.length;
        if (request.range) data = data.slice(request.range[0], request.range[1] + 1);
        return Promise.resolve({ data: request.options?.head ? null : data, count: request.options?.count ? count : null, error: fail ? { message: "internal database detail" } : null }).then(done, reject);
      },
    };
    return query;
  } };
  const load = loader({
    "@/lib/supabase/server": { createClient: async () => { clients++; return client; } },
    "@/services/profileService": { getCurrentUserProfile: async () => role ? { id: "auth-uuid-not-employee-id", role, employee_id: employeeId } : null },
    "@/lib/kyivDate": { getKyivDateValue: () => today },
  });
  return { load, requests, clients: () => clients, fail: () => { fail = true; }, service: load("services/taskWorkspaceService.ts") };
}

test("today / overdue / upcoming exclude completed and undated tasks consistently", async () => {
  const { normalizeTaskWorkspace } = loader()("lib/taskWorkspace.ts");
  for (const [view, expected] of [["today", [1, 6]], ["overdue", [2]], ["upcoming", [4]]]) {
    const { service, requests } = fixture();
    const page = await service.getTaskWorkspacePage(normalizeTaskWorkspace({ view }).filters, 1, 7, today);
    assert.deepEqual(page.tasks.map((row) => row.id), expected);
    assert.deepEqual(page.counts, { my: 4, all: 8, today: 2, overdue: 1, upcoming: 1, completed: 3 });
    assert.equal(requests.filter((request) => request.options?.head).length, 6);
    const dataQuery = requests.find((request) => !request.options?.head);
    assert.equal(dataQuery.options, undefined); // no redundant exact count on range read
    assert.deepEqual(dataQuery.range, [0, 19]);
  }
});

test("filtered workspace counts remain exact; invalid/over-max pages stay safe", async () => {
  const { normalizeTaskWorkspace } = loader()("lib/taskWorkspace.ts");
  const { service, requests } = fixture();
  const filters = normalizeTaskWorkspace({ view: "all", status: "Виконано" }).filters;
  const page = await service.getTaskWorkspacePage(filters, 99999, 7, today);
  assert.equal(page.total, 3); assert.equal(page.page, 1);
  assert.equal(page.counts.all, 8);
  assert.equal(requests.filter((request) => request.options?.head).length, 7);
});

test("Dashboard counts use authenticated employee mapping, never auth UUID/name; payload is counts only", async () => {
  for (const role of ["admin", "object_manager", "worker"]) {
    const { service, requests } = fixture(role);
    assert.deepEqual(await service.getTaskDashboardSummary(), { businessDate: today, hasEmployeeLink: true, today: 2, overdue: 1, myOpen: 2, open: 5 });
    assert.equal(requests.length, 4);
    for (const request of requests) {
      assert.equal(request.table, "object_tasks");
      assert.equal(request.select, "id");
      assert.deepEqual(request.options, { count: "exact", head: true });
    }
  }
});

test("unlinked profiles get zero My Tasks and no guessed identity; unauthenticated callers perform no summary query", async () => {
  const unlinked = fixture("worker", null);
  const summary = await unlinked.service.getTaskDashboardSummary();
  assert.equal(summary.myOpen, 0); assert.equal(summary.hasEmployeeLink, false);
  assert.equal(unlinked.requests.length, 3);
  const { normalizeTaskWorkspace } = loader()("lib/taskWorkspace.ts");
  const page = await unlinked.service.getTaskWorkspacePage(normalizeTaskWorkspace({ view: "my" }).filters, 1, null, today);
  assert.equal(page.total, 0); assert.deepEqual(page.tasks, []);
  const denied = fixture(null);
  await assert.rejects(() => denied.service.getTaskDashboardSummary());
  assert.equal(denied.clients(), 0);
});

test("worker cannot query management templates; dashboard does not invoke template/selector services", async () => {
  const worker = fixture();
  const templates = worker.load("services/taskTemplateWorkspaceService.ts");
  await assert.rejects(() => templates.getTaskTemplateSummaries([1]));
  await assert.rejects(() => templates.getTaskTemplatesPage({}));
  assert.equal(worker.clients(), 0);
  await worker.service.getTaskDashboardSummary();
  assert.ok(worker.requests.every((query) => query.table === "object_tasks"));
  const workspace = readFileSync("app/tasks/page.tsx", "utf8");
  assert.match(workspace, /const templates = recurrence \? await getTaskTemplateSummaries/);
});

test("summary failure is not converted to misleading zero counts or leaked database errors", async () => {
  const current = fixture(); current.fail();
  await assert.rejects(() => current.service.getTaskDashboardSummary(), { message: "Не вдалося завантажити підсумок завдань." });
});

test("Kyiv date boundary, canonical overdue presentation, terminology and returnTo safety", () => {
  const load = loader();
  const { getKyivDateValue } = load("lib/kyivDate.ts");
  assert.equal(getKyivDateValue(new Date("2026-09-18T22:00:00Z")), today);
  const { isTaskOverdue } = load("lib/taskPresentation.ts");
  for (const row of rows) assert.equal(isTaskOverdue(row, today), row.id === 2);
  const { recurringTaskCopy, templateStateLabel } = load("lib/taskTemplateWorkspace.ts");
  assert.equal(recurringTaskCopy.title, "Повторювані задачі");
  assert.equal(templateStateLabel({ is_active: false, object_id: 1, equipment_id: null, source_template_id: null }), "Зупинена серія");
  const { getTaskRecurrenceLabel } = load("lib/taskRecurrence.ts");
  assert.equal(getTaskRecurrenceLabel("custom", 14), "Кожні 14 днів");
  const { safeTaskReturnTo } = load("lib/taskDetail.ts");
  for (const url of ["https://evil.invalid", "//evil.invalid", "/tasks/1", "/tasks\\evil", "/tasks\n"]) assert.equal(safeTaskReturnTo(url), "/tasks");
  assert.equal(safeTaskReturnTo("/tasks?view=my&page=2"), "/tasks?view=my&page=2");
});
