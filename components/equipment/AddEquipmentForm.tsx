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
  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createEquipment(
        formData
      );

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
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5"
    >
      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* NAME */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Назва техніки
        </label>

        <input
          type="text"
          name="name"
          placeholder="Наприклад: Газонокосарка Husqvarna LC 247"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          required
        />
      </div>

      {/* CATEGORY + STATUS */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Категорія
          </label>

          <select
            name="category"
            defaultValue=""
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          >
            <option
              value=""
              disabled
            >
              Обери категорію
            </option>

            {equipmentCategories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Статус
          </label>

          <select
            name="status"
            defaultValue="Справна"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          >
            {equipmentStatuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* INVENTORY + EMPLOYEE + LOCATION */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Інвентарний номер
          </label>

          <input
            type="text"
            name="inventory_number"
            placeholder="Автоматично, якщо не вказати"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 uppercase outline-none transition placeholder:normal-case placeholder:text-gray-400 focus:border-green-600"
          />

          <p className="mt-2 text-xs leading-4 text-gray-500">
            Якщо залишити поле
            порожнім, номер створиться
            автоматично.
          </p>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Відповідальний працівник
          </label>

          <select
            name="responsible_employee_id"
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
                </option>
              )
            )}
          </select>

          {employees.length ===
            0 && (
            <p className="mt-2 text-xs leading-4 text-gray-500">
              У розділі
              «Працівники» ще немає
              записів.
            </p>
          )}
        </div>

        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Поточна локація
          </label>

          <input
            type="text"
            name="location"
            placeholder="Склад, офіс або об’єкт"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>
      </div>

      {/* PURCHASE DATE */}
      <div className="min-w-0 sm:max-w-sm">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата придбання
          </label>

          <input
            type="date"
            name="purchase_date"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>
      </div>

      {/* PLANNED MAINTENANCE */}
      <fieldset className="min-w-0 rounded-xl border bg-gray-50 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-gray-900">
          Планове ТО
        </legend>

        <p className="mb-4 text-xs leading-5 text-gray-500">
          Необов’язково. Після виконання ТО наступна дата розраховуватиметься за вказаним інтервалом.
        </p>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Періодичність ТО, днів
            </label>

            <input
              type="number"
              name="maintenance_interval_days"
              inputMode="numeric"
              min="1"
              step="1"
              list="add-maintenance-intervals"
              placeholder="Наприклад: 90"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            />

            <datalist id="add-maintenance-intervals">
              <option value="30" />
              <option value="90" />
              <option value="180" />
              <option value="365" />
            </datalist>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Наступне ТО
            </label>

            <input
              type="date"
              name="next_service_date"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            />
          </div>
        </div>
      </fieldset>

      {/* NOTES */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Примітки
        </label>

        <textarea
          name="notes"
          rows={4}
          placeholder="Стан техніки, комплектація, особливості використання"
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      {/* SAVE */}
      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Додати техніку"}
        </button>
      </div>
    </form>
  );
}
