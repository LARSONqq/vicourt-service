import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = file => readFileSync(file, "utf8");
const tasks = read("components/tasks/TasksList.tsx");
const calendar = read("components/calendar/WeeklyTaskCalendar.tsx");

test("Tasks compact, expanded and Calendar cards share an opaque semantic completed surface", () => {
  assert.equal((tasks.match(/\? "vc-task-completed"/g) ?? []).length, 2);
  assert.match(calendar, /isCompleted\s*\? "vc-task-completed"/);
  for (const source of [tasks, calendar]) {
    assert.doesNotMatch(source, /(?:completed|isCompleted)\s*\? "[^"]*opacity-/);
    assert.match(source, /text-foreground line-through decoration-muted-foreground\/60/);
    assert.match(source, /\? "vc-status-neutral"/);
    assert.match(source, /\? "text-muted-foreground"/);
  }
  const css = read("app/globals.css");
  const surface = css.match(/\.vc-task-panel\.vc-task-completed\s*\{([^}]+)\}/)?.[1];
  assert.ok(surface);
  for (const token of ["--vc-elevated", "--vc-border", "--vc-text"]) assert.ok(surface.includes(token));
  assert.doesNotMatch(surface, /opacity/);
});
test("Calendar joins existing nested Dark task compatibility and keeps completed controls readable", () => {
  assert.match(calendar, /className={`vc-task-panel min-w-0 cursor-pointer/);
  assert.match(calendar, /border-border bg-card text-foreground hover:bg-muted/);
  assert.match(calendar, /case "Виконано":\s*return "vc-status-success"/);
  assert.match(read("lib/taskPresentation.ts"), /case COMPLETED_TASK_STATUS: return "vc-status-success"/);
  assert.match(read("app/globals.css"), /\.dark \.vc-task-panel/);
});
test("drag feedback and canonical completion, recurring and target flows remain wired", () => {
  for (const source of [tasks, calendar]) {
    assert.match(source, /scale-95 opacity-30/);
    assert.match(source, /updateTaskStatus/);
    assert.match(source, /RecurringTaskBadge/);
    assert.match(source, /getTaskTarget\(task\)/);
  }
  assert.match(tasks, /CompleteTaskButton/);
  assert.match(calendar, /onDragStart=\{/);
  assert.match(calendar, /onQuickStatus/);
});
