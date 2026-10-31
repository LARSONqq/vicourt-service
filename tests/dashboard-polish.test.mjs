// Focused Dashboard 4.0D4 presentation contracts. No SQL/network/browser execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("management KPI cards use supported finance, task and object destinations", () => {
  const source = read("components/dashboard/DashboardCommandSurface.tsx");
  assert.equal((source.match(/href: "\/reports\?section=cashflow"/g) ?? []).length, 2);
  assert.doesNotMatch(source, /href: "\/reports\?section=overview"/);
  assert.match(source, /href: taskDashboardLinks\.overdue/);
  assert.match(source, /label: "Активні об’єкти"[\s\S]*href: "\/objects"/);
  assert.match(source, /aria-label={`\$\{kpi\.label\}: \$\{kpi\.value\}\. \$\{kpi\.context\}`}/);
});

test("Dashboard actionable surfaces expose keyboard focus and whole-row Link semantics", () => {
  for (const file of [
    "components/dashboard/DashboardCommandSurface.tsx",
    "components/dashboard/DashboardAttention.tsx",
    "components/dashboard/DashboardObjectWatchlist.tsx",
    "components/dashboard/OperationalDashboard.tsx",
    "components/dashboard/DashboardQuickActions.tsx",
    "components/dashboard/TodayTasksSection.tsx",
  ]) assert.match(read(file), /focus-visible:ring-2/);

  const attention = read("components/dashboard/DashboardAttention.tsx");
  assert.match(attention, /<Link href={item\.href}[\s\S]*className="flex min-h-16/);
  const watchlist = read("components/dashboard/DashboardObjectWatchlist.tsx");
  assert.match(watchlist, /<Link href={item\.href} className="block min-h-20/);
  const operational = read("components/dashboard/OperationalDashboard.tsx");
  assert.match(operational, /compactLinkClass = .*focus-visible:ring-2/);
});

test("Today Tasks keeps row actions separate and removes duplicate bottom navigation", () => {
  const source = read("components/dashboard/TodayTasksSection.tsx");
  assert.match(source, /<article[\s\S]*href={`\/tasks\/\$\{task\.id\}`}/);
  assert.match(source, /<RescheduleTaskButton[\s\S]*<button/);
  assert.doesNotMatch(source, /Ще завдань:|href="\/calendar"/);
  assert.match(source, /focus-within:bg-gray-50/);
});

test("empty and recoverable error states stay concise, neutral and Ukrainian", () => {
  const attention = read("components/dashboard/DashboardAttention.tsx");
  const watchlist = read("components/dashboard/DashboardObjectWatchlist.tsx");
  const operational = read("components/dashboard/OperationalDashboard.tsx");
  const command = read("components/dashboard/DashboardCommandSurface.tsx");
  assert.match(attention, /Наразі немає дій, що потребують уваги/);
  assert.match(watchlist, /Наразі немає активних об’єктів, що потребують уваги/);
  assert.match(operational, /Залишки не потребують уваги/);
  assert.match(operational, /Техніка не потребує уваги/);
  assert.match(command, /border bg-gray-50[\s\S]*Профіль не пов’язаний/);
  assert.match(
command,
  /return <section className="rounded-xl border bg-white p-4 sm:p-5">/
);
});
