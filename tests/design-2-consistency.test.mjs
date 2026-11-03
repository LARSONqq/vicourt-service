import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (file) => readFileSync(file, "utf8");
const timeline = "components/activity/ActivityTimelineList.tsx";
const badge = "components/tasks/RecurringTaskBadge.tsx";
const form = "components/equipment/EquipmentWorkSessionForm.tsx";
const list = "components/equipment/EquipmentWorkSessionList.tsx";
const boundaries = ["objects/Object", "equipment/Equipment", "employees/Employee"].map(f => `components/${f}TabErrorBoundary.tsx`);

test("shared surfaces use semantic Light and Dark tokens without fixed palette utilities", () => {
  for (const file of [timeline, badge, form, list, ...boundaries]) {
    assert.doesNotMatch(read(file), /(?:bg|text|border|ring)-(?:white|gray|green|red|blue|teal|amber|cyan|emerald|slate|rose|violet|indigo)(?:-\d+)?\b/);
    assert.doesNotMatch(read(file), /rounded-xl|shadow-lg/);
  }
});
test("timeline preserves presentation and entity gates with wrapping and touch sized focusable links", () => {
  const source = read(timeline);
  assert.match(source, /getActivityPresentation\(/);
  assert.match(source, /new Set\(existingObjectIds\)/);
  assert.match(source, /!presentation.entity\?\.href/);
  assert.match(source, /presentation.details.map/);
  assert.match(source, /overflow-wrap:anywhere/);
  assert.equal((source.match(/focus-visible:ring-ring/g) ?? []).length, 2);
  assert.equal((source.match(/min-h-11/g) ?? []).length, 2);
});
test("recurrence detail wraps without changing labels or interval calculation", () => {
  const source = read(badge);
  assert.match(source, /getTaskRecurrenceLabel\([\s\S]*recurrenceType,[\s\S]*recurrenceInterval/);
  assert.match(source, /vc-status-info min-w-0 max-w-full/);
  assert.match(source, /whitespace-normal break-words/);
  assert.doesNotMatch(source, /truncate|text-\[10px\]/);
});
test("equipment sessions preserve profile permissions and duration snapshots with responsive links", () => {
  const source = read(list);
  for (const gate of ["canViewEmployeeProfiles", "canViewObjectProfiles", "equipment_name_snapshot", "employee_name_snapshot", "object_name_snapshot"]) assert.match(source, new RegExp(gate));
  assert.match(source, /grid-cols-1 gap-3 xl:grid-cols-2/);
  assert.equal((source.match(/focus-visible:ring-ring/g) ?? []).length, 3);
  assert.match(source, /vc-status-success/);
  assert.match(source, /border-dashed bg-muted\/50/);
});
test("session form preserves submission locks and canonical action with semantic feedback", () => {
  const source = read(form);
  for (const contract of ["submissionLock.current", "idempotencyKeyRef.current", "await recordEquipmentWorkSession", "await getEquipmentWorkSessionFormOptions", "parseDuration("]) assert.ok(source.includes(contract));
  assert.match(source, /role="alert"/);
  assert.match(source, /role="status"/);
  assert.match(source, /--vc-danger-bg/);
  assert.match(source, /--vc-success-bg/);
  assert.equal((source.match(/focus-visible:ring-ring/g) ?? []).length, 2);
  assert.match(source, /grid-cols-1 gap-4 sm:grid-cols-2/);
});
test("passport retry states share semantic error colors and accessible touch controls", () => {
  for (const file of boundaries) {
    const source = read(file);
    assert.match(source, /role="alert"/);
    assert.match(source, /window.location.reload\(\)/);
    assert.match(source, /min-h-11/);
    assert.match(source, /focus-visible:ring-ring/);
    assert.match(source, /--vc-danger-text/);
  }
});
