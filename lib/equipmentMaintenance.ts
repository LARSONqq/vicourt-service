import {
  getDateDifferenceInDays,
} from "@/lib/kyivDate";

import type {
  Equipment,
} from "@/types/equipment";

export type EquipmentMaintenanceState =
  | {
      kind: "unconfigured";
      overdueDays: null;
    }
  | {
      kind: "unscheduled";
      overdueDays: null;
    }
  | {
      kind: "scheduled";
      overdueDays: null;
    }
  | {
      kind: "today";
      overdueDays: null;
    }
  | {
      kind: "overdue";
      overdueDays: number;
    };

export type EquipmentMaintenanceDueReason =
  | "date"
  | "usage";

export type EquipmentMaintenanceEvaluation = {
  dateState: EquipmentMaintenanceState;
  dateDue: boolean;
  usageConfigured: boolean;
  usageDue: boolean;
  isDue: boolean;
  dueReasons: EquipmentMaintenanceDueReason[];
  usageRemaining: number | null;
  usageOverage: number | null;
};

export function getEquipmentMaintenanceState(
  maintenanceIntervalDays: number | null,
  nextServiceDate: string | null,
  today: string
): EquipmentMaintenanceState {
  if (
    !maintenanceIntervalDays ||
    maintenanceIntervalDays <= 0
  ) {
    return {
      kind: "unconfigured",
      overdueDays: null,
    };
  }

  if (!nextServiceDate) {
    return {
      kind: "unscheduled",
      overdueDays: null,
    };
  }

  const difference =
    getDateDifferenceInDays(
      nextServiceDate,
      today
    );

  if (difference === null) {
    return {
      kind: "unscheduled",
      overdueDays: null,
    };
  }

  if (difference > 0) {
    return {
      kind: "overdue",
      overdueDays:
        difference,
    };
  }

  if (difference === 0) {
    return {
      kind: "today",
      overdueDays: null,
    };
  }

  return {
    kind: "scheduled",
    overdueDays: null,
  };
}

export function getEquipmentMaintenanceLabel(
  state: EquipmentMaintenanceState
) {
  switch (state.kind) {
    case "unconfigured":
      return "ТО не налаштовано";

    case "unscheduled":
      return "ТО не заплановано";

    case "scheduled":
      return "Заплановано";

    case "today":
      return "ТО сьогодні";

    case "overdue":
      return `ТО прострочено на ${state.overdueDays} ${getDayWord(
        state.overdueDays
      )}`;
  }
}

/**
 * Canonical Equipment 2.1 due evaluator. Date and cumulative-usage criteria
 * are independent; maintenance is due as soon as either criterion is met.
 */
export function evaluateEquipmentMaintenance(
  equipment: Pick<
    Equipment,
    | "maintenance_interval_days"
    | "next_service_date"
    | "usage_type"
    | "current_usage"
    | "maintenance_interval_usage"
    | "next_maintenance_usage"
  >,
  today: string
): EquipmentMaintenanceEvaluation {
  const dateState =
    getEquipmentMaintenanceState(
      equipment.maintenance_interval_days,
      equipment.next_service_date,
      today
    );
  const dateDifference =
    equipment.next_service_date
      ? getDateDifferenceInDays(
          equipment.next_service_date,
          today
        )
      : null;
  const dateDue =
    dateDifference !== null &&
    dateDifference >= 0;
  const currentUsage =
    equipment.current_usage;
  const nextUsage =
    equipment.next_maintenance_usage;
  const usageConfigured =
    equipment.usage_type !==
      "none" &&
    equipment.maintenance_interval_usage !==
      null &&
    Number.isFinite(
      equipment.maintenance_interval_usage
    ) &&
    equipment.maintenance_interval_usage >
      0 &&
    nextUsage !== null &&
    Number.isFinite(nextUsage) &&
    nextUsage >= 0;
  const hasCurrentUsage =
    currentUsage !== null &&
    Number.isFinite(
      currentUsage
    ) &&
    currentUsage >= 0;
  const usageDifference =
    usageConfigured &&
    hasCurrentUsage &&
    nextUsage !== null &&
    currentUsage !== null
      ? nextUsage - currentUsage
      : null;
  const usageDue =
    usageDifference !== null &&
    usageDifference <= 0;
  const dueReasons: EquipmentMaintenanceDueReason[] = [];

  if (dateDue) {
    dueReasons.push("date");
  }

  if (usageDue) {
    dueReasons.push("usage");
  }

  return {
    dateState,
    dateDue,
    usageConfigured,
    usageDue,
    isDue:
      dateDue || usageDue,
    dueReasons,
    usageRemaining:
      usageDifference === null
        ? null
        : Math.max(
            usageDifference,
            0
          ),
    usageOverage:
      usageDifference === null
        ? null
        : Math.max(
            -usageDifference,
            0
          ),
  };
}

export function getDayWord(
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
