"use client";

import { useState } from "react";

import { createEquipmentServiceRecord } from "@/app/actions/equipmentServiceActions";

import { equipmentServiceTypes } from "@/constants/equipmentService";

import type { AppCurrency } from "@/types/appSettings";
import type { Equipment } from "@/types/equipment";

type Props = {
  equipment: Equipment[];
  currency: AppCurrency;
  today: string;
  onCreated: () => void;
};

export default function AddEquipmentServiceForm({
  equipment,
  currency,
  today,
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
  const [selectedEquipmentId, setSelectedEquipmentId] =
    useState("");
  const selectedEquipment = equipment.find(
    (item) =>
      String(item.id) === selectedEquipmentId
  );
  const manualServiceTypes = equipmentServiceTypes.filter(
    (type) => type !== "Планове обслуговування"
  );

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createEquipmentServiceRecord(
        formData
      );

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

  if (
    equipment.length ===
    0
  ) {
    return (
      <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white">
          🔧
        </div>

        <p className="mt-3 font-medium text-gray-700">
          Техніки ще немає
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Спочатку додай хоча б одну
          одиницю техніки.
        </p>
      </div>
    );
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

      {/* EQUIPMENT */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Техніка
        </label>

        <select
          name="equipment_id"
          value={selectedEquipmentId}
          onChange={(event) =>
            setSelectedEquipmentId(
              event.target.value
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          required
        >
          <option
            value=""
            disabled
          >
            Обери техніку
          </option>

          {equipment.map(
            (item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name} —{" "}
                {item.inventory_number ||
                  "без номера"}
              </option>
            )
          )}
        </select>
      </div>

      {/* TYPE + DATE */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Тип обслуговування
          </label>

          <select
            name="service_type"
            defaultValue="Ремонт"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          >
            {manualServiceTypes.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата обслуговування
          </label>

          <input
            type="date"
            name="service_date"
            defaultValue={today}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>
      </div>

      {selectedEquipment &&
        selectedEquipment.usage_type !== "none" && (
        <div className="min-w-0 sm:max-w-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Показник напрацювання, {selectedEquipment?.usage_type === "hours" ? "мотогод." : "км"}
          </label>
          <input
            key={`usage-reading-${selectedEquipment.id}`}
            type="number"
            name="usage_reading"
            inputMode="decimal"
            min="0"
            step="0.001"
            defaultValue={selectedEquipment?.current_usage ?? ""}
            placeholder="Необов’язково"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
          <p className="mt-2 text-xs leading-5 text-gray-500">
            Нове значення буде додано до історії показників разом із сервісним записом.
          </p>
        </div>
      )}

      {/* COST + PERFORMED BY + NEXT DATE */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Вартість
          </label>

          <input
            type="number"
            name="cost"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue="0"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />

          <p className="mt-2 text-xs text-gray-500">
            Вартість у валюті{" "}
            <span className="font-medium text-gray-700">
              {currency}
            </span>
            .
          </p>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Хто виконав
          </label>

          <input
            type="text"
            name="performed_by"
            placeholder="Працівник або сервісний центр"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>

        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Наступне обслуговування
          </label>

          <input
            type="date"
            name="next_service_date"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />

          <p className="mt-2 text-xs leading-4 text-gray-500">
            Дата оновиться в картці
            техніки.
          </p>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Опис робіт
        </label>

        <textarea
          name="description"
          rows={4}
          placeholder="Що було зроблено, які запчастини замінено та які проблеми виявлено"
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
            : "Додати запис обслуговування"}
        </button>
      </div>
    </form>
  );
}
