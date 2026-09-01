import "server-only";

import {
  canAccessSection,
  canManageEquipment,
  canManageObjects,
  canManagePurchases,
} from "@/lib/auth/permissions";
import {
  getEquipmentMaintenanceState,
} from "@/lib/equipmentMaintenance";
import {
  addDaysToDateValue,
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  fromMoneyInCents,
  toMoneyInCents,
} from "@/lib/objectPayments";
import {
  getObjectSupervisionState,
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import {
  buildWarehousePurchaseInsights,
  getWarehousePurchaseInsight,
  getWarehouseStockPlan,
} from "@/lib/warehousePlanning";
import {
  getEquipment,
} from "@/services/equipmentService";
import {
  getNotificationCenter,
} from "@/services/notificationService";
import {
  getObjects,
} from "@/services/objectService";
import {
  getPlannedWarehousePurchases,
} from "@/services/purchaseService";
import {
  getAppSettings,
} from "@/services/settingsService";
import {
  getAllTasks,
} from "@/services/taskService";
import {
  getWarehouseItems,
} from "@/services/warehouseService";

import type {
  DashboardData,
  DashboardDatedEntityPreview,
} from "@/types/dashboard";
import type {
  NotificationItem,
} from "@/types/notification";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";
import type {
  UserProfile,
} from "@/types/userProfile";
import type {
  WarehousePurchase,
} from "@/types/warehousePurchase";

const COMPLETED_TASK_STATUS =
  "Виконано";
const ACTIVE_OBJECT_STATUSES = [
  "В роботі",
  "На постійному обслуговуванні",
  PERIODIC_SUPERVISION_STATUS,
];
const ACTIVE_EQUIPMENT_STATUSES =
  new Set([
    "Справна",
    "В роботі",
  ]);
const ATTENTION_PREVIEW_LIMIT =
  6;
const NEAREST_TASKS_LIMIT = 5;
const RECENT_OBJECTS_LIMIT = 5;
const WAREHOUSE_PREVIEW_LIMIT =
  4;

function getPriorityOrder(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return 1;
    case "Високий":
      return 2;
    case "Середній":
      return 3;
    case "Низький":
      return 4;
    default:
      return 3;
  }
}

function sortTodayTasks(
  tasks: TaskWithObject[]
) {
  return [...tasks].sort(
    (first, second) =>
      getPriorityOrder(
        first.priority
      ) -
        getPriorityOrder(
          second.priority
        ) ||
      first.title.localeCompare(
        second.title,
        "uk"
      )
  );
}

function sortNearestTasks(
  tasks: TaskWithObject[]
) {
  return [...tasks].sort(
    (first, second) =>
      (first.due_date || "").localeCompare(
        second.due_date || ""
      ) ||
      getPriorityOrder(
        first.priority
      ) -
        getPriorityOrder(
          second.priority
        ) ||
      first.title.localeCompare(
        second.title,
        "uk"
      )
  );
}

function sumNotificationAmounts(
  items: NotificationItem[]
) {
  const totalInCents =
    items.reduce(
      (total, item) =>
        total +
        toMoneyInCents(
          item.amount ?? 0
        ),
      0
    );

  return fromMoneyInCents(
    totalInCents
  );
}

function getFirstDatedEntity(
  items: DashboardDatedEntityPreview[]
) {
  return [...items].sort(
    (first, second) =>
      first.date.localeCompare(
        second.date
      ) ||
      first.name.localeCompare(
        second.name,
        "uk"
      )
  )[0] ?? null;
}

