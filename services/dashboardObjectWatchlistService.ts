import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/services/dashboardService";
import { getAppSettings } from "@/services/settingsService";
import type {
  DashboardObjectWatchlistData,
  ManagementObjectWatchlistItem,
  WorkerObjectWatchlistItem,
} from "@/types/dashboardObjectWatchlist";

const WATCHLIST_LIMIT = 5;
const ACTIVE_OBJECT_STATUSES = new Set([
  "В роботі",
  "На постійному обслуговуванні",
  "Під періодичним наглядом",
]);
const WORKER_KEYS = [
  "object_id", "name", "status", "responsible_employee_name",
  "overdue_task_count", "supervision_overdue",
] as const;
const MANAGEMENT_KEYS = [
  ...WORKER_KEYS, "has_overdue_payment", "overdue_payment_amount", "missing_client_price",
] as const;

const loadError = () => new Error("Не вдалося завантажити об’єкти під контролем.");

function hasExactKeys(row: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(row).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function positiveId(value: unknown) {
  const parsed = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed <= 0) throw loadError();
  return parsed;
}

function nonNegativeInteger(value: unknown) {
  const parsed = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0) throw loadError();
  return parsed;
}

function boundedText(value: unknown, max: number) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw loadError();
  return value;
}

function optionalName(value: unknown) {
  if (value === null) return null;
  return boundedText(value, 200);
}

function booleanValue(value: unknown) {
  if (typeof value !== "boolean") throw loadError();
  return value;
}

function baseItem(row: Record<string, unknown>): WorkerObjectWatchlistItem {
  const objectId = positiveId(row.object_id);
  const status = boundedText(row.status, 100);
  if (!ACTIVE_OBJECT_STATUSES.has(status)) throw loadError();
  return {
    objectId,
    name: boundedText(row.name, 500),
    status,
    responsibleEmployeeName: optionalName(row.responsible_employee_name),
    overdueTaskCount: nonNegativeInteger(row.overdue_task_count),
    supervisionOverdue: booleanValue(row.supervision_overdue),
    href: `/objects/${objectId}`,
  };
}

function parseWorkerRow(value: unknown): WorkerObjectWatchlistItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw loadError();
  const row = value as Record<string, unknown>;
  if (!hasExactKeys(row, WORKER_KEYS)) throw loadError();
  return baseItem(row);
}

function parseManagementRow(value: unknown): ManagementObjectWatchlistItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw loadError();
  const row = value as Record<string, unknown>;
  if (!hasExactKeys(row, MANAGEMENT_KEYS)) throw loadError();
  const amount = typeof row.overdue_payment_amount === "string" && row.overdue_payment_amount !== ""
    ? Number(row.overdue_payment_amount) : row.overdue_payment_amount;
  const hasOverduePayment = booleanValue(row.has_overdue_payment);
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0
    || !Number.isSafeInteger(Math.round(amount * 100))
    || hasOverduePayment !== (amount > 0)) throw loadError();
  return {
    ...baseItem(row),
    hasOverduePayment,
    overduePaymentAmount: amount,
    missingClientPrice: booleanValue(row.missing_client_price),
  };
}

async function loadRows<T>(rpc: string, businessDate: string, parse: (value: unknown) => T) {
  const supabase = await createClient();
  const result = await Promise.resolve(supabase.rpc(rpc, { p_business_date: businessDate }))
    .catch(() => { throw loadError(); });
  if (result.error || !Array.isArray(result.data) || result.data.length > WATCHLIST_LIMIT) throw loadError();
  return result.data.map(parse);
}

export const getDashboardObjectWatchlist = cache(async (): Promise<DashboardObjectWatchlistData> => {
  const context = await getDashboardContext();

  // The role branch completes before a management/finance RPC or settings read can start.
  if (context.profile.role === "worker") {
    if (context.profile.employee_id === null) return { kind: "worker", items: [] };
    return {
      kind: "worker",
      items: await loadRows(
        "get_dashboard_worker_object_watchlist", context.today, parseWorkerRow
      ),
    };
  }

  const [items, settings] = await Promise.all([
    loadRows(
      "get_dashboard_management_object_watchlist", context.today, parseManagementRow
    ),
    getAppSettings(),
  ]);
  return { kind: "management", currency: settings.currency, items };
});
