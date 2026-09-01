import "server-only";

import {
  cache,
} from "react";

import {
  MANUAL_TASK_SOURCE,
} from "@/constants/taskSource";
import {
  canAccessSection,
  canManageObjects,
} from "@/lib/auth/permissions";
import {
  getDateDifferenceInDays,
  getKyivDateValue,
} from "@/lib/kyivDate";
import { getTaskTarget } from "@/lib/taskTarget";
import {
  getDayWord,
  getEquipmentMaintenanceState,
} from "@/lib/equipmentMaintenance";
import {
  getObjectSupervisionState,
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import {
  buildWarehousePurchaseInsights,
  formatWarehouseQuantity,
  getWarehousePurchaseInsight,
  getWarehouseStockPlan,
} from "@/lib/warehousePlanning";
import {
  getObjects,
} from "@/services/objectService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  getEquipment,
} from "@/services/equipmentService";
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
import {
  getDueObjectPaymentSchedules,
  getObjectPaymentTotals,
} from "@/services/objectPaymentScheduleService";
import {
  calculateObjectPaymentSchedule,
} from "@/lib/objectPaymentSchedule";

import type {
  AutomaticPushNotificationType,
  NotificationCenterData,
  NotificationItem,
  NotificationSummary,
} from "@/types/notification";
import type {
  ObjectItem,
} from "@/types/object";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";
import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  WarehouseItem,
} from "@/types/warehouseItem";
import type {
  WarehousePurchase,
} from "@/types/warehousePurchase";
import type {
  Equipment,
} from "@/types/equipment";
import type {
  AllocatedObjectPaymentScheduleItem,
  ObjectPaymentScheduleWithObject,
} from "@/types/objectPaymentSchedule";

const COMPLETED_TASK_STATUS =
  "Виконано";
const PLANNED_PURCHASE_STATUS =
  "Заплановано";

export type NotificationSourceData = {
  today: string;
  currency: AppCurrency;
  tasks: TaskWithObject[];
  objects: ObjectItem[];
  warehouseItems: WarehouseItem[];
  purchases: WarehousePurchase[];
  equipment: Equipment[];
  paymentSchedules: Array<
    AllocatedObjectPaymentScheduleItem<ObjectPaymentScheduleWithObject>
  >;
};

const AUTOMATIC_PUSH_TYPES =
  new Set<AutomaticPushNotificationType>([
    "overdue_task",
    "supervision_today",
    "supervision_overdue",
    "low_stock",
    "equipment_maintenance_today",
    "equipment_maintenance_overdue",
    "client_payment_due_today",
    "client_payment_overdue",
  ]);

export function isAutomaticPushNotification(
  item: NotificationItem
): item is NotificationItem & {
  type: AutomaticPushNotificationType;
} {
  return AUTOMATIC_PUSH_TYPES.has(
    item.type as AutomaticPushNotificationType
  );
}

export function getAutomaticPushStateToken(
  item: NotificationItem & {
    type: AutomaticPushNotificationType;
  }
) {
  switch (item.type) {
    case "overdue_task":
      return item.date
        ? `overdue:${item.date}`
        : null;

    case "supervision_today":
      return item.date
        ? `today:${item.date}`
        : null;

    case "supervision_overdue":
      return item.date
        ? `overdue:${item.date}`
        : null;

    case "low_stock":
      // Залишок не входить у token: зміни в межах одного low-stock episode
      // не повинні створювати повторні push-повідомлення.
      return "low-stock";

    case "equipment_maintenance_today":
      return item.date
        ? `today:${item.date}`
        : null;

    case "equipment_maintenance_overdue":
      return item.date
        ? `overdue:${item.date}`
        : null;

    case "client_payment_due_today":
      return item.date
        ? `today:${item.date}`
        : null;

    case "client_payment_overdue":
      return item.date
        ? `overdue:${item.date}`
        : null;
  }
}

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function getSortRank(
  item: NotificationItem
) {
  if (
    item.timing ===
    "overdue"
  ) {
    return 0;
  }

  if (
    item.timing === "today"
  ) {
    return 1;
  }

  if (
    item.severity ===
    "warning"
  ) {
    return 2;
  }

  return 3;
}

function sortNotifications(
  items: NotificationItem[]
) {
  return [...items].sort(
    (first, second) => {
      const rankDifference =
        getSortRank(first) -
        getSortRank(second);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      if (
        first.date &&
        second.date &&
        first.date !== second.date
      ) {
        return first.date.localeCompare(
          second.date
        );
      }

      if (first.date) {
        return -1;
      }

      if (second.date) {
        return 1;
      }

      return first.message.localeCompare(
        second.message,
        "uk"
      );
    }
  );
}

