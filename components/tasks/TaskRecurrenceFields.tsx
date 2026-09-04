"use client";

import type {
  TaskRecurrenceType,
} from "@/types/taskTemplate";

type Props = {
  idPrefix?: string;
  allowNone?: boolean;
  value: TaskRecurrenceType;
  customInterval: string;
  onChange: (
    value: TaskRecurrenceType
  ) => void;
  onCustomIntervalChange: (
    value: string
  ) => void;
};

export default function TaskRecurrenceFields({
  idPrefix = "task",
  allowNone = true,
  value,
  customInterval,
  onChange,
  onCustomIntervalChange,
}: Props) {
  const typeId = `${idPrefix}-recurrence-type`;
  const intervalId = `${idPrefix}-recurrence-interval`;

  return (
    <div className="min-w-0 rounded-xl border bg-gray-50 p-3 sm:p-4">
      <label
        htmlFor={typeId}
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        Повторювати
      </label>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          id={typeId}
          name="recurrence_type"
          value={value}
          onChange={(event) =>
            onChange(
              event.target
                .value as TaskRecurrenceType
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          {allowNone && (
            <option value="none">Ніколи</option>
          )}
          <option value="daily">Щодня</option>
          <option value="weekly">Щотижня</option>
          <option value="monthly">Щомісяця</option>
          <option value="custom">Кожні N днів</option>
        </select>

        {value === "custom" && (
          <div className="min-w-0">
            <label
              htmlFor={intervalId}
              className="sr-only"
            >
              Інтервал у днях
            </label>
            <input
              id={intervalId}
              type="number"
              name="recurrence_interval"
              min="1"
              step="1"
              inputMode="numeric"
              value={customInterval}
              onChange={(event) =>
                onCustomIntervalChange(
                  event.target.value
                )
              }
              placeholder="Наприклад, 14"
              required
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            />
          </div>
        )}
      </div>

      {value !== "custom" && (
        <input
          type="hidden"
          name="recurrence_interval"
          value={value === "none" ? "" : "1"}
        />
      )}

      <p className="mt-2 text-xs leading-5 text-gray-500">
        {value === "none"
          ? "Буде створено одне звичайне завдання."
          : "Термін виконання стане опорною датою серії. Наступне завдання створиться після виконання поточного."}
      </p>
    </div>
  );
}
