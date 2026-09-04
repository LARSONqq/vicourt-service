import {
  getTaskRecurrenceLabel,
} from "@/lib/taskRecurrence";

import type {
  TaskRecurrenceType,
} from "@/types/taskTemplate";

type Props = {
  recurrenceType?: TaskRecurrenceType;
  recurrenceInterval?: number | null;
  compact?: boolean;
};

export default function RecurringTaskBadge({
  recurrenceType,
  recurrenceInterval = null,
  compact = false,
}: Props) {
  const detail = recurrenceType
    ? getTaskRecurrenceLabel(
        recurrenceType,
        recurrenceInterval
      )
    : null;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full bg-teal-50 font-medium text-teal-700 ${
        compact
          ? "px-2 py-0.5 text-[10px]"
          : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className="truncate">
        ↻ Повторюване
        {detail ? ` · ${detail}` : ""}
      </span>
    </span>
  );
}
