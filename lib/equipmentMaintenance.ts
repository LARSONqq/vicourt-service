import {
  getDateDifferenceInDays,
} from "@/lib/kyivDate";

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
