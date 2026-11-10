// Focused Design 2.1 shell parity contracts. Static only; no browser, network, or SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("sidebar groups permitted routes without changing navigation contracts", () => {
  const sidebar = read("components/layout/Sidebar.tsx");
  const navigation = read("components/layout/SidebarNavigation.tsx");

  assert.match(sidebar, /canAccessSection\(/);
  assert.match(sidebar, /visibleMenuItems\.map\(\(\{ name, href \}\)/);
  for (const label of ["Робота", "Ресурси", "Аналітика", "Система"]) {
    assert.match(navigation, new RegExp(label));
  }
  assert.match(navigation, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(navigation, /min-h-10[\s\S]*lg:min-h-9/);
  assert.match(navigation, /strokeWidth=\{1\.8\}/);
});

test("sidebar branding uses the existing ViCourt logo asset at a compact size", () => {
  const sidebar = read("components/layout/Sidebar.tsx");

  assert.match(sidebar, /src="\/icons\/vicourt-192\.png"/);
  assert.match(sidebar, /width=\{32\} height=\{32\}/);
  assert.match(sidebar, /className="size-8" priority/);
  assert.doesNotMatch(sidebar, />VC<\/span>/);
});

test("topbar composes quiet workspace context with compact search, theme and account controls", () => {
  const header = read("components/layout/Header.tsx");
  const search = read("components/search/GlobalSearch.tsx");
  const theme = read("components/theme/ThemeSwitcher.tsx");

  assert.match(header, /text-xs font-medium text-muted-foreground/);
  assert.match(header, /vc-account-cluster/);
  assert.match(header, /aria-label=\{isLoggingOut \? "Вихід з облікового запису" : "Вийти"\}/);
  assert.match(search, /vc-search-trigger/);
  assert.match(search, /<Search aria-hidden="true"/);
  assert.match(theme, /vc-theme-switcher/);
});

test("shared shell uses tighter workspace rhythm and semantic light/dark surfaces", () => {
  const shell = read("components/layout/AppShell.tsx");
  const globals = read("app/globals.css");

  assert.match(shell, /px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-5/);
  assert.match(shell, /max-w-\[1600px\]/);
  assert.match(shell, /max-w-\[calc\(100vw-3rem\)\]/);
  assert.match(globals, /\.vc-shell-header\s*\{/);
  assert.match(globals, /\.vc-account-cluster\s*\{/);
  assert.match(globals, /--sidebar: oklch\(0\.165/);
  assert.match(globals, /--vc-topbar: oklch\(0\.995 0\.002 255\)/);
  assert.match(globals, /--vc-topbar: oklch\(0\.18 0 0\)/);
  assert.match(globals, /--sidebar-accent: oklch\(0\.95 0\.022 153\)/);
  assert.match(globals, /--sidebar-accent: oklch\(0\.205 0 0\)/);
  assert.match(globals, /\.vc-nav-item-active\s*\{[\s\S]*?background: var\(--sidebar-accent\)/);
  assert.match(globals, /\.vc-shell-header\s*\{[\s\S]*?background: var\(--vc-topbar\)/);
  assert.doesNotMatch(shell, /bg-black/);
});

test("Dashboard omits redundant secondary links while shell navigation keeps both routes", () => {
  const page = read("app/page.tsx");
  const sidebar = read("components/layout/Sidebar.tsx");

  assert.doesNotMatch(page, /Оперативні розділи|Сповіщення <span|Календар <span/);
  assert.match(sidebar, /name: "Сповіщення",[\s\S]*?href: "\/notifications"/);
  assert.match(sidebar, /name: "Календар",[\s\S]*?href: "\/calendar"/);
});
