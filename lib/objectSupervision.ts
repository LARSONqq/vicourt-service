import {
  getDateDifferenceInDays,
  isValidDateValue,
} from "@/lib/kyivDate";

export const PERIODIC_SUPERVISION_STATUS =
  "Під періодичним наглядом";

export type ObjectSupervisionState =
  | {
      kind: "not_planned";
      overdueDays: 0;
    }
  | {
      kind: "planned";
      overdueDays: 0;
    }
  | {
      kind: "today";
      overdueDays: 0;
    }
  | {
      kind: "overdue";
      overdueDays: number;
    };

export function getObjectSupervisionState(
  nextDate: string | null,
  today: string
): ObjectSupervisionState {
  if (
    !nextDate ||
    !isValidDateValue(
      nextDate
    ) ||
    !isValidDateValue(today)
  ) {
    return {
      kind: "not_planned",
      overdueDays: 0,
    };
  }

  if (nextDate === today) {
    return {
      kind: "today",
      overdueDays: 0,
    };
  }

  if (nextDate > today) {
    return {
      kind: "planned",
      overdueDays: 0,
    };
  }

  return {
    kind: "overdue",
    overdueDays:
      getDateDifferenceInDays(
        nextDate,
        today
      ) || 0,
  };
}