export function getNotificationSummary(
  items: NotificationItem[]
): NotificationSummary {
  return {
    total: items.length,
    critical: items.filter(
      (item) =>
        item.severity ===
        "critical"
    ).length,
    today: items.filter(
      (item) =>
        item.timing ===
        "today"
    ).length,
  };
}

export function buildNotificationItems({
  today,
  currency,
  tasks,
  objects,
  warehouseItems,
  purchases,
  equipment,
  paymentSchedules,
}: NotificationSourceData): NotificationItem[] {
  const items: NotificationItem[] = [];
  const purchaseInsights =
    buildWarehousePurchaseInsights(
      purchases
    );

  for (const task of tasks) {
    if (
      task.task_source !==
        MANUAL_TASK_SOURCE ||
      task.status ===
        COMPLETED_TASK_STATUS ||
      !task.due_date ||
      task.due_date >= today
    ) {
      continue;
    }

    const overdueDays =
      getDateDifferenceInDays(
        task.due_date,
        today
      ) || 0;
    const target =
      getTaskTarget(task);

    items.push({
      key: `task-overdue:${task.id}`,
      type: "overdue_task",
      category: "tasks",
      severity: "critical",
      timing: "overdue",
      title: "Прострочене завдання",
      message: task.title,
      detail: `Прострочено на ${overdueDays} ${getDayWord(
        overdueDays
      )}`,
      contextLabel:
        target
          ? `${target.label}: ${target.name}`
          : null,
      href: target?.href || "/task",
      date: task.due_date,
      overdueDays,
      objectId:
        target?.type === "object"
          ? target.id
          : undefined,
      equipmentId:
        target?.type === "equipment"
          ? target.id
          : undefined,
      taskId: task.id,
    });
  }

  for (const object of objects) {
    if (
      object.status !==
      PERIODIC_SUPERVISION_STATUS
    ) {
      continue;
    }

    const state =
      getObjectSupervisionState(
        object.next_supervision_date,
        today
      );

    if (
      state.kind !== "today" &&
      state.kind !== "overdue"
    ) {
      continue;
    }

    const isOverdue =
      state.kind === "overdue";

    items.push({
      // Stable key описує сам об’єкт. Дата циклу та today/overdue
      // зберігаються окремо у state token automatic push delivery.
      key: `supervision:${object.id}`,
      type: isOverdue
        ? "supervision_overdue"
        : "supervision_today",
      category: "supervision",
      severity: isOverdue
        ? "critical"
        : "warning",
      timing: isOverdue
        ? "overdue"
        : "today",
      title: isOverdue
        ? "Періодичний огляд прострочено"
        : "Періодичний огляд сьогодні",
      message: isOverdue
        ? `Огляд об’єкта «${object.name}» прострочено на ${state.overdueDays} ${getDayWord(
            state.overdueDays
          )}.`
        : `Об’єкт «${object.name}» потрібно оглянути сьогодні.`,
      detail: isOverdue
        ? `Прострочено на ${state.overdueDays} ${getDayWord(
            state.overdueDays
          )}`
        : "Огляд сьогодні",
      contextLabel:
        object.address ||
        object.name,
      href: `/objects/${object.id}`,
      date:
        object.next_supervision_date,
      overdueDays: isOverdue
        ? state.overdueDays
        : null,
      objectId: object.id,
    });
  }

  for (const item of warehouseItems) {
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

    if (
      !plan.isLowStock
    ) {
      continue;
    }

    const recommendation =
      plan.targetQuantity !==
        null &&
      plan.remainingRecommended !==
        null &&
      plan.remainingRecommended > 0
        ? ` Рекомендовано докупити ${formatWarehouseQuantity(
            plan.remainingRecommended
          )} ${item.unit}.`
        : "";
    const planningDetails = [
      plan.targetQuantity ===
      null
        ? "Цільовий запас не заданий"
        : `Ціль: ${formatWarehouseQuantity(
            plan.targetQuantity
          )} ${item.unit}`,
      plan.plannedIncoming > 0
        ? `Заплановано: ${formatWarehouseQuantity(
            plan.plannedIncoming
          )} ${item.unit}`
        : null,
      plan.remainingRecommended !==
          null &&
        plan.remainingRecommended > 0
        ? `Ще рекомендується: ${formatWarehouseQuantity(
            plan.remainingRecommended
          )} ${item.unit}`
        : null,
    ].filter(
      (value): value is string =>
        Boolean(value)
    );

    items.push({
      key: `warehouse-low-stock:${item.id}`,
      type: "low_stock",
      category: "warehouse",
      severity: "warning",
      timing: "current",
      title: "Низький залишок",
      message: `${item.name}: залишилось ${formatWarehouseQuantity(
        plan.currentQuantity
      )} ${item.unit}. Мінімум — ${formatWarehouseQuantity(
        plan.minimumQuantity
      )} ${item.unit}.${recommendation}`,
      detail:
        planningDetails.join(
          " · "
        ),
      contextLabel:
        item.category ||
        null,
      href: `/warehouse?item=${item.id}#warehouse-item-${item.id}`,
      date: null,
      overdueDays: null,
      warehouseItemId: item.id,
    });
  }

  for (const item of equipment) {
    const state =
      getEquipmentMaintenanceState(
        item.maintenance_interval_days,
        item.next_service_date,
        today
      );

    if (
      state.kind !== "today" &&
      state.kind !== "overdue"
    ) {
      continue;
    }

    const isOverdue =
      state.kind === "overdue";

    items.push({
      key: `equipment-maintenance:${item.id}`,
      type: isOverdue
        ? "equipment_maintenance_overdue"
        : "equipment_maintenance_today",
      category: "equipment",
      severity: isOverdue
        ? "critical"
        : "warning",
      timing: isOverdue
        ? "overdue"
        : "today",
      title: isOverdue
        ? "ТО техніки прострочено"
        : "ТО техніки сьогодні",
      message: isOverdue
        ? `Планове ТО техніки «${item.name}» прострочено на ${state.overdueDays} ${getDayWord(
            state.overdueDays
          )}.`
        : `Техніка «${item.name}» потребує планового ТО сьогодні.`,
      detail: isOverdue
        ? `Прострочено на ${state.overdueDays} ${getDayWord(
            state.overdueDays
          )}`
        : "ТО сьогодні",
      contextLabel:
        item.inventory_number ||
        item.category,
      href: "/equipment",
      date:
        item.next_service_date,
      overdueDays: isOverdue
        ? state.overdueDays
        : null,
      equipmentId: item.id,
    });
  }

  for (const item of paymentSchedules) {
    if (
      item.remainingAmount <= 0 ||
      (item.status !==
        "due_today" &&
        item.status !== "overdue")
    ) {
      continue;
    }

    const isOverdue =
      item.status === "overdue";
    const overdueDays =
      isOverdue
        ? getDateDifferenceInDays(
            item.due_date,
            today
          ) || 0
        : null;
    const objectName =
      item.object?.name ||
      `Об’єкт #${item.object_id}`;

    items.push({
      key: `client-payment-schedule:${item.id}`,
      type: isOverdue
        ? "client_payment_overdue"
        : "client_payment_due_today",
      category: "finance",
      severity: isOverdue
        ? "critical"
        : "warning",
      timing: isOverdue
        ? "overdue"
        : "today",
      title: isOverdue
        ? "Прострочений платіж"
        : "Платіж сьогодні",
      message: isOverdue
        ? `Етап «${item.title}» по об’єкту «${objectName}» прострочено на ${overdueDays} ${getDayWord(
            overdueDays || 0
          )}. Залишок — ${formatMoney(
            item.remainingAmount,
            currency
          )}.`
        : `Етап «${item.title}» по об’єкту «${objectName}» потрібно сплатити сьогодні. Залишок — ${formatMoney(
            item.remainingAmount,
            currency
          )}.`,
      detail: isOverdue
        ? `Прострочено на ${overdueDays} ${getDayWord(
            overdueDays || 0
          )}`
        : "До сплати сьогодні",
      contextLabel: objectName,
      href: `/objects/${item.object_id}#payment-schedule`,
      date: item.due_date,
      overdueDays,
      amount:
        item.remainingAmount,
      objectId: item.object_id,
      paymentScheduleItemId:
        item.id,
    });
  }

  for (const purchase of purchases) {
    if (
      purchase.status !==
      PLANNED_PURCHASE_STATUS
    ) {
      continue;
    }

    const quantity =
      Number(purchase.quantity);
    const unitPrice =
      Number(
        purchase.purchase_price
      );
    const total =
      Number.isFinite(quantity) &&
      Number.isFinite(unitPrice)
        ? quantity * unitPrice
        : 0;
    const itemName =
      purchase.item?.name ||
      "Матеріал";
    const unit =
      purchase.item?.unit ||
      "од.";

    items.push({
      key: `purchase-planned:${purchase.id}`,
      type: "planned_purchase",
      category: "purchases",
      severity: "info",
      timing: "current",
      title: "Запланована закупівля",
      message: `${itemName} — ${quantity} ${unit} на суму ${formatMoney(
        total,
        currency
      )}.`,
      detail: null,
      contextLabel:
        purchase.supplier
          ? `Постачальник: ${purchase.supplier}`
          : null,
      href: "/purchases",
      date: purchase.created_at,
      overdueDays: null,
      warehouseItemId:
        purchase.item_id,
      purchaseId: purchase.id,
    });
  }

  const uniqueItems =
    Array.from(
      new Map(
        items.map((item) => [
          item.key,
          item,
        ])
      ).values()
    );

  return sortNotifications(
    uniqueItems
  );
}

