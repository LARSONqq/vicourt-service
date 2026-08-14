"use client";

import { createWorkLog } from "@/app/actions/workLogActions";
import type { Employee } from "@/types/employee";

type Props = {
  objectId: number;
  employees?: Employee[];
};

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
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
  const sortedEmployees = [...employees].sort(
    (firstEmployee, secondEmployee) =>
      `${firstEmployee.last_name} ${firstEmployee.first_name}`.localeCompare(
        `${secondEmployee.last_name} ${secondEmployee.first_name}`,
        "uk"
      )
  );

  return (
    <form
      action={createWorkLog}
      className="space-y-4"
    >
      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Дата
          </label>

          <input
            type="date"
            name="work_date"
            defaultValue={getToday()}
            className="w-full rounded-lg border bg-white p-3"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Працівник
          </label>

          <select
            name="employee_id"
            defaultValue=""
            className="w-full rounded-lg border bg-white p-3"
          >
            <option value="">
              Не вибрано
            </option>

            {sortedEmployees.map((employee) => (
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
            ))}
          </select>

          {employees.length === 0 && (
            <p className="mt-2 text-sm text-orange-600">
              Список працівників поки не передано
              у форму.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Виконана робота
        </label>

        <textarea
          name="description"
          rows={4}
          placeholder="Наприклад: висадили туї та підготували ґрунт"
          className="w-full resize-none rounded-lg border bg-white p-3"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Кількість годин
        </label>

        <input
          type="number"
          name="hours"
          min="0"
          step="0.5"
          defaultValue="0"
          className="w-full rounded-lg border bg-white p-3 md:max-w-xs"
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
      >
        Зберегти запис
      </button>
    </form>
  );
}