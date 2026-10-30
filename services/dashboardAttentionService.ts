import "server-only";

import { cache } from "react";

import { isValidDateValue } from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/services/dashboardService";
import { getAppSettings } from "@/services/settingsService";
import type {
  DashboardAttentionData,
  DashboardAttentionItem,
  DashboardAttentionSeverity,
  DashboardAttentionTiming,
  DashboardFinanceAttentionItem,
  DashboardOperationalAttentionItem,
  DashboardOperationalAttentionKind,
} from "@/types/dashboardAttention";

const SOURCE_LIMIT = 8;
const OPERATIONAL_KEYS = [
  "item_id", "kind", "severity", "timing", "title", "description",
  "entity_type", "entity_id", "object_id", "relevant_date", "href",
] as const;
const FINANCE_KEYS = [...OPERATIONAL_KEYS, "amount"] as const;

const operationalContract: Record<DashboardOperationalAttentionKind, {
  severity: DashboardAttentionSeverity;
  timing: DashboardAttentionTiming;
  entityType: DashboardOperationalAttentionItem["entityType"];
}> = {
  task_overdue: { severity: "critical", timing: "overdue", entityType: "task" },
  task_today: { severity: "warning", timing: "today", entityType: "task" },
  supervision_overdue: { severity: "critical", timing: "overdue", entityType: "object" },
  supervision_today: { severity: "warning", timing: "today", entityType: "object" },
  warehouse_out: { severity: "critical", timing: "current", entityType: "warehouse_item" },
  warehouse_low: { severity: "warning", timing: "current", entityType: "warehouse_item" },
  equipment_overdue: { severity: "critical", timing: "overdue", entityType: "equipment" },
  equipment_today: { severity: "warning", timing: "today", entityType: "equipment" },
  equipment_today_usage_due: { severity: "critical", timing: "today", entityType: "equipment" },
  equipment_usage_due: { severity: "critical", timing: "current", entityType: "equipment" },
  equipment_upcoming: { severity: "info", timing: "upcoming", entityType: "equipment" },
};

const financeContract = {
  payment_overdue: { severity: "critical", timing: "overdue" },
  payment_today: { severity: "warning", timing: "today" },
} as const;

const timingRank: Record<DashboardAttentionTiming, number> = {
  overdue: 0, today: 1, current: 2, upcoming: 3,
};
const severityRank: Record<DashboardAttentionSeverity, number> = {
  critical: 0, warning: 1, info: 2,
};

const loadError = () => new Error("Не вдалося завантажити перелік уваги.");

function hasExactKeys(row: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(row).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function positiveId(value: unknown) {
  const parsed = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed <= 0) throw loadError();
  return parsed;
}

function optionalObjectId(value: unknown) {
  return value === null ? null : positiveId(value);
}

function boundedText(value: unknown, max: number) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw loadError();
  return value;
}

function relevantDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !isValidDateValue(value)) throw loadError();
  return value;
}

function expectedHref(entityType: DashboardOperationalAttentionItem["entityType"], entityId: number) {
  if (entityType === "task") return `/tasks/${entityId}`;
  if (entityType === "object") return `/objects/${entityId}`;
  if (entityType === "warehouse_item") return `/warehouse/${entityId}`;
  return `/equipment/${entityId}`;
}

function parseOperationalRow(value: unknown): DashboardOperationalAttentionItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw loadError();
  const row = value as Record<string, unknown>;
  if (!hasExactKeys(row, OPERATIONAL_KEYS) || typeof row.kind !== "string"
    || !(row.kind in operationalContract)) throw loadError();
  const kind = row.kind as DashboardOperationalAttentionKind;
  const contract = operationalContract[kind];
  if (row.severity !== contract.severity || row.timing !== contract.timing
    || row.entity_type !== contract.entityType) throw loadError();
  const entityId = positiveId(row.entity_id);
  const href = expectedHref(contract.entityType, entityId);
  if (row.href !== href || row.item_id !== `${kind}:${entityId}`) throw loadError();
  return {
    source: "operational", id: row.item_id, kind,
    severity: contract.severity, timing: contract.timing,
    title: boundedText(row.title, 150), description: boundedText(row.description, 500),
    entityType: contract.entityType, entityId, objectId: optionalObjectId(row.object_id),
    relevantDate: relevantDate(row.relevant_date), href,
  };
}

