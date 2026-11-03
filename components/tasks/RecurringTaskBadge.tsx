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
      className={`vc-status-info min-w-0 max-w-full ${
        compact
          ? "px-2 py-0.5 text-xs"
          : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">
        ↻ Повторюване
        {detail ? ` · ${detail}` : ""}
      </span>
    </span>
  );
}
