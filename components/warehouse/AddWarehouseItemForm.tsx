"use client";

import { createWarehouseItem } from "@/app/actions/warehouseActions";
import { warehouseCategories } from "@/constants/warehouseCategories";

type Props = {
  onCreated: () => void;
};

export default function AddWarehouseItemForm({
  onCreated,
}: Props) {
  async function handleSubmit(
    formData: FormData
  ) {
    await createWarehouseItem(
      formData
    );

    onCreated();
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5"
    >
      {/* NAME */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Назва матеріалу
        </label>

        <input
          type="text"
          name="name"
          placeholder="Наприклад: Кора соснова"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
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
            Постачальник
          </label>

          <input
            type="text"
            name="supplier"
            placeholder="Назва постачальника"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>
      </div>

      {/* VALUES */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Кількість
          </label>

          <input
            type="number"
            name="quantity"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue="0"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Одиниця
          </label>

          <select
            name="unit"
            defaultValue="шт"
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
            defaultValue="0"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />

          <p className="mt-2 text-xs text-gray-400">
            При цьому значенні позиція
            вважатиметься малозалишковою.
          </p>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Закупівельна ціна
          </label>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              type="number"
              name="purchase_price"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue="0"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            />

            <span className="flex min-h-11 items-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-600">
              / од.
            </span>
          </div>
        </div>
      </div>

      {/* SAVE */}
      <div className="border-t pt-4">
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 sm:w-fit"
        >
          Зберегти позицію
        </button>
      </div>
    </form>
  );
}