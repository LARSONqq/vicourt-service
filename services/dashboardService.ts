import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canAccessSection, canManageEquipment, canManageObjects, canManagePurchases, canViewActivityLog, type AppSection } from "@/lib/auth/permissions";
import { addDaysToDateValue, getKyivDateValue } from "@/lib/kyivDate";
import { getWarehouseStockStatus } from "@/lib/warehouseStock";
import { evaluateEquipmentMaintenance, getEquipmentMaintenanceOverallLabel } from "@/lib/equipmentMaintenance";
import { PERIODIC_SUPERVISION_STATUS } from "@/lib/objectSupervision";
import { getTaskDashboardSummary, getTaskDashboardPreview } from "@/services/taskWorkspaceService";
import { getRecentActivityPreview } from "@/services/activityLogService";
import { getWarehouseStockSummary } from "@/services/warehouseStockSummaryService";
import { getEquipmentMaintenanceSummary } from "@/services/equipmentMaintenanceSummaryService";
import type { Equipment } from "@/types/equipment";
import type { DashboardPermissions } from "@/types/dashboard";

// Request-local auth/date only: never persist a user's dashboard across requests.
export const getDashboardContext = cache(async () => {
  const profile = await requireSectionAccess("home");
  const permissions: DashboardPermissions = {
    canCreateObject: canManageObjects(profile.role),
    canCreateTask: canAccessSection(profile.role, "tasks"),
    canCreatePurchase: canManagePurchases(profile.role),
    canCreateEquipment: canManageEquipment(profile.role),
    canManageSupervision: canManageObjects(profile.role),
    canManageEquipment: canManageEquipment(profile.role),
    canViewPurchases: canAccessSection(profile.role, "purchases"),
    canViewFinance: canManageObjects(profile.role),
  };
  return { profile, today: getKyivDateValue(), permissions, activityVisible: canViewActivityLog(profile.role) };
});

async function sectionContext(section: AppSection) {
  const context = await getDashboardContext();
  if (!canAccessSection(context.profile.role, section)) throw new Error("Недостатньо прав для перегляду розділу.");
  return context;
}

export const getDashboardTasksSummary = cache(async () => {
  await sectionContext("tasks");
  return getTaskDashboardSummary();
});

export async function getDashboardTasksPreview(view: "today" | "overdue") {
  // Use the exact business date of the canonical counts, including across midnight.
  const summary = await getDashboardTasksSummary();
  return { tasks: await getTaskDashboardPreview(view, summary.businessDate), today: summary.businessDate };
}

export async function getDashboardWarehouse() {
  await sectionContext("warehouse");
  const supabase = await createClient();
  const [summary, preview] = await Promise.all([
    getWarehouseStockSummary(),
    supabase.from("warehouse_items").select("id, name, quantity, unit, min_quantity")
      .lte("quantity", 0).order("quantity").order("id").limit(5)
      .overrideTypes<{ id: number; name: string; quantity: number; unit: string; min_quantity: number | null }[], { merge: false }>(),
  ]);
  if (preview.error) throw new Error("Не вдалося завантажити залишки складу.");
  return { ...summary, items: (preview.data ?? []).map((item) => ({ ...item, stockStatus: getWarehouseStockStatus(item) })) };
}

type MaintenancePreview = Pick<Equipment, "id" | "name" | "next_service_date" | "maintenance_interval_days" | "usage_type" | "current_usage" | "maintenance_interval_usage" | "next_maintenance_usage">;

export async function getDashboardEquipment() {
  const { today } = await sectionContext("equipment");
  const horizon = addDaysToDateValue(today, 7);
  const supabase = await createClient();
  const [summary, preview] = await Promise.all([
    getEquipmentMaintenanceSummary(today),
    supabase.from("equipment")
      .select("id, name, next_service_date, maintenance_interval_days, usage_type, current_usage, maintenance_interval_usage, next_maintenance_usage")
      .gt("maintenance_interval_days", 0).lte("next_service_date", horizon)
      .order("next_service_date").order("id").limit(5)
      .overrideTypes<MaintenancePreview[], { merge: false }>(),
  ]);
  if (preview.error) throw new Error("Не вдалося завантажити план ТО.");
  return { ...summary,
    items: (preview.data ?? []).map((item) => {
      const evaluation = evaluateEquipmentMaintenance(item, today);
      return { id: item.id, name: item.name, date: item.next_service_date,
        label: getEquipmentMaintenanceOverallLabel(evaluation), usageDue: evaluation.usageDue };
    }) };
}

// Preserve the established Home definition of active objects; not all non-completed statuses.
const ACTIVE_OBJECT_STATUSES = ["В роботі", "На постійному обслуговуванні", PERIODIC_SUPERVISION_STATUS];

export async function getDashboardObjects() {
  await sectionContext("objects");
  const supabase = await createClient();
  const [counts, preview] = await Promise.all([
    Promise.all(ACTIVE_OBJECT_STATUSES.map((status) => supabase.from("objects")
      .select("id", { count: "exact", head: true }).eq("status", status))),
    supabase.from("objects").select("id, name, status")
      .in("status", ACTIVE_OBJECT_STATUSES).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(5)
      .overrideTypes<{ id: number; name: string; status: string }[], { merge: false }>(),
  ]);
  if (preview.error || counts.some((result) => result.error)) throw new Error("Не вдалося завантажити огляд об’єктів.");
  const statuses = ACTIVE_OBJECT_STATUSES.map((status, index) => ({ status, count: counts[index].count ?? 0 }));
  return { total: statuses.reduce((sum, item) => sum + item.count, 0), statuses, items: preview.data ?? [] };
}

export async function getDashboardActivity() {
  const { activityVisible } = await getDashboardContext();
  if (!activityVisible) return null; // Before any Activity query or service invocation.
  return getRecentActivityPreview();
}
