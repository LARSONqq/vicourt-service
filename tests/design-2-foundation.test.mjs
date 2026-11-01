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
