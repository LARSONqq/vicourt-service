import "server-only";

import {
  cache,
} from "react";

import {
  MANUAL_TASK_SOURCE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import {
  canAccessSection,
} from "@/lib/auth/permissions";
import {
  getDateDifferenceInDays,
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  getObjectSupervisionState,
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import {
  getObjects,
} from "@/services/objectService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  getWarehousePurchases,
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
};

const AUTOMATIC_PUSH_TYPES =
  new Set<AutomaticPushNotificationType>([
    "overdue_task",
    "supervision_today",
    "supervision_overdue",
    "low_stock",
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
  }
}

function getDayWord(
  value: number
) {
  const absoluteValue =
    Math.abs(value);
  const lastTwoDigits =
    absoluteValue % 100;
  const lastDigit =
    absoluteValue % 10;

  if (
    lastTwoDigits >= 11 &&
    lastTwoDigits <= 14
  ) {
    return "днів";
  }

  if (lastDigit === 1) {
    return "день";
  }

  if (
    lastDigit >= 2 &&
    lastDigit <= 4
  ) {
    return "дні";
  }

  return "днів";
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
}: NotificationSourceData): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const task of tasks) {
    if (
      task.task_source ===
        SUPERVISION_TASK_SOURCE ||
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
        task.object?.name ||
        null,
      href: "/task",
      date: task.due_date,
      overdueDays,
      objectId:
        task.object?.id ??
        task.object_id,
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
    const quantity =
      Number(item.quantity);
    const minimum =
      Number(
        item.min_quantity
      );

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(minimum) ||
      quantity > minimum
    ) {
      continue;
    }

    items.push({
      key: `warehouse-low-stock:${item.id}`,
      type: "low_stock",
      category: "warehouse",
      severity: "warning",
      timing: "current",
      title: "Низький залишок",
      message: `${item.name} — залишилось ${quantity} ${item.unit}.`,
      detail: `Мінімальний залишок: ${minimum} ${item.unit}`,
      contextLabel:
        item.category ||
        null,
      href: "/warehouse",
      date: null,
      overdueDays: null,
      warehouseItemId: item.id,
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

      const [
        tasks,
        objects,
        warehouseItems,
        purchases,
        settings,
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
          ? getWarehousePurchases({
              status:
                PLANNED_PURCHASE_STATUS,
            })
          : Promise.resolve<
              WarehousePurchase[]
            >([]),
        canViewPurchases
          ? getAppSettings()
          : Promise.resolve(null),
      ]);

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
