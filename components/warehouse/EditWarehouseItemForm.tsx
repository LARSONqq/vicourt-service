"use client";

import { useState } from "react";

import { updateWarehouseItem } from "@/app/actions/warehouseActions";
import { warehouseCategories } from "@/constants/warehouseCategories";

import type { WarehouseItem } from "@/types/warehouseItem";

type Props = {
  item: WarehouseItem;
  onCancel: () => void;
};

export default function EditWarehouseItemForm({
  item,
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
      await updateWarehouseItem(
        formData
      );

      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити позицію складу."
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
        name="item_id"
        value={item.id}
      />

      {/* HEADER */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
          Редагування позиції
        </h3>

        <p className="mt-1 break-words text-sm text-gray-500">
          {item.name}
        </p>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* NAME */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Назва матеріалу
        </label>

        <input
          name="name"
          defaultValue={item.name}
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          required
        />
      </div>

      {/* CATEGORY + SUPPLIER */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Категорія
          </label>

          <select
            name="category"
            defaultValue={
              item.category || ""
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

            {warehouseCategories.map(
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
            Основний постачальник
          </label>

          <input
            name="supplier"
            defaultValue={
              item.supplier || ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />

          <p className="mt-2 text-xs text-gray-400">
            Буде запропонований у
            новій закупівлі, але його
            можна змінити.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800 sm:p-4">
        <p className="font-medium">
          Залишок: {item.quantity} {item.unit} · облікова ціна:{" "}
          {Number(item.purchase_price).toFixed(2)} ₴
        </p>
        <p className="mt-1 text-xs leading-5 text-blue-700">
          Кількість і середня облікова ціна змінюються тільки через
          закупівлю, видачу, повернення або «Корекцію залишку».
        </p>
      </div>

      {/* VALUES */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Одиниця
          </label>

          <select
            name="unit"
            defaultValue={
              item.unit
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          >
            <option value="шт">
              шт
            </option>

            <option value="м">
              м
            </option>

            <option value="м²">
              м²
            </option>

            <option value="м³">
              м³
            </option>

            <option value="кг">
              кг
            </option>

            <option value="л">
              л
            </option>

            <option value="уп">
              уп
            </option>

            <option value="мішок">
              мішок
            </option>

            <option value="рулон">
              рулон
            </option>
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Мінімальний залишок
          </label>

          <input
            type="number"
            name="min_quantity"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={
              item.min_quantity
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />

          <p className="mt-2 text-xs text-gray-400">
            Нижче цього значення позиція
            вважатиметься малозалишковою.
          </p>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Цільовий запас
          </label>

          <input
            type="number"
            name="target_quantity"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={
              item.target_quantity ??
              ""
            }
            placeholder="Не задано"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />

          <p className="mt-2 text-xs text-gray-400">
            Має бути не меншим за
            мінімальний залишок.
          </p>
        </div>

      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg border bg-white px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 sm:w-fit"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}
