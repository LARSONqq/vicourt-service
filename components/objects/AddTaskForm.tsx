"use client";

import { useState } from "react";

import { createObjectTask } from "@/app/actions/taskActions";
import TaskRecurrenceFields from "@/components/tasks/TaskRecurrenceFields";

import type { Employee } from "@/types/employee";
import type {
  TaskRecurrenceType,
} from "@/types/taskTemplate";

type Props = {
  objectId: number;
  employees: Employee[];
  canManageRecurrence?: boolean;
};

export default function AddTaskForm({
  objectId,
  employees,
  canManageRecurrence = false,
}: Props) {
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");
  const [recurrenceType, setRecurrenceType] =
    useState<TaskRecurrenceType>("none");
  const [customInterval, setCustomInterval] =
    useState("14");

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createObjectTask(
        formData
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося створити завдання."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-4"
    >
      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      <div>
        <h3 className="text-base font-semibold text-gray-800">
          Нове завдання
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Заповни основну інформацію
          про завдання
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Назва завдання
        </label>

        <input
          type="text"
          name="title"
          placeholder="Наприклад: підготувати ділянку"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          required
        />
      </div>

      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Опис
        </label>

        <textarea
          name="description"
          rows={4}
          placeholder="Додаткова інформація про завдання"
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Термін виконання
          </label>

          <input
            type="date"
            name="due_date"
            required={
              recurrenceType !== "none"
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Відповідальний
          </label>

          <select
            name="assigned_employee_id"
            defaultValue=""
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Не призначати
            </option>

            {employees.map(
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
                  {employee.status !==
                  "Активний"
                    ? ` (${employee.status})`
                    : ""}
                </option>
              )
            )}
          </select>

          {employees.length ===
            0 && (
            <p className="mt-2 text-xs text-gray-500">
              Працівників ще не
              додано.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Статус
          </label>

          {recurrenceType !== "none" && (
            <input
              type="hidden"
              name="status"
              value="Заплановано"
            />
          )}

          <select
            name="status"
            defaultValue="Заплановано"
            disabled={
              recurrenceType !== "none"
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="Заплановано">
              Заплановано
            </option>

            <option value="В роботі">
              В роботі
            </option>

            <option value="Виконано">
              Виконано
            </option>
          </select>
        </div>
      </div>

      {canManageRecurrence && (
        <TaskRecurrenceFields
          idPrefix={`object-${objectId}-task`}
          value={recurrenceType}
          customInterval={customInterval}
          onChange={setRecurrenceType}
          onCustomIntervalChange={
            setCustomInterval
          }
        />
      )}

      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти завдання"}
        </button>
      </div>
    </form>
  );
}
