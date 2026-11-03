// Focused Design 2.0 Phase 1 presentation contracts. Static only; no network or SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("theme engine provides persisted light, dark and system preferences before hydration", () => {
  const layout = read("app/layout.tsx");
  const shell = read("components/layout/AppShell.tsx");
  const boot = read("components/pwa/PWARegister.tsx");
  const provider = read("components/theme/ThemeProvider.tsx");
  const switcher = read("components/theme/ThemeSwitcher.tsx");
  assert.match(boot, /localStorage\.getItem\('vicourt-theme'\)/);
  assert.match(boot, /prefers-color-scheme: dark/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(shell, /<ThemeProvider>/);
  assert.match(provider, /"light" \| "dark" \| "system"/);
  assert.match(provider, /localStorage\.setItem\(STORAGE_KEY, nextTheme\)/);
  assert.match(provider, /media\.addEventListener\("change", handleChange\)/);
  assert.match(switcher, /aria-label="Тема оформлення"/);
  assert.equal((switcher.match(/value: "(?:light|dark|system)"/g) ?? []).length, 3);
});

test("semantic tokens cover the redesigned light and graphite dark foundations", () => {
  const globals = read("app/globals.css");
  for (const token of [
    "--vc-app", "--vc-elevated", "--vc-secondary", "--vc-border", "--vc-text",
    "--vc-text-muted", "--vc-brand", "--vc-brand-hover", "--vc-hover", "--vc-success-bg",
    "--vc-warning-bg", "--vc-danger-bg", "--vc-info-bg", "--vc-focus", "--vc-shadow-md",
  ]) assert.match(globals, new RegExp(token));
  assert.match(globals, /\.dark\s*\{/);
  assert.match(globals, /prefers-reduced-motion: reduce/);
});

test("shell and Dashboard demonstrate the new system without changing data contracts", () => {
  const sidebar = read("components/layout/Sidebar.tsx");
  const navigation = read("components/layout/SidebarNavigation.tsx");
  const header = read("components/layout/Header.tsx");
  const dashboard = read("components/dashboard/DashboardCommandSurface.tsx");
  assert.match(sidebar, /vc-sidebar/);
  assert.match(sidebar, /canAccessSection\(/);
  assert.match(navigation, /iconByHref/);
  assert.match(navigation, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(header, /<ThemeSwitcher \/>/);
  assert.match(dashboard, /data-tone=\{kpi\.tone\}/);
  assert.match(dashboard, /vc-kpi-card/);
  assert.doesNotMatch(read("app/page.tsx"), /\.from\(|\.rpc\(|createClient\(/);
});

test("Phase 1.1 keeps the enterprise shell and Dashboard restrained", () => {
  const globals = read("app/globals.css");
  const sidebar = read("components/layout/Sidebar.tsx");
  const navigation = read("components/layout/SidebarNavigation.tsx");
  const page = read("app/page.tsx");
  assert.match(sidebar, /border-sidebar-border/);
  assert.doesNotMatch(sidebar, /text-white|border-white/);
  assert.match(navigation, /vc-nav-item-active/);
  assert.doesNotMatch(navigation, /text-white|bg-emerald/);
  assert.match(globals, /--vc-font-sans: Inter/);
  assert.match(globals, /\.vc-nav-item-active\s*\{/);
  assert.doesNotMatch(page, /vc-dashboard-hero/);
  assert.doesNotMatch(page, /<header className="vc-surface/);
  assert.doesNotMatch(globals, /\.vc-dashboard-hero/);
  assert.match(globals, /min-h-28/);
  assert.doesNotMatch(globals, /10px 0 36px/);
});

test("Dark Dashboard uses semantic contrast and the shell keeps one primary brand location", () => {
  const dashboardFiles = [
    "components/dashboard/DashboardCommandSurface.tsx",
    "components/dashboard/DashboardAttention.tsx",
    "components/dashboard/DashboardObjectWatchlist.tsx",
    "components/dashboard/OperationalDashboard.tsx",
    "components/dashboard/TodayTasksSection.tsx",
  ];
  for (const file of dashboardFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /text-gray-(?:400|500|600|700|800|900)|hover:bg-gray-50/);
    assert.match(source, /(?:text-foreground|text-muted-foreground|vc-panel-|vc-status-)/);
  }
  const header = read("components/layout/Header.tsx");
  const sidebar = read("components/layout/Sidebar.tsx");
  assert.match(header, /Робочий простір/);
  assert.doesNotMatch(header, /ViCourt Service/);
  assert.match(sidebar, /shrink-0[\s\S]*safe-area-inset-bottom/);
});
