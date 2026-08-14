"use client";

import { useState } from "react";
import { createEquipment } from "@/app/actions/equipmentActions";
import {
  equipmentCategories,
  equipmentStatuses,
} from "@/constants/equipment";
import type { Employee } from "@/types/employee";

type Props = {
  employees: Employee[];
  onCreated: () => void;
};

export default function AddEquipmentForm({
  employees,
  onCreated,
}: Props) {
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createEquipment(formData);
      onCreated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося додати техніку."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Назва техніки
        </label>

        <input
          type="text"
          name="name"
          placeholder="Наприклад: Газонокосарка Husqvarna LC 247"
          className="w-full rounded-lg border bg-white p-3"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Категорія
          </label>

          <select
            name="category"
            defaultValue=""
            className="w-full rounded-lg border bg-white p-3"
            required
          >
            <option value="" disabled>
              Обери категорію
            </option>

            {equipmentCategories.map((category) => (
              <option key={category} value={category}>
                {category}
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
            defaultValue="Справна"
            className="w-full rounded-lg border bg-white p-3"
            required
          >
            {equipmentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Інвентарний номер
          </label>

          <input
            type="text"
            name="inventory_number"
            placeholder="Автоматично, якщо не вказати"
            className="w-full rounded-lg border bg-white p-3 uppercase"
          />

          <p className="mt-2 text-xs text-gray-500">
            Якщо залишити поле порожнім, номер створиться
            автоматично.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Відповідальний працівник
          </label>

          <select
            name="responsible_employee_id"
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
              </option>
            ))}
          </select>

          {employees.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              У розділі «Працівники» ще немає записів.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Поточна локація
          </label>

          <input
            type="text"
            name="location"
            placeholder="Склад, офіс або об’єкт"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Дата придбання
          </label>

          <input
            type="date"
            name="purchase_date"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Наступне обслуговування
          </label>

          <input
            type="date"
            name="next_service_date"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Примітки
        </label>

        <textarea
          name="notes"
          rows={4}
          placeholder="Стан техніки, комплектація, особливості використання"
          className="w-full resize-none rounded-lg border bg-white p-3"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Збереження..."
          : "Додати техніку"}
      </button>
    </form>
  );
}