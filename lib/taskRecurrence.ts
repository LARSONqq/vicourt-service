import {
  isValidDateValue,
} from "@/lib/kyivDate";

import type {
  TaskRecurrenceType,
} from "@/types/taskTemplate";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const DAY_MILLISECONDS =
  24 * 60 * 60 * 1000;

function parseDateValue(
  value: string
): DateParts {
  if (!isValidDateValue(value)) {
    throw new Error(
      "Некоректна дата повторення завдання."
    );
  }

  const [year, month, day] =
    value.split("-").map(Number);

  return { year, month, day };
}

function formatDateParts(
  parts: DateParts
) {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function getDaysInMonth(
  year: number,
  month: number
) {
  return new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();
}

function addCalendarDays(
  value: string,
  days: number
) {
  const parts = parseDateValue(value);
  const timestamp =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day
    ) +
    days * DAY_MILLISECONDS;
  const date = new Date(timestamp);

  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function getDayStep(
  recurrenceType: TaskRecurrenceType,
  recurrenceInterval: number | null
) {
  if (recurrenceType === "daily") return 1;
  if (recurrenceType === "weekly") return 7;
  if (
    recurrenceType === "custom" &&
    Number.isInteger(recurrenceInterval) &&
    (recurrenceInterval ?? 0) > 0
  ) {
    return recurrenceInterval as number;
  }

  return null;
}

export function getTaskRecurrenceDueDate(input: {
  anchorDueDate: string;
  recurrenceType: Exclude<TaskRecurrenceType, "none">;
  recurrenceInterval: number | null;
  sequence: number;
}) {
  const {
    anchorDueDate,
    recurrenceType,
    recurrenceInterval,
    sequence,
  } = input;

  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error(
      "Некоректний номер повторення завдання."
    );
  }

  const dayStep = getDayStep(
    recurrenceType,
    recurrenceInterval
  );

  if (dayStep !== null) {
    return addCalendarDays(
      anchorDueDate,
      (sequence - 1) * dayStep
    );
  }

  if (recurrenceType !== "monthly") {
    throw new Error(
      "Некоректна періодичність завдання."
    );
  }

  const anchor = parseDateValue(
    anchorDueDate
  );
  const monthOffset = sequence - 1;
  const absoluteMonth =
    anchor.year * 12 +
    (anchor.month - 1) +
    monthOffset;
  const year = Math.floor(
    absoluteMonth / 12
  );
  const month =
    (absoluteMonth % 12) + 1;

  return formatDateParts({
    year,
    month,
    day: Math.min(
      anchor.day,
      getDaysInMonth(year, month)
    ),
  });
}

export function getNextTaskRecurrence(
  input: {
    anchorDueDate: string;
    recurrenceType: Exclude<TaskRecurrenceType, "none">;
    recurrenceInterval: number | null;
    currentSequence: number;
    completedOn: string;
  }
) {
  parseDateValue(input.completedOn);
  let sequence =
    input.currentSequence + 1;

  if (
    !Number.isInteger(sequence) ||
    sequence <= 1
  ) {
    throw new Error(
      "Некоректний поточний номер повторення."
    );
  }

  for (
    let attempts = 0;
    attempts < 100_000;
    attempts += 1
  ) {
    const dueDate =
      getTaskRecurrenceDueDate({
        anchorDueDate:
          input.anchorDueDate,
        recurrenceType:
          input.recurrenceType,
        recurrenceInterval:
          input.recurrenceInterval,
        sequence,
      });

    if (
      dueDate >
      input.completedOn
    ) {
      return {
        sequence,
        dueDate,
      };
    }

    sequence += 1;
  }

  throw new Error(
    "Не вдалося розрахувати наступне повторення завдання."
  );
}

export function getTaskRecurrenceLabel(
  recurrenceType: TaskRecurrenceType,
  recurrenceInterval: number | null
) {
  switch (recurrenceType) {
    case "daily":
      return "Щодня";
    case "weekly":
      return "Щотижня";
    case "monthly":
      return "Щомісяця";
    case "custom":
      return `Кожні ${recurrenceInterval ?? "—"} днів`;
    default:
      return "Не повторюється";
  }
}
