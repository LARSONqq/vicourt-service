"use client";

import { createWorkLog } from "@/app/actions/workLogActions";

import type { Employee } from "@/types/employee";

type Props = {
  objectId: number;
  employees?: Employee[];
};

function getToday() {
  const today = new Date();

  const year =
    today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    today.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function AddWorkLogForm({
  objectId,
  employees = [],
}: Props) {
  const sortedEmployees = [
    ...employees,
  ].sort(
    (
      firstEmployee,
      secondEmployee
    ) =>
      `${firstEmployee.last_name} ${firstEmployee.first_name}`.localeCompare(
        `${secondEmployee.last_name} ${secondEmployee.first_name}`,
        "uk"
      )
  );

  return (
    <form
      action={createWorkLog}
      className="min-w-0 space-y-5"
    >
      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      {/* HEADER */}
      <div>
        <h3 className="text-base font-semibold text-gray-800">
          Новий запис
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Додай інформацію про виконану роботу
        </p>
      </div>

      {/* DATE + EMPLOYEE */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата
          </label>

          <input
            type="date"
            name="work_date"
            defaultValue={getToday()}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Працівник
          </label>

          <select
            name="employee_id"
            defaultValue=""
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Не вибрано
            </option>

            {sortedEmployees.map(
              (employee) => (
                <option
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.last_name}{" "}
                  {employee.first_name}
                  {employee.position
                    ? ` — ${employee.position}`
                    : ""}
                </option>
              )
            )}
          </select>

          {employees.length === 0 && (
            <p className="mt-2 text-xs text-orange-600">
              Працівників поки немає у списку.
            </p>
          )}
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Виконана робота
        </label>

        <textarea
          name="description"
          rows={4}
          placeholder="Наприклад: висадили туї та підготували ґрунт"
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          required
        />
      </div>

      {/* HOURS */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Кількість годин
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:max-w-sm">
          <input
            type="number"
            name="hours"
            inputMode="decimal"
            min="0"
            step="0.5"
            defaultValue="0"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />

          <span className="flex min-h-11 items-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-600">
            год.
          </span>
        </div>
      </div>

      {/* SAVE */}
      <div className="border-t pt-4">
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 sm:w-fit"
        >
          Зберегти запис
        </button>
      </div>
    </form>
  );
}