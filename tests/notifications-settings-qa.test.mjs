// Focused notification-filter and settings-timezone contracts. Static only; no network or SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("notification filters reuse role permissions and reject unavailable query filters", () => {
  const page = read("app/notifications/page.tsx");
  assert.match(page, /canAccessSection\([\s\S]*profile\.role,[\s\S]*"purchases"/);
  assert.match(page, /canManageObjects\([\s\S]*profile\.role/);
  assert.match(page, /parseFilter\([\s\S]*visibleFilters/);
  assert.match(page, /visibleFilters\.map\(\(filter\)/);
});

test("settings formats its visible update timestamp with the shared Kyiv helper", () => {
  const page = read("app/settings/page.tsx");
  assert.match(page, /import \{ formatKyivTimestamp \} from "@\/lib\/kyivDate"/);
  assert.match(page, /formatKyivTimestamp\([\s\S]*settings\.updated_at/);
  assert.doesNotMatch(page, /new Intl\.DateTimeFormat/);

  const dates = read("lib/kyivDate.ts");
  assert.match(dates, /const KYIV_TIME_ZONE\s*=\s*"Europe\/Kyiv"/);
  assert.match(dates, /export function formatKyivTimestamp/);
});