export async function getDashboardData(
  profile: UserProfile
): Promise<DashboardData> {
  const today =
    getKyivDateValue();
  const nextWeek =
    addDaysToDateValue(
      today,
      7
    );
  const canViewPurchases =
    canAccessSection(
      profile.role,
      "purchases"
    );
  const canViewFinance =
    canManageObjects(
      profile.role
    );
  const permissions = {
    canCreateObject:
      canManageObjects(
        profile.role
      ),
    canCreateTask:
      canAccessSection(
        profile.role,
        "tasks"
      ),
    canCreatePurchase:
      canManagePurchases(
        profile.role
      ),
    canCreateEquipment:
      canManageEquipment(
        profile.role
      ),
    canManageSupervision:
      canManageObjects(
        profile.role
      ),
    canManageEquipment:
      canManageEquipment(
        profile.role
      ),
    canViewPurchases,
    canViewFinance,
  };

  const [
    notificationCenter,
    tasks,
    activeObjects,
    recentObjects,
    equipment,
    warehouseItems,
    plannedPurchases,
    settings,
  ] = await Promise.all([
    getNotificationCenter(),
    getAllTasks({
      dueDateOnOrBefore:
        nextWeek,
      excludeStatus:
        COMPLETED_TASK_STATUS,
    }),
    getObjects({
      statuses:
        ACTIVE_OBJECT_STATUSES,
    }),
    getObjects({
      limit:
        RECENT_OBJECTS_LIMIT,
    }),
    getEquipment(),
    getWarehouseItems(),
    canViewPurchases
      ? getPlannedWarehousePurchases()
      : Promise.resolve<
          WarehousePurchase[]
        >([]),
    getAppSettings(),
  ]);

  const todayTasks =
    sortTodayTasks(
      tasks.filter(
        (task) =>
          task.due_date ===
          today
      )
    );
  const overdueTasks =
    tasks.filter(
      (task) =>
        task.due_date !==
          null &&
        task.due_date < today
    );
  const nearestTasks =
    sortNearestTasks(
      tasks.filter(
        (task) =>
          task.due_date !==
            null &&
          task.due_date > today
      )
    ).slice(
      0,
      NEAREST_TASKS_LIMIT
    );

  const supervisionNotifications =
    notificationCenter.items.filter(
      (item) =>
        item.category ===
        "supervision"
    );
  const futureSupervisions =
    activeObjects.flatMap(
      (object) => {
        if (
          object.status !==
          PERIODIC_SUPERVISION_STATUS
        ) {
          return [];
        }

        const state =
          getObjectSupervisionState(
            object.next_supervision_date,
            today
          );

        return state.kind ===
          "planned" &&
          object.next_supervision_date
          ? [
              {
                id: object.id,
                name: object.name,
                date: object.next_supervision_date,
              },
            ]
          : [];
      }
    );

  const maintenanceNotifications =
    notificationCenter.items.filter(
      (item) =>
        item.category ===
        "equipment"
    );
  const futureMaintenance =
    equipment.flatMap(
      (item) => {
        const state =
          getEquipmentMaintenanceState(
            item.maintenance_interval_days,
            item.next_service_date,
            today
          );

        return state.kind ===
          "scheduled" &&
          item.next_service_date
          ? [
              {
                id: item.id,
                name: item.name,
                date: item.next_service_date,
              },
            ]
          : [];
      }
    );

  const purchaseInsights =
    buildWarehousePurchaseInsights(
      plannedPurchases
    );
  const lowStockItems =
    warehouseItems
      .map((item) => {
        const insight =
          getWarehousePurchaseInsight(
            purchaseInsights,
            item.id
          );
        const plan =
          getWarehouseStockPlan(
            item,
            insight.plannedQuantity
          );

        return {
          item,
          plan,
        };
      })
      .filter(
        ({ plan }) =>
          plan.isLowStock
      )
      .sort(
        (first, second) => {
          const firstOut =
            first.plan.currentQuantity <=
            0;
          const secondOut =
            second.plan.currentQuantity <=
            0;

          if (
            firstOut !==
            secondOut
          ) {
            return firstOut
              ? -1
              : 1;
          }

          const firstRatio =
            first.plan.minimumQuantity >
            0
              ? first.plan.currentQuantity /
                first.plan.minimumQuantity
              : first.plan.currentQuantity;
          const secondRatio =
            second.plan.minimumQuantity >
            0
              ? second.plan.currentQuantity /
                second.plan.minimumQuantity
              : second.plan.currentQuantity;

          return (
            firstRatio -
              secondRatio ||
            first.item.name.localeCompare(
              second.item.name,
              "uk"
            )
          );
        }
      );

  const overduePayments =
    notificationCenter.items.filter(
      (item) =>
        item.type ===
        "client_payment_overdue"
    );
  const paymentsDueToday =
    notificationCenter.items.filter(
      (item) =>
        item.type ===
        "client_payment_due_today"
    );

  return {
    today,
    role: profile.role,
    userName:
      profile.full_name,
    currency:
      settings.currency,
    permissions,
    kpis: {
      activeObjects:
        activeObjects.length,
      todayTasks:
        todayTasks.length,
      overdueTasks:
        overdueTasks.length,
      attentionItems:
        notificationCenter.summary
          .total,
      lowStockItems:
        lowStockItems.length,
      overduePayments:
        canViewFinance
          ? overduePayments.length
          : null,
    },
    attention: {
      items:
        notificationCenter.items.slice(
          0,
          ATTENTION_PREVIEW_LIMIT
        ),
      summary:
        notificationCenter.summary,
    },
    todayTasks,
    nearestTasks,
    objects: {
      working:
        activeObjects.filter(
          (object) =>
            object.status ===
            "В роботі"
        ).length,
      permanentMaintenance:
        activeObjects.filter(
          (object) =>
            object.status ===
            "На постійному обслуговуванні"
        ).length,
      supervision:
        activeObjects.filter(
          (object) =>
            object.status ===
            PERIODIC_SUPERVISION_STATUS
        ).length,
      supervisionToday:
        supervisionNotifications.filter(
          (item) =>
            item.type ===
            "supervision_today"
        ).length,
      supervisionOverdue:
        supervisionNotifications.filter(
          (item) =>
            item.type ===
            "supervision_overdue"
        ).length,
      nextSupervision:
        getFirstDatedEntity(
          futureSupervisions
        ),
      recent:
        recentObjects.map(
          (object) => ({
            id: object.id,
            name: object.name,
            customer:
              object.customer,
            manager:
              object.manager,
            status:
              object.status,
            createdAt:
              object.created_at,
          })
        ),
    },
    equipment: {
      active:
        equipment.filter(
          (item) =>
            ACTIVE_EQUIPMENT_STATUSES.has(
              item.status
            )
        ).length,
      maintenanceToday:
        maintenanceNotifications.filter(
          (item) =>
            item.type ===
            "equipment_maintenance_today"
        ).length,
      maintenanceOverdue:
        maintenanceNotifications.filter(
          (item) =>
            item.type ===
            "equipment_maintenance_overdue"
        ).length,
      nextMaintenance:
        getFirstDatedEntity(
          futureMaintenance
        ),
    },
    warehouse: {
      lowStockCount:
        lowStockItems.length,
      items:
        lowStockItems
          .slice(
            0,
            WAREHOUSE_PREVIEW_LIMIT
          )
          .map(
            ({
              item,
              plan,
            }) => ({
              id: item.id,
              name: item.name,
              unit: item.unit,
              currentQuantity:
                plan.currentQuantity,
              minimumQuantity:
                plan.minimumQuantity,
              targetQuantity:
                plan.targetQuantity,
              plannedIncoming:
                canViewPurchases
                  ? plan.plannedIncoming
                  : null,
              recommendedRemaining:
                canViewPurchases
                  ? plan.remainingRecommended ??
                    plan.minimumShortage
                  : null,
            })
          ),
      planningVisible:
        canViewPurchases,
    },
    purchases:
      canViewPurchases
        ? {
            plannedCount:
              plannedPurchases.length,
          }
        : null,
    finance:
      canViewFinance
        ? {
            overdueCount:
              overduePayments.length,
            overdueAmount:
              sumNotificationAmounts(
                overduePayments
              ),
            dueTodayCount:
              paymentsDueToday.length,
            dueTodayAmount:
              sumNotificationAmounts(
                paymentsDueToday
              ),
          }
        : null,
  };
}
