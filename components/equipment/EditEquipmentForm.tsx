"use client";

import { useState } from "react";

import { updateEquipment } from "@/app/actions/equipmentActions";

import {
  equipmentCategories,
  equipmentStatuses,
} from "@/constants/equipment";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";

type Props = {
  equipment: Equipment;
  employees: Employee[];
  onCancel: () => void;
};

export function EditEquipmentForm({
  equipment,
  employees,
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

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateEquipment(
        formData
      );

      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити техніку."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-xl border bg-gray-50 p-3 sm:p-5"
    >
      <input
        type="hidden"
        name="equipment_id"
        value={equipment.id}
      />

      {/* HEADER */}
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
          Редагування техніки
        </h3>

        <p className="mt-1 break-words text-sm text-gray-500">
          {equipment.name}
        </p>
      </div>

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
          defaultValue={
            equipment.name
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          required
        />
      </div>

      {/* CATEGORY + STATUS + INVENTORY */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Категорія
          </label>

          <select
            name="category"
            defaultValue={
              equipment.category ||
              ""
            }
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
            defaultValue={
              equipment.status
            }
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

        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Інвентарний номер
          </label>

          <input
            type="text"
            name="inventory_number"
            defaultValue={
              equipment.inventory_number ||
              ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 uppercase outline-none transition focus:border-green-600"
            required
          />

          <p className="mt-2 text-xs leading-4 text-gray-500">
            Інвентарний номер має
            бути унікальним.
          </p>
        </div>
      </div>

      {/* RESPONSIBLE + LOCATION */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Відповідальний працівник
          </label>

          <select
            name="responsible_employee_id"
            defaultValue={
              equipment.responsible_employee_id
                ? String(
                    equipment.responsible_employee_id
                  )
                : ""
            }
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
            <p className="mt-2 text-xs text-gray-500">
              Працівників ще немає.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Поточна локація
          </label>

          <input
            type="text"
            name="location"
            defaultValue={
              equipment.location ||
              ""
            }
            placeholder="Склад, офіс або об’єкт"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>
      </div>

      {/* DATES */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата придбання
          </label>

          <input
            type="date"
            name="purchase_date"
            defaultValue={
              equipment.purchase_date ||
              ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Наступне обслуговування
          </label>

          <input
            type="date"
            name="next_service_date"
            defaultValue={
              equipment.next_service_date ||
              ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>
      </div>

      {/* NOTES */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Примітки
        </label>

        <textarea
          name="notes"
          rows={4}
          defaultValue={
            equipment.notes ||
            ""
          }
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        />
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={
            onCancel
          }
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg border bg-white px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}