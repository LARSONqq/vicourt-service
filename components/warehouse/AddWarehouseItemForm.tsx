"use client";

import { createWarehouseItem } from "@/app/actions/warehouseActions";
import { warehouseCategories } from "@/constants/warehouseCategories";

type Props = {
  onCreated: () => void;
};

export default function AddWarehouseItemForm({
  onCreated,
}: Props) {
  async function handleSubmit(formData: FormData) {
    await createWarehouseItem(formData);
    onCreated();
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Назва матеріалу
        </label>

        <input
          type="text"
          name="name"
          placeholder="Наприклад: Кора соснова"
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

            {warehouseCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Постачальник
          </label>

          <input
            type="text"
            name="supplier"
            placeholder="Назва постачальника"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Кількість
          </label>

          <input
            type="number"
            name="quantity"
            min="0"
            step="0.01"
            defaultValue="0"
            className="w-full rounded-lg border bg-white p-3"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Одиниця
          </label>

          <select
            name="unit"
            defaultValue="шт"
            className="w-full rounded-lg border bg-white p-3"
            required
          >
            <option value="шт">шт</option>
            <option value="м">м</option>
            <option value="м²">м²</option>
            <option value="м³">м³</option>
            <option value="кг">кг</option>
            <option value="л">л</option>
            <option value="уп">уп</option>
            <option value="мішок">мішок</option>
            <option value="рулон">рулон</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Мінімальний залишок
          </label>

          <input
            type="number"
            name="min_quantity"
            min="0"
            step="0.01"
            defaultValue="0"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Закупівельна ціна
          </label>

          <input
            type="number"
            name="purchase_price"
            min="0"
            step="0.01"
            defaultValue="0"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
      >
        Зберегти позицію
      </button>
    </form>
  );
}
