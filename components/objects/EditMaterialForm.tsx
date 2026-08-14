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

  const [
    manualPrice,
    setManualPrice,
  ] = useState(
    String(material.price || 0)
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

  const manualTotal =
    Number(manualQuantity || 0) *
    Number(manualPrice || 0);

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateMaterial(formData);

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
      className="space-y-4 rounded-lg border bg-gray-50 p-4"
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

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {isWarehouseMaterial ? (
        <>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Матеріал зі складу
                </p>

                <p className="mt-1 font-semibold text-blue-900">
                  {material.name}
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {material.unit}
              </span>
            </div>

            <div className="mt-3 border-t border-blue-100 pt-3 text-sm text-blue-800">
              <p>
                Зараз на об’єкті:{" "}
                <strong>
                  {material.quantity}{" "}
                  {material.unit}
                </strong>
              </p>

              {Number(material.price) >
                0 && (
                <p className="mt-1">
                  Облікова ціна:{" "}
                  <strong>
                    {Number(
                      material.price
                    ).toFixed(2)}{" "}
                    ₴ /{" "}
                    {material.unit}
                  </strong>
                </p>
              )}

              {warehouseItem && (
                <p className="mt-1">
                  Доступно на складі для
                  додаткового списання:{" "}
                  <strong>
                    {
                      warehouseItem.quantity
                    }{" "}
                    {
                      warehouseItem.unit
                    }
                  </strong>
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Нова загальна кількість на
              об’єкті
            </label>

            <div className="flex items-center gap-3">
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                max={maximumQuantity}
                defaultValue={
                  material.quantity
                }
                className="min-w-0 flex-1 rounded-lg border bg-white p-3"
                required
              />

              <span className="shrink-0 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700">
                {material.unit}
              </span>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              При збільшенні різниця
              спишеться зі складу. При
              зменшенні різниця
              повернеться на склад.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-green-100 bg-green-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">
              Матеріал додано вручну
            </p>

            <p className="mt-1 text-sm text-green-700">
              Для нього можна вручну
              змінювати назву, кількість,
              одиницю та ціну.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Назва матеріалу
            </label>

            <input
              name="name"
              defaultValue={
                material.name
              }
              className="w-full rounded-lg border bg-white p-3"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Кількість
              </label>

              <input
                name="quantity"
                type="number"
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
                defaultValue={
                  material.unit
                }
                className="w-full rounded-lg border bg-white p-3"
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

          <div>
            <label className="mb-2 block text-sm font-medium">
              Ціна за одиницю
            </label>

            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={manualPrice}
              onChange={(event) =>
                setManualPrice(
                  event.target.value
                )
              }
              placeholder="0.00"
              className="w-full rounded-lg border bg-white p-3"
            />

            <p className="mt-2 text-xs text-gray-500">
              Собівартість однієї
              одиниці матеріалу.
            </p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-green-700">
                  Загальна вартість
                </p>

                <p className="mt-1 text-xs text-green-600">
                  Кількість × ціна
                </p>
              </div>

              <p className="text-xl font-bold text-green-800">
                {Number.isFinite(
                  manualTotal
                )
                  ? manualTotal.toFixed(
                      2
                    )
                  : "0.00"}{" "}
                ₴
              </p>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-100 disabled:opacity-60"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}