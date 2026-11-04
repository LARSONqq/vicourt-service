// Focused Design 2.0 Phase 2B presentation contracts. Static only; no network or SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("Tasks workspace uses semantic navigation without changing query contracts", () => {
  const page = read("app/tasks/page.tsx");
  const shell = read("components/tasks/TaskWorkspaceShell.tsx");
  const results = read("components/tasks/TaskWorkspaceResults.tsx");
  const navigation = read("components/tasks/TaskWorkspaceNavigation.tsx");
  assert.match(page, /normalizeTaskWorkspace\(query\)/);
  assert.match(results, /taskWorkspaceHref\(filters, result\.page\)/);
  assert.match(shell, /window\.history\.pushState/);
  assert.doesNotMatch(navigation, /next\/link|router\.(push|replace)/);
  assert.match(navigation, /onViewChange\(view as TaskView\)/);
  assert.match(navigation, /aria-current=\{filters\.view === view \? "page" : undefined\}/);
  assert.match(navigation, /border-primary bg-primary text-primary-foreground/);
  assert.match(navigation, /vc-field/);
});

test("Task cards and edit surfaces are Dark-compatible while behavior remains intact", () => {
  const list = read("components/tasks/TasksList.tsx");
  assert.match(list, /vc-task-panel min-w-0 space-y-5/);
  assert.match(list, /vc-task-panel min-w-0 rounded-lg border border-l-4/);
  assert.match(list, /taskDetailHref\(task\.id, workspaceReturnTo\)/);
  assert.match(list, /updateTaskStatus\(/);
  assert.match(list, /CompleteTaskButton/);
  assert.match(list, /RescheduleTaskButton/);
});

test("Task detail keeps capabilities and targets with semantic surfaces", () => {
  const detail = read("app/tasks/[id]/page.tsx");
  const actions = read("components/tasks/TaskDetailActions.tsx");
  assert.match(detail, /taskDetailCapabilities\(task, profile\.role\)/);
  assert.match(detail, /getTaskTarget\(task\)/);
  assert.match(detail, /vc-task-panel/);
  assert.match(detail, /vc-status-danger/);
  assert.match(actions, /vc-task-panel vc-surface/);
});

test("Template routes share the task presentation foundation", () => {
  for (const file of ["app/tasks/templates/page.tsx", "app/tasks/templates/[id]/page.tsx", "app/tasks/templates/new/page.tsx"]) {
    assert.match(read(file), /vc-task-panel/);
  }
  assert.match(read("app/tasks/templates/page.tsx"), /getTaskTemplatesPage\(await searchParams\)/);
  assert.match(read("components/tasks/TaskTemplatesPanel.tsx"), /vc-task-panel vc-surface/);
});

test("Task Dark compatibility is scoped to task presentation", () => {
  const globals = read("app/globals.css");
  assert.match(globals, /\.dark \.vc-task-panel/);
  assert.match(globals, /--vc-text-muted/);
  assert.match(globals, /--vc-warning-bg/);
  assert.match(globals, /--vc-danger-bg/);
});