function parseFinanceRow(value: unknown): DashboardFinanceAttentionItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw loadError();
  const row = value as Record<string, unknown>;
  if (!hasExactKeys(row, FINANCE_KEYS) || typeof row.kind !== "string"
    || !(row.kind in financeContract)) throw loadError();
  const kind = row.kind as keyof typeof financeContract;
  const contract = financeContract[kind];
  const entityId = positiveId(row.entity_id);
  const objectId = positiveId(row.object_id);
  const href = `/objects/${objectId}?tab=finance#payment-schedule`;
  const amount = typeof row.amount === "string" && row.amount !== "" ? Number(row.amount) : row.amount;
  if (row.severity !== contract.severity || row.timing !== contract.timing
    || row.entity_type !== "payment_schedule" || row.href !== href
    || row.item_id !== `${kind}:${entityId}` || typeof amount !== "number"
    || !Number.isFinite(amount) || amount <= 0
    || !Number.isSafeInteger(Math.round(amount * 100))) throw loadError();
  return {
    source: "finance", id: row.item_id, kind,
    severity: contract.severity, timing: contract.timing,
    title: boundedText(row.title, 150), description: boundedText(row.description, 500),
    entityType: "payment_schedule", entityId, objectId,
    relevantDate: relevantDate(row.relevant_date), href, amount,
  };
}

async function loadRows<T>(rpc: string, businessDate: string, parse: (value: unknown) => T) {
  const supabase = await createClient();
  const result = await Promise.resolve(supabase.rpc(rpc, { p_business_date: businessDate }))
    .catch(() => { throw loadError(); });
  if (result.error || !Array.isArray(result.data) || result.data.length > SOURCE_LIMIT) throw loadError();
  return result.data.map(parse);
}

export function sortDashboardAttention<T extends DashboardAttentionItem>(items: T[]): T[] {
  return [...items].sort((first, second) =>
    timingRank[first.timing] - timingRank[second.timing]
    || severityRank[first.severity] - severityRank[second.severity]
    || (first.relevantDate ?? "9999-12-31").localeCompare(second.relevantDate ?? "9999-12-31")
    || first.kind.localeCompare(second.kind)
    || first.entityId - second.entityId
    || first.id.localeCompare(second.id)
  );
}

export const getDashboardAttention = cache(async (): Promise<DashboardAttentionData> => {
  const context = await getDashboardContext();
  const operationalPromise = loadRows(
    "get_dashboard_operational_attention", context.today, parseOperationalRow
  );

  if (context.profile.role === "worker") {
    return {
      kind: "worker",
      items: sortDashboardAttention(await operationalPromise).slice(0, SOURCE_LIMIT),
      partialFailure: false,
    };
  }

  const [operational, finance, settings] = await Promise.all([
    Promise.allSettled([operationalPromise]).then(([result]) => result),
    Promise.allSettled([loadRows(
      "get_dashboard_finance_attention", context.today, parseFinanceRow
    )]).then(([result]) => result),
    getAppSettings(),
  ]);
  if (operational.status === "rejected" && finance.status === "rejected") throw loadError();
  const items = [
    ...(operational.status === "fulfilled" ? operational.value : []),
    ...(finance.status === "fulfilled" ? finance.value : []),
  ];
  return {
    kind: "management",
    currency: settings.currency,
    items: sortDashboardAttention(items).slice(0, SOURCE_LIMIT),
    partialFailure: operational.status === "rejected" || finance.status === "rejected",
  };
});
