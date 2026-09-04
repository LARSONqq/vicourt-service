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

export type EquipmentMaintenanceOverallKind =
  | "unconfigured"
  | "scheduled"
  | "today"
  | "due"
  | "overdue";

export function getEquipmentUsageTypeLabel(
  usageType: Equipment["usage_type"]
) {
  switch (usageType) {
    case "hours":
      return "Мотогодини";

    case "km":
      return "Кілометри";

    case "none":
      return "Не використовується";
  }
}

export function getEquipmentUsageUnit(
  usageType: Equipment["usage_type"]
) {
  switch (usageType) {
    case "hours":
      return "мотогод.";

    case "km":
      return "км";

    case "none":
      return null;
  }
}

export function formatEquipmentUsage(
  value: number | null,
  usageType: Equipment["usage_type"]
) {
  const unit = getEquipmentUsageUnit(usageType);

  if (
    value === null ||
    !Number.isFinite(value) ||
    !unit
  ) {
    return "Не вказано";
  }

  return `${new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 3,
  }).format(value)} ${unit}`;
}

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

export function getEquipmentDateMaintenanceLabel(
  equipment: Pick<
    Equipment,
    | "maintenance_interval_days"
    | "next_service_date"
  >,
  today: string
) {
  const state = getEquipmentMaintenanceState(
    equipment.maintenance_interval_days,
    equipment.next_service_date,
    today
  );

  if (
    state.kind === "scheduled" &&
    equipment.next_service_date
  ) {
    const difference = getDateDifferenceInDays(
      equipment.next_service_date,
      today
    );
    const days = difference === null
      ? null
      : Math.abs(difference);

    if (days !== null) {
      return `ТО через ${days} ${getDayWord(days)}`;
    }
  }

  if (state.kind === "overdue") {
    return `ТО прострочене за датою на ${state.overdueDays} ${getDayWord(
      state.overdueDays
    )}`;
  }

  return getEquipmentMaintenanceLabel(state);
}

export function getEquipmentUsageMaintenanceLabel(
  equipment: Pick<
    Equipment,
    | "usage_type"
    | "current_usage"
    | "maintenance_interval_usage"
    | "next_maintenance_usage"
  >
) {
  const unit = getEquipmentUsageUnit(
    equipment.usage_type
  );

  if (
    !unit ||
    equipment.maintenance_interval_usage === null ||
    equipment.next_maintenance_usage === null
  ) {
    return "ТО за напрацюванням не налаштовано";
  }

  if (equipment.current_usage === null) {
    return "Додайте поточний показник";
  }

  const remaining =
    equipment.next_maintenance_usage -
    equipment.current_usage;

  if (remaining <= 0) {
    return "ТО потрібне за напрацюванням";
  }

  return `До ТО: ${formatEquipmentUsage(
    remaining,
    equipment.usage_type
  )}`;
}

export function getEquipmentMaintenanceOverallKind(
  evaluation: EquipmentMaintenanceEvaluation
): EquipmentMaintenanceOverallKind {
  if (evaluation.dateState.kind === "overdue") {
    return "overdue";
  }

  if (evaluation.usageDue) {
    return "due";
  }

  if (evaluation.dateState.kind === "today") {
    return "today";
  }

  if (
    evaluation.dateState.kind === "scheduled" ||
    evaluation.usageConfigured
  ) {
    return "scheduled";
  }

  return "unconfigured";
}

export function getEquipmentMaintenanceOverallLabel(
  evaluation: EquipmentMaintenanceEvaluation
) {
  const kind = getEquipmentMaintenanceOverallKind(
    evaluation
  );

  switch (kind) {
    case "overdue":
      return "ТО прострочене";

    case "due":
      return "ТО потрібне";

    case "today":
      return "ТО сьогодні";

    case "scheduled":
      return "ТО заплановано";

    case "unconfigured":
      return "ТО не налаштовано";
  }
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
