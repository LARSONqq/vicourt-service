// Focused UI Refresh R1 contracts. Static only; no browser, network, or SQL execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("visual foundation exposes restrained reusable surface, field, status, and type treatments", () => {
  const globals = read("app/globals.css");
  for (const className of [
    "vc-surface", "vc-page-title", "vc-section-title", "vc-muted", "vc-field",
    "vc-table-shell", "vc-status-neutral", "vc-status-success", "vc-status-warning", "vc-status-danger",
  ]) assert.match(globals, new RegExp(`\\.${className}\\s*\\{`));
  assert.doesNotMatch(globals, /backdrop-filter|linear-gradient|radial-gradient/);
});

test("shell keeps server-side permission filtering and adds accessible active navigation", () => {
  const sidebar = read("components/layout/Sidebar.tsx");
  const navigation = read("components/layout/SidebarNavigation.tsx");
  const shell = read("components/layout/AppShell.tsx");
  assert.match(sidebar, /canAccessSection\(/);
  assert.match(sidebar, /visibleMenuItems\.map\(\(\{ name, href \}\)/);
  assert.match(navigation, /usePathname\(\)/);
  assert.match(navigation, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(navigation, /focus-visible:ring-2/);
  assert.match(shell, /max-w-\[1600px\]/);
  assert.match(shell, /aria-label="Відкрити меню"/);
  assert.match(shell, /aria-label="Закрити меню"/);
});

test("shared primitives and Dashboard consume the R1 foundation without data-layer changes", () => {
  assert.match(read("components/ui/card.tsx"), /cn\("vc-surface", className\)/);
  assert.match(read("components/ui/input.tsx"), /cn\("vc-field", className\)/);
  assert.match(read("components/ui/button.tsx"), /focus-visible:ring-3/);
  assert.match(read("app/page.tsx"), /className="vc-surface min-w-0/);
  for (const file of [
    "components/dashboard/DashboardAttention.tsx",
    "components/dashboard/DashboardObjectWatchlist.tsx",
    "components/dashboard/OperationalDashboard.tsx",
    "components/dashboard/TodayTasksSection.tsx",
  ]) assert.match(read(file), /vc-surface/);
  assert.doesNotMatch(read("app/page.tsx"), /\.from\(|\.rpc\(|createClient\(/);
});
