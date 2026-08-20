"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateMaterial } from "@/app/actions/materialActions";

import type { Material } from "@/types/material";
import type { WarehouseItem } from "@/types/warehouseItem";

type Props = {
  material: Material;
  objectId: number;
  warehouseItem?: WarehouseItem | null;
  onCancel: () => void;
};

export default function EditMaterialForm({
  material,
  objectId,
  warehouseItem = null,
  onCancel,
}: Props) {
  const router = useRouter();

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    manualQuantity,
    setManualQuantity,
  ] = useState(
    String(material.quantity)
  );

  const isWarehouseMaterial =
    Boolean(
      material.warehouse_item_id
    );

  const maximumQuantity =
    warehouseItem
      ? Number(material.quantity) +
        Number(warehouseItem.quantity)
      : undefined;

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateMaterial(
        formData
      );

      router.refresh();

      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити матеріал."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-xl border bg-gray-50 p-3 sm:p-4"
    >
      <input
        type="hidden"
        name="material_id"
        value={material.id}
      />

      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      {!isWarehouseMaterial && (
        <input
          type="hidden"
          name="price"
          value={material.price || 0}
        />
      )}

      {/* HEADER */}
      <div>
        <h3 className="text-base font-semibold text-gray-800">
          Редагування матеріалу
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Зміни інформацію про матеріал
        </p>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {isWarehouseMaterial ? (
        <>
          {/* WAREHOUSE INFO */}
          <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Матеріал зі складу
                </p>

                <p className="mt-1 break-words font-semibold text-blue-900">
                  {material.name}
                </p>
              </div>

              <span className="w-fit shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {material.unit}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-blue-100 pt-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-blue-600">
                  Зараз на об’єкті
                </p>

                <p className="mt-1 text-lg font-bold text-blue-900">
                  {material.quantity}{" "}
                  {material.unit}
                </p>
              </div>

              {warehouseItem && (
                <div>
                  <p className="text-xs text-blue-600">
                    Доступно на складі
                  </p>

                  <p className="mt-1 text-lg font-bold text-blue-900">
                    {warehouseItem.quantity}{" "}
                    {warehouseItem.unit}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* QUANTITY */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Нова загальна кількість на об’єкті
            </label>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                name="quantity"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                max={maximumQuantity}
                defaultValue={
                  material.quantity
                }
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
                required
              />

              <span className="flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700">
                {material.unit}
              </span>
            </div>

            <div className="mt-3 rounded-lg bg-white p-3 text-xs leading-5 text-gray-500">
              При збільшенні кількості різниця
              автоматично спишеться зі складу.
              При зменшенні — повернеться на склад.
            </div>
          </div>
        </>
      ) : (
        <>
          {/* MANUAL INFO */}
          <div className="rounded-xl border border-green-100 bg-green-50 p-3 sm:p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">
              Матеріал додано вручну
            </p>

            <p className="mt-1 text-sm text-green-700">
              Можна змінити назву, кількість
              та одиницю виміру.
            </p>
          </div>

          {/* NAME */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Назва матеріалу
            </label>

            <input
              name="name"
              defaultValue={
                material.name
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              required
            />
          </div>

          {/* QUANTITY + UNIT */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Кількість
              </label>

              <input
                name="quantity"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={
                  manualQuantity
                }
                onChange={(event) =>
                  setManualQuantity(
                    event.target.value
                  )
                }
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
                defaultValue={
                  material.unit
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
              </select>
            </div>
          </div>
        </>
      )}

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