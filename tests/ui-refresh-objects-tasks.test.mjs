// Focused UI Refresh R2A presentation contracts. No browser, network, service, or SQL execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("Objects workspace uses the R1 foundation with accessible filters and unchanged destinations", () => {
  const page = read("app/objects/page.tsx");
  const list = read("components/objects/ObjectsList.tsx");
  assert.match(page, /href="\/objects\/new"/);
  assert.match(page, /vc-page-title/);
  assert.match(list, /aria-label="Пошук об’єкта"/);
  assert.match(list, /aria-label="Фільтр за статусом"/);
  assert.match(list, /aria-pressed=\{isActive\}/);
  assert.match(list, /statusFilterLabels/);
  assert.match(list, /Обслуговування/);
  assert.match(list, /Нагляд/);
  assert.match(list, /Завершені/);
  assert.match(list, /Пауза/);
  assert.doesNotMatch(list, /<select/);
  assert.doesNotMatch(list, /style=\{\{ width:/);
  assert.match(list, /href={`\/objects\/\$\{object\.id\}`}/);
  assert.match(list, /vc-surface group block/);
  assert.match(list, /focus-visible:ring-2/);
  assert.match(list, /object\.phone/);
});

test("Tasks workspace preserves query controls while applying consistent fields and navigation focus", () => {
  const page = read("app/tasks/page.tsx");
  const navigation = read("components/tasks/TaskWorkspaceNavigation.tsx");
  assert.match(page, /normalizeTaskWorkspace\(await searchParams\)/);
  assert.match(page, /taskWorkspaceHref\(filters, result\.page\)/);
  assert.match(navigation, /action="\/tasks" method="get"/);
  assert.match(navigation, /<input type="hidden" name="view" value=\{filters\.view\}/);
  assert.match(navigation, /vc-field/);
  assert.match(navigation, /aria-current=\{filters\.view === view \? "page" : undefined\}/);
  assert.match(navigation, /focus-visible:ring-2/);
});

test("Tasks cards distinguish overdue and today without changing completion actions or detail routes", () => {
  const list = read("components/tasks/TasksList.tsx");
  assert.match(list, /const dueToday =\s*task\.status !== "Виконано" &&\s*task\.due_date === today/g);
  assert.match(list, /Термін сьогодні/);
  assert.match(list, /taskDetailHref\(task\.id, workspaceReturnTo\)/);
  assert.match(list, /updateTaskStatus\(/);
  assert.match(list, /CompleteTaskButton/);
  assert.match(list, /RescheduleTaskButton/);
  assert.match(list, /focus-visible:ring-2/);
});

test("Objects and Tasks expose neutral loading and recoverable error surfaces", () => {
  for (const file of ["app/objects/loading.tsx", "app/tasks/loading.tsx"]) {
    const source = read(file);
    assert.match(source, /role="status"/);
    assert.match(source, /motion-reduce:animate-none/);
  }
  for (const file of ["app/objects/error.tsx", "app/tasks/error.tsx"]) {
    const source = read(file);
    assert.match(source, /role="alert"/);
    assert.match(source, /onClick=\{reset\}/);
    assert.match(source, /vc-surface/);
  }
});
