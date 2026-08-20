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

  const safeWarehouseItems =
    Array.isArray(
      warehouseItems
    )
      ? warehouseItems
      : [];

  const [
    sourceType,
    setSourceType,
  ] = useState<MaterialSource>(
    safeWarehouseItems.length > 0
      ? "warehouse"
      : "manual"
  );

  const [
    selectedWarehouseItemId,
    setSelectedWarehouseItemId,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

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

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createMaterial(
        formData
      );

      formRef.current?.reset();

      setSelectedWarehouseItemId(
        ""
      );

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
      className="min-w-0 space-y-5"
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

      {/* HEADER */}
      <div>
        <h3 className="text-base font-semibold text-gray-800">
          Новий матеріал
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Обери матеріал зі складу або
          додай його вручну
        </p>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* SOURCE */}
      <div className="min-w-0">
        <p className="mb-2 text-sm font-medium text-gray-700">
          Джерело матеріалу
        </p>

        <div className="grid w-full grid-cols-2 rounded-lg border bg-white p-1 sm:inline-grid sm:w-auto">
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
            className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition sm:px-4 ${
              sourceType ===
              "warehouse"
                ? "bg-green-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Зі складу
          </button>

          <button
            type="button"
            onClick={() =>
              setSourceType(
                "manual"
              )
            }
            className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition sm:px-4 ${
              sourceType ===
              "manual"
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
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700 sm:p-4">
          На складі поки немає
          доступних позицій. Матеріал
          можна додати вручну.
        </div>
      )}

      {sourceType ===
      "warehouse" ? (
        <>
          {/* WAREHOUSE ITEM */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
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
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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
                      disabled={
                        outOfStock
                      }
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
          </div>

          {/* SELECTED ITEM INFO */}
          {selectedWarehouseItem && (
            <div className="min-w-0 rounded-xl border border-green-100 bg-green-50 p-3 sm:p-4">
              <p className="break-words font-medium text-green-800">
                {
                  selectedWarehouseItem.name
                }
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-green-600">
                    Доступно на складі
                  </p>

                  <p className="mt-1 break-words text-lg font-bold text-green-800">
                    {
                      selectedWarehouseItem.quantity
                    }{" "}
                    {
                      selectedWarehouseItem.unit
                    }
                  </p>
                </div>

                {Number(
                  selectedWarehouseItem.purchase_price
                ) > 0 && (
                  <div>
                    <p className="text-xs text-green-600">
                      Облікова ціна
                    </p>

                    <p className="mt-1 break-words font-semibold text-green-800">
                      {Number(
                        selectedWarehouseItem.purchase_price
                      ).toFixed(2)}{" "}
                      ₴ /{" "}
                      {
                        selectedWarehouseItem.unit
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QUANTITY */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Кількість для списання
            </label>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                name="quantity"
                type="number"
                inputMode="decimal"
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
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
                required
              />

              {selectedWarehouseItem && (
                <span className="flex min-h-11 items-center justify-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700">
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
          {/* MANUAL NAME */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Назва матеріалу
            </label>

            <input
              name="name"
              placeholder="Наприклад: Туя Смарагд"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />
          </div>

          {/* MANUAL QUANTITY */}
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
                placeholder="0"
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
                defaultValue=""
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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
        </>
      )}

      {/* SAVE */}
      <div className="border-t pt-4">
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
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : sourceType ===
                "warehouse"
              ? "Списати зі складу"
              : "Додати матеріал"}
        </button>

        <p className="mt-2 text-xs text-gray-500">
          {sourceType ===
          "warehouse"
            ? "Кількість автоматично зменшиться на складі."
            : "Ручний матеріал не впливає на залишки складу."}
        </p>
      </div>
    </form>
  );
}