function getEmptyNotificationCenter(): NotificationCenterData {
  return {
    items: [],
    summary: {
      total: 0,
      critical: 0,
      today: 0,
    },
  };
}

export const getNotificationCenter =
  cache(
    async (): Promise<NotificationCenterData> => {
      const profile =
        await getCurrentUserProfile();

      if (!profile) {
        return getEmptyNotificationCenter();
      }

      const today =
        getKyivDateValue();
      const canViewTasks =
        canAccessSection(
          profile.role,
          "tasks"
        );
      const canViewObjects =
        canAccessSection(
          profile.role,
          "objects"
        );
      const canViewWarehouse =
        canAccessSection(
          profile.role,
          "warehouse"
        );
      const canViewPurchases =
        canAccessSection(
          profile.role,
          "purchases"
        );
      const canViewEquipment =
        canAccessSection(
          profile.role,
          "equipment"
        );
      const canViewFinance =
        canManageObjects(
          profile.role
        );

      const [
        tasks,
        objects,
        warehouseItems,
        purchases,
        settings,
        equipment,
        paymentSchedules,
      ] = await Promise.all([
        canViewTasks
          ? getAllTasks({
              dueDateBefore:
                today,
              excludeStatus:
                COMPLETED_TASK_STATUS,
              taskSource:
                MANUAL_TASK_SOURCE,
            })
          : Promise.resolve<
              TaskWithObject[]
            >([]),
        canViewObjects
          ? getObjects({
              status:
                PERIODIC_SUPERVISION_STATUS,
              nextSupervisionDateTo:
                today,
            })
          : Promise.resolve<
              ObjectItem[]
            >([]),
        canViewWarehouse
          ? getWarehouseItems()
          : Promise.resolve<
              WarehouseItem[]
            >([]),
        canViewPurchases
          ? getPlannedWarehousePurchases()
          : Promise.resolve<
              WarehousePurchase[]
            >([]),
        canViewPurchases
          ? getAppSettings()
          : Promise.resolve(null),
        canViewEquipment
          ? getEquipment()
          : Promise.resolve<
              Equipment[]
            >([]),
        canViewFinance
          ? getDueObjectPaymentSchedules(
              today
            )
          : Promise.resolve<
              ObjectPaymentScheduleWithObject[]
            >([]),
      ]);

      const paymentTotals =
        canViewFinance
          ? await getObjectPaymentTotals(
              paymentSchedules.map(
                (item) =>
                  item.object_id
              )
            )
          : new Map<number, number>();
      const schedulesByObject =
        new Map<
          number,
          ObjectPaymentScheduleWithObject[]
        >();

      for (const item of paymentSchedules) {
        const current =
          schedulesByObject.get(
            item.object_id
          ) || [];
        current.push(item);
        schedulesByObject.set(
          item.object_id,
          current
        );
      }

      const allocatedPaymentSchedules =
        Array.from(
          schedulesByObject.entries()
        ).flatMap(
          ([objectId, items]) =>
            calculateObjectPaymentSchedule(
              items,
              paymentTotals.get(
                objectId
              ) || 0,
              null,
              today
            ).items
        );

      const items =
        buildNotificationItems({
          today,
          currency:
            settings?.currency ||
            "UAH",
          tasks,
          objects,
          warehouseItems,
          purchases,
          equipment,
          paymentSchedules:
            allocatedPaymentSchedules,
        });

      return {
        items,
        summary:
          getNotificationSummary(
            items
          ),
      };
    }
  );
