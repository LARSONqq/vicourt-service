"use client";

import { useState } from "react";

import { updateWorkLog } from "@/app/actions/workLogActions";

import type { Employee } from "@/types/employee";
import type { WorkLog } from "@/types/workLog";

type WorkLogWithEmployee =
  WorkLog & {
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
  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

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

  const selectedEmployeeId =
    workLog.employee_id
      ? String(
          workLog.employee_id
        )
      : "";

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateWorkLog(
        formData
      );

      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити запис."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-xl border bg-gray-50 p-3 sm:p-4"
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
            : workLog.workers ||
              ""
        }
      />

      {/* HEADER */}
      <div>
        <h3 className="text-base font-semibold text-gray-800">
          Редагування запису
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Зміни інформацію про виконану роботу
        </p>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* DATE + EMPLOYEE */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата
          </label>

          <input
            type="date"
            name="work_date"
            defaultValue={
              workLog.work_date
            }
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
            defaultValue={
              selectedEmployeeId
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Не вибрано
            </option>

            {sortedEmployees.map(
              (employee) => (
                <option
                  key={
                    employee.id
                  }
                  value={
                    employee.id
                  }
                >
                  {
                    employee.last_name
                  }{" "}
                  {
                    employee.first_name
                  }
                  {employee.position
                    ? ` — ${employee.position}`
                    : ""}
                </option>
              )
            )}
          </select>

          {!workLog.employee_id &&
            workLog.workers && (
              <div className="mt-2 rounded-lg bg-orange-50 px-3 py-2">
                <p className="text-xs text-orange-700">
                  Раніше було вказано:
                </p>

                <p className="mt-1 break-words text-sm font-medium text-orange-800">
                  {workLog.workers}
                </p>
              </div>
            )}

          {employees.length ===
            0 && (
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
          defaultValue={
            workLog.description
          }
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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
            defaultValue={
              workLog.hours
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />

          <span className="flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-medium text-gray-600">
            год.
          </span>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg border bg-white px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 sm:w-fit"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}