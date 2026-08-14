"use client";

import { useState } from "react";
import { createEquipmentServiceRecord } from "@/app/actions/equipmentServiceActions";
import { equipmentServiceTypes } from "@/constants/equipmentService";
import type { AppCurrency } from "@/types/appSettings";
import type { Equipment } from "@/types/equipment";

type Props = {
  equipment: Equipment[];
  currency: AppCurrency;
  onCreated: () => void;
};

function getToday() {
  const date = new Date();
  const timezoneOffset = date.getTimezoneOffset();

  return new Date(
    date.getTime() - timezoneOffset * 60 * 1000
  )
    .toISOString()
    .split("T")[0];
}

export default function AddEquipmentServiceForm({
  equipment,
  currency,
  onCreated,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createEquipmentServiceRecord(formData);
      onCreated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося додати запис обслуговування."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (equipment.length === 0) {
    return (
      <p className="text-gray-500">
        Спочатку додай хоча б одну одиницю техніки.
      </p>
    );
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
          Техніка
        </label>

        <select
          name="equipment_id"
          defaultValue=""
          className="w-full rounded-lg border bg-white p-3"
          required
        >
          <option value="" disabled>
            Обери техніку
          </option>

          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} —{" "}
              {item.inventory_number || "без номера"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Тип обслуговування
          </label>

          <select
            name="service_type"
            defaultValue="Планове обслуговування"
            className="w-full rounded-lg border bg-white p-3"
            required
          >
            {equipmentServiceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Дата обслуговування
          </label>

          <input
            type="date"
            name="service_date"
            defaultValue={getToday()}
            className="w-full rounded-lg border bg-white p-3"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Вартість
          </label>

          <input
            type="number"
            name="cost"
            min="0"
            step="0.01"
            defaultValue="0"
            className="w-full rounded-lg border bg-white p-3"
            required
          />

          <p className="mt-2 text-xs text-gray-500">
            Вартість у валюті {currency}.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Хто виконав
          </label>

          <input
            type="text"
            name="performed_by"
            placeholder="Працівник або сервісний центр"
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

          <p className="mt-2 text-xs text-gray-500">
            Дата оновиться в картці техніки.
          </p>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Опис робіт
        </label>

        <textarea
          name="description"
          rows={4}
          placeholder="Що було зроблено, які запчастини замінено та які проблеми виявлено"
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
          : "Додати запис обслуговування"}
      </button>
    </form>
  );
}