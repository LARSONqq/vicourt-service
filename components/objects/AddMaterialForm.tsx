"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createMaterial } from "@/app/actions/materialActions";
import type { WarehouseItem } from "@/types/warehouseItem";

type Props = {
  objectId: number;
  warehouseItems?: WarehouseItem[];
  onSaved?: () => void;
};

type MaterialSource =
  | "warehouse"
  | "manual";

export default function AddMaterialForm({
  objectId,
  warehouseItems = [],
  onSaved,
}: Props) {
  const router = useRouter();

  const formRef =
    useRef<HTMLFormElement | null>(
      null
    );

  const [
    sourceType,
    setSourceType,
  ] = useState<MaterialSource>(
    warehouseItems.length > 0
      ? "warehouse"
      : "manual"
  );

  const [
    selectedWarehouseItemId,
    setSelectedWarehouseItemId,
  ] = useState("");

  const [
    manualQuantity,
    setManualQuantity,
  ] = useState("");

  const [
    manualPrice,
    setManualPrice,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const safeWarehouseItems =
    Array.isArray(warehouseItems)
      ? warehouseItems
      : [];

  const selectedWarehouseItem =
    useMemo(() => {
      return (
        safeWarehouseItems.find(
          (item) =>
            String(item.id) ===
            selectedWarehouseItemId
        ) || null
      );
    }, [
      safeWarehouseItems,
      selectedWarehouseItemId,
    ]);

  const manualTotal =
    Number(manualQuantity || 0) *
    Number(manualPrice || 0);

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createMaterial(formData);

      formRef.current?.reset();

      setSelectedWarehouseItemId("");
      setManualQuantity("");
      setManualPrice("");

      router.refresh();

      onSaved?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося додати матеріал."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-5"
    >
      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      <input
        type="hidden"
        name="source_type"
        value={sourceType}
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">
          Джерело матеріалу
        </p>

        <div className="inline-flex rounded-lg border bg-white p-1">
          <button
            type="button"
            onClick={() =>
              setSourceType(
                "warehouse"
              )
            }
            disabled={
              safeWarehouseItems.length ===
              0
            }
            className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              sourceType ===
              "warehouse"
                ? "bg-green-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Зі складу
          </button>

          <button
            type="button"
            onClick={() =>
              setSourceType("manual")
            }
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              sourceType === "manual"
                ? "bg-green-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Вручну
          </button>
        </div>
      </div>

      {safeWarehouseItems.length ===
        0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          На складі поки що немає
          доступних позицій. Матеріал можна
          додати вручну.
        </div>
      )}

      {sourceType === "warehouse" ? (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Матеріал зі складу
            </label>

            <select
              name="warehouse_item_id"
              value={
                selectedWarehouseItemId
              }
              onChange={(event) =>
                setSelectedWarehouseItemId(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-white p-3"
              required
            >
              <option value="">
                Обери позицію складу
              </option>

              {safeWarehouseItems.map(
                (item) => {
                  const outOfStock =
                    Number(
                      item.quantity
                    ) <= 0;

                  return (
                    <option
                      key={item.id}
                      value={item.id}
                      disabled={outOfStock}
                    >
                      {item.name} —{" "}
                      {item.quantity}{" "}
                      {item.unit}
                      {outOfStock
                        ? " (немає в наявності)"
                        : ""}
                    </option>
                  );
                }
              )}
            </select>

            {selectedWarehouseItem && (
              <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3 text-sm">
                <p className="font-medium text-green-800">
                  {
                    selectedWarehouseItem.name
                  }
                </p>

                <p className="mt-1 text-green-700">
                  Доступно на складі:{" "}
                  <strong>
                    {
                      selectedWarehouseItem.quantity
                    }{" "}
                    {
                      selectedWarehouseItem.unit
                    }
                  </strong>
                </p>

                {Number(
                  selectedWarehouseItem.purchase_price
                ) > 0 && (
                  <p className="mt-1 text-green-700">
                    Облікова ціна:{" "}
                    <strong>
                      {Number(
                        selectedWarehouseItem.purchase_price
                      ).toFixed(2)}{" "}
                      за{" "}
                      {
                        selectedWarehouseItem.unit
                      }
                    </strong>
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Кількість для списання
            </label>

            <div className="flex items-center gap-3">
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                max={
                  selectedWarehouseItem
                    ? Number(
                        selectedWarehouseItem.quantity
                      )
                    : undefined
                }
                placeholder="0"
                className="min-w-0 flex-1 rounded-lg border bg-white p-3"
                required
              />

              {selectedWarehouseItem && (
                <span className="shrink-0 rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
                  {
                    selectedWarehouseItem.unit
                  }
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Назва матеріалу
            </label>

            <input
              name="name"
              placeholder="Наприклад: Туя Смарагд"
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
                value={manualQuantity}
                onChange={(event) =>
                  setManualQuantity(
                    event.target.value
                  )
                }
                placeholder="0"
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
                defaultValue=""
                className="w-full rounded-lg border bg-white p-3"
                required
              >
                <option
                  value=""
                  disabled
                >
                  Обери одиницю
                </option>

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
              Необов’язково. Якщо залишити
              порожнім, вартість матеріалу
              буде 0.
            </p>
          </div>

          {manualQuantity &&
            manualPrice &&
            Number.isFinite(
              manualTotal
            ) && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-700">
                Орієнтовна вартість
                матеріалу
              </p>

              <p className="mt-1 text-xl font-bold text-green-800">
                {manualTotal.toFixed(
                  2
                )}{" "}
                ₴
              </p>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            (sourceType ===
              "warehouse" &&
              (!selectedWarehouseItem ||
                Number(
                  selectedWarehouseItem.quantity
                ) <= 0))
          }
          className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : sourceType ===
                "warehouse"
              ? "Списати зі складу"
              : "Додати вручну"}
        </button>

        {sourceType ===
          "warehouse" && (
          <p className="text-xs text-gray-500">
            Кількість автоматично
            зменшиться на складі
          </p>
        )}

        {sourceType ===
          "manual" && (
          <p className="text-xs text-gray-500">
            Ручний матеріал не впливає
            на залишки складу
          </p>
        )}
      </div>
    </form>
  );
}