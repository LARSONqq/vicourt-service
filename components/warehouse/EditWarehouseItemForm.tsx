"use client";

import { updateWarehouseItem } from "@/app/actions/warehouseActions";
import { warehouseCategories } from "@/constants/warehouseCategories";
import { WarehouseItem } from "@/types/warehouseItem";

type Props = {
  item: WarehouseItem;
  onCancel: () => void;
};

export default function EditWarehouseItemForm({
  item,
  onCancel,
}: Props) {
  async function handleSubmit(formData: FormData) {
    await updateWarehouseItem(formData);
    onCancel();
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-5 rounded-xl border bg-gray-50 p-5"
    >
      <input type="hidden" name="item_id" value={item.id} />

      <div>
        <label className="mb-2 block text-sm font-medium">
          Назва матеріалу
        </label>

        <input
          name="name"
          defaultValue={item.name}
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
            defaultValue={item.category || ""}
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
            name="supplier"
            defaultValue={item.supplier || ""}
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
            defaultValue={item.quantity}
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
            defaultValue={item.unit}
            className="w-full rounded-lg border bg-white p-3"
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
            defaultValue={item.min_quantity}
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
            defaultValue={item.purchase_price}
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
        >
          Зберегти зміни
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-100"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}