import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canAccessSection, canManageEquipment, canManageObjects, canManagePurchases, canViewActivityLog, type AppSection } from "@/lib/auth/permissions";
import { getKyivDateValue } from "@/lib/kyivDate";
import { PERIODIC_SUPERVISION_STATUS } from "@/lib/objectSupervision";
import { COMPLETED_TASK_STATUS } from "@/lib/taskPresentation";
import { getPersonalTaskDashboardLinks } from "@/lib/taskWorkspace";
import { getTaskDashboardSummary, getTaskDashboardPreview } from "@/services/taskWorkspaceService";
import { getRecentActivityPreview } from "@/services/activityLogService";
import { getWarehouseStockSummary } from "@/services/warehouseStockSummaryService";
import { getEquipmentMaintenanceSummary } from "@/services/equipmentMaintenanceSummaryService";
import { getDashboardEquipmentAttentionItems, getDashboardWarehouseAttentionItems } from "@/services/dashboardOperationalPreviewService";
import { getReportOverviewCurrentFinance } from "@/services/reportCurrentFinanceService";
import { getAppSettings } from "@/services/settingsService";
import type { DashboardCommandData, DashboardPermissions } from "@/types/dashboard";

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
  const { profile, today } = await sectionContext("tasks");
  if (profile.role === "worker") {
    if (profile.employee_id === null) return {
      businessDate: today, hasEmployeeLink: false,
      today: 0, overdue: 0, myOpen: 0, open: 0,
    };
    const supabase = await createClient();
    const assignedOpenCount = () => supabase.from("object_tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_employee_id", profile.employee_id)
      .neq("status", COMPLETED_TASK_STATUS);
    const [todayTasks, overdueTasks, openTasks] = await Promise.all([
      assignedOpenCount().eq("due_date", today),
      assignedOpenCount().lt("due_date", today),
      assignedOpenCount(),
    ]);
    if ([todayTasks, overdueTasks, openTasks].some((result) => result.error)) {
      throw new Error("Не вдалося завантажити підсумок завдань.");
    }
    const open = openTasks.count ?? 0;
    return {
      businessDate: today, hasEmployeeLink: true,
      today: todayTasks.count ?? 0, overdue: overdueTasks.count ?? 0,
      myOpen: open, open,
    };
  }
  return getTaskDashboardSummary();
});

export async function getDashboardTasksPreview(view: "today" | "overdue") {
  // Use the exact business date of the canonical counts, including across midnight.
  const { profile } = await sectionContext("tasks");
  const summary = await getDashboardTasksSummary();
  if (profile.role === "worker" && profile.employee_id === null) {
    return { tasks: [], today: summary.businessDate };
  }
  return {
    tasks: await getTaskDashboardPreview(
      view,
      summary.businessDate,
      profile.role === "worker" ? profile.employee_id ?? undefined : undefined
    ),
    today: summary.businessDate,
  };
}

export async function getDashboardWarehouse() {
  await sectionContext("warehouse");
  const [summary, preview] = await Promise.all([
    getWarehouseStockSummary(),
    getDashboardWarehouseAttentionItems(),
  ]);
  return { ...summary, items: preview };
}

export async function getDashboardEquipment() {
  const { today } = await sectionContext("equipment");
  const [summary, preview] = await Promise.all([
    getEquipmentMaintenanceSummary(today),
    getDashboardEquipmentAttentionItems(today),
  ]);
  return { ...summary, items: preview };
}

// Preserve the established Home definition of active objects; not all non-completed statuses.
const ACTIVE_OBJECT_STATUSES = ["В роботі", "На постійному обслуговуванні", PERIODIC_SUPERVISION_STATUS];

export const getDashboardObjects = cache(async () => {
  const { profile } = await sectionContext("objects");
  const assignedEmployeeId = profile.role === "worker" ? profile.employee_id : null;
  if (profile.role === "worker" && assignedEmployeeId === null) {
    return {
      total: 0,
      statuses: ACTIVE_OBJECT_STATUSES.map((status) => ({ status, count: 0 })),
      items: [],
      scope: "assigned" as const,
    };
  }
  const supabase = await createClient();
  const countForStatus = (status: string) => {
    let query = supabase.from("objects")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (assignedEmployeeId !== null) query = query.eq("responsible_employee_id", assignedEmployeeId);
    return query;
  };
  let previewQuery = supabase.from("objects").select("id, name, status")
    .in("status", ACTIVE_OBJECT_STATUSES);
  if (assignedEmployeeId !== null) {
    previewQuery = previewQuery.eq("responsible_employee_id", assignedEmployeeId);
  }
  const [counts, preview] = await Promise.all([
    Promise.all(ACTIVE_OBJECT_STATUSES.map(countForStatus)),
    previewQuery.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(5)
      .overrideTypes<{ id: number; name: string; status: string }[], { merge: false }>(),
  ]);
  if (preview.error || counts.some((result) => result.error)) throw new Error("Не вдалося завантажити огляд об’єктів.");
  const statuses = ACTIVE_OBJECT_STATUSES.map((status, index) => ({ status, count: counts[index].count ?? 0 }));
  return {
    total: statuses.reduce((sum, item) => sum + item.count, 0),
    statuses,
    items: preview.data ?? [],
    scope: assignedEmployeeId === null ? "all" as const : "assigned" as const,
  };
});

export const getDashboardCommandData = cache(async (): Promise<DashboardCommandData> => {
  const context = await getDashboardContext();

  // This branch must complete before any management/finance loader is started.
  if (context.profile.role === "worker") {
    const [tasks, objects] = await Promise.all([
      getDashboardTasksSummary(),
      getDashboardObjects(),
    ]);
    return {
      kind: "worker",
      role: "worker",
      today: context.today,
      userName: context.profile.full_name,
      employeeLinked: context.profile.employee_id !== null,
      taskLinks: getPersonalTaskDashboardLinks(context.profile.employee_id),
      kpis: {
        myTodayTasks: tasks.today,
        myOverdueTasks: tasks.overdue,
        myOpenTasks: tasks.myOpen,
        assignedActiveObjects: objects.total,
      },
    };
  }

  const [tasks, objects, finance, settings] = await Promise.all([
    getDashboardTasksSummary(),
    getDashboardObjects(),
    getReportOverviewCurrentFinance(null, context.today),
    getAppSettings(),
  ]);
  return {
    kind: "management",
    role: context.profile.role,
    today: context.today,
    userName: context.profile.full_name,
    currency: settings.currency,
    kpis: {
      outstandingReceivables: finance.outstanding_receivables,
      overdueScheduleAmount: finance.overdue_schedule_amount,
      overdueTasks: tasks.overdue,
      activeObjects: objects.total,
    },
  };
});

export async function getDashboardActivity() {
  const { activityVisible } = await getDashboardContext();
  if (!activityVisible) return null; // Before any Activity query or service invocation.
  return getRecentActivityPreview();
}
