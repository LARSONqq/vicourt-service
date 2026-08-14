"use client";

import { useState } from "react";
import { createObjectTask } from "@/app/actions/taskActions";
import type { Employee } from "@/types/employee";

type Props = {
  objectId: number;
  employees: Employee[];
};

export default function AddTaskForm({
  objectId,
  employees,
}: Props) {
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createObjectTask(formData);
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
      className="space-y-4"
    >
      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Назва завдання
        </label>

        <input
          type="text"
          name="title"
          placeholder="Наприклад: підготувати ділянку до висаджування"
          className="w-full rounded-lg border bg-white p-3"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Опис
        </label>

        <textarea
          name="description"
          rows={4}
          placeholder="Додаткова інформація про завдання"
          className="w-full resize-none rounded-lg border bg-white p-3"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Термін виконання
          </label>

          <input
            type="date"
            name="due_date"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Відповідальний працівник
          </label>

          <select
            name="assigned_employee_id"
            defaultValue=""
            className="w-full rounded-lg border bg-white p-3"
          >
            <option value="">
              Не призначати
            </option>

            {employees.map((employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {employee.last_name}{" "}
                {employee.first_name}
                {employee.position
                  ? ` — ${employee.position}`
                  : ""}
                {employee.status !== "Активний"
                  ? ` (${employee.status})`
                  : ""}
              </option>
            ))}
          </select>

          {employees.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Працівників ще не додано.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Статус
          </label>

          <select
            name="status"
            defaultValue="Заплановано"
            className="w-full rounded-lg border bg-white p-3"
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Збереження..."
          : "Зберегти завдання"}
      </button>
    </form>
  );
}