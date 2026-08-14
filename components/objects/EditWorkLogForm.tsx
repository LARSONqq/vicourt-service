"use client";

import { updateWorkLog } from "@/app/actions/workLogActions";
import type { Employee } from "@/types/employee";
import type { WorkLog } from "@/types/workLog";

type WorkLogWithEmployee = WorkLog & {
  employee_id?: number | null;
};

type Props = {
  workLog: WorkLogWithEmployee;
  objectId: number;
  employees?: Employee[];
  onCancel: () => void;
};

export default function EditWorkLogForm({
  workLog,
  objectId,
  employees = [],
  onCancel,
}: Props) {
  const sortedEmployees = [...employees].sort(
    (firstEmployee, secondEmployee) =>
      `${firstEmployee.last_name} ${firstEmployee.first_name}`.localeCompare(
        `${secondEmployee.last_name} ${secondEmployee.first_name}`,
        "uk"
      )
  );

  const selectedEmployeeId = workLog.employee_id
    ? String(workLog.employee_id)
    : "";

  async function handleSubmit(formData: FormData) {
    await updateWorkLog(formData);
    onCancel();
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-4 rounded-lg border bg-gray-50 p-4"
    >
      <input
        type="hidden"
        name="work_log_id"
        value={workLog.id}
      />

      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      <input
        type="hidden"
        name="workers"
        value={
          workLog.employee_id
            ? ""
            : workLog.workers || ""
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Дата
          </label>

          <input
            type="date"
            name="work_date"
            defaultValue={workLog.work_date}
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
            defaultValue={selectedEmployeeId}
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

          {!workLog.employee_id &&
            workLog.workers && (
              <p className="mt-2 text-sm text-gray-500">
                Старий запис: {workLog.workers}
              </p>
            )}

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
          defaultValue={workLog.description}
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
          defaultValue={workLog.hours}
          className="w-full rounded-lg border bg-white p-3 md:max-w-xs"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
        >
          Зберегти зміни
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-100"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}