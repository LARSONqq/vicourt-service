// Focused activity responsive-filter presentation contracts. Static only; no network or SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("app/activity/page.tsx", "utf8");

test("activity keeps search visible and progressively discloses secondary filters", () => {
  assert.match(page, /name="q"/);
  assert.match(page, /<details[\s\S]*open=\{hasSecondaryFilters\}/);
  assert.match(page, /Додаткові фільтри/);
  assert.match(page, /filters\.category \|\|[\s\S]*filters\.dateTo/);
});

test("activity preserves all filter names and GET query semantics", () => {
  assert.match(page, /method="get"/);
  for (const name of ["q", "category", "event", "actor", "object_id", "date_from", "date_to"]) {
    assert.match(page, new RegExp(`name="${name}"`));
  }
  assert.match(page, /href="\/activity"/);
});

test("activity groups entries by Kyiv day and keeps change details collapsed", () => {
  const timeline = readFileSync("components/activity/ActivityTimelineList.tsx", "utf8");
  assert.match(timeline, /timeZone: "Europe\/Kyiv"/);
  assert.match(timeline, /groupedLogs\.map\(\(group\)/);
  assert.match(timeline, /before:bg-border/);
  assert.match(timeline, /<details className="group mt-3[\s\S]*presentation\.details\.map/);
  assert.match(timeline, /presentation\.actorName/);
  assert.match(timeline, /presentation\.label/);
});
