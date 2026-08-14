"use client";

import { useState } from "react";
import { updateEmployee } from "@/app/actions/employeeActions";
import {
  employmentTypes,
  employeeStatuses,
  employeePositions,
} from "@/constants/employees";
import type { Employee } from "@/types/employee";

type Props = {
  employee: Employee;
  onCancel: () => void;
};

export function EditEmployeeForm({
  employee,
  onCancel,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateEmployee(formData);
      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити працівника."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-5 rounded-xl border bg-gray-50 p-5"
    >
      <input
        type="hidden"
        name="employee_id"
        value={employee.id}
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Ім’я
          </label>

          <input
            type="text"
            name="first_name"
            defaultValue={employee.first_name}
            className="w-full rounded-lg border bg-white p-3"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Прізвище
          </label>

          <input
            type="text"
            name="last_name"
            defaultValue={employee.last_name}
            className="w-full rounded-lg border bg-white p-3"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Телефон
          </label>

          <input
            type="tel"
            name="phone"
            defaultValue={employee.phone || ""}
            placeholder="+380..."
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Email
          </label>

          <input
            type="email"
            name="email"
            defaultValue={employee.email || ""}
            placeholder="example@email.com"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Посада
          </label>

          <select
            name="position"
            defaultValue={employee.position || ""}
            className="w-full rounded-lg border bg-white p-3"
          >
            <option value="">Не вказувати</option>

            {employeePositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Тип роботи
          </label>

          <select
            name="employment_type"
            defaultValue={employee.employment_type}
            className="w-full rounded-lg border bg-white p-3"
            required
          >
            {employmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Статус
          </label>

          <select
            name="status"
            defaultValue={employee.status}
            className="w-full rounded-lg border bg-white p-3"
            required
          >
            {employeeStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Дата прийняття на роботу
        </label>

        <input
          type="date"
          name="hire_date"
          defaultValue={employee.hire_date || ""}
          className="w-full rounded-lg border bg-white p-3 md:max-w-md"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Примітки
        </label>

        <textarea
          name="notes"
          rows={4}
          defaultValue={employee.notes || ""}
          className="w-full resize-none rounded-lg border bg-white p-3"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border bg-white px-5 py-3 font-medium hover:bg-gray-100 disabled:opacity-60"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}