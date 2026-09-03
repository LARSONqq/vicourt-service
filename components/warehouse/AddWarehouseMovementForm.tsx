"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createWarehouseMovement } from "@/app/actions/warehouseMovementActions";
import type { WarehouseItem } from "@/types/warehouseItem";

type AdjustmentDirection = "in" | "out";

type Props = {
  items?: WarehouseItem[];
  onCreated: () => void;
  initialItemId?: number;
  initialDirection?: AdjustmentDirection;
  lockItem?: boolean;
  lockDirection?: boolean;
};

export default function AddWarehouseMovementForm({
  items = [],
  onCreated,
  initialItemId,
  initialDirection = "in",
  lockItem = false,
  lockDirection = false,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const safeItems = useMemo(
    () => (Array.isArray(items) ? items : []),
    [items]
  );
  const initialSelectedItem =
    initialItemId &&
    safeItems.some((item) => Number(item.id) === Number(initialItemId))
      ? String(initialItemId)
      : "";
  const [direction, setDirection] =
    useState<AdjustmentDirection>(initialDirection);
  const [selectedItemId, setSelectedItemId] =
    useState(initialSelectedItem);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedItem = useMemo(
    () =>
      safeItems.find(
        (item) => String(item.id) === selectedItemId
      ) || null,
    [safeItems, selectedItemId]
  );

  const isOutOfStock =
    direction === "out" &&
    selectedItem !== null &&
    Number(selectedItem.quantity) <= 0;

  async function handleSubmit(formData: FormData) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createWarehouseMovement(formData);
      formRef.current?.reset();

      if (!lockItem) {
        setSelectedItemId("");
      }

      if (!lockDirection) {
        setDirection("in");
      }

      router.refresh();
      onCreated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося виконати корекцію."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (safeItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-gray-50 p-5 text-center">
        <p className="font-medium text-gray-700">
          На складі ще немає позицій
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Спочатку додай хоча б одну позицію на склад.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="min-w-0 space-y-5"
    >
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {lockDirection ? (
        <div>
          <input type="hidden" name="direction" value={direction} />
          <p className="mb-2 text-sm font-medium text-gray-700">
            Напрям корекції
          </p>
          <div
            className={`rounded-xl border p-3 font-semibold sm:p-4 ${
              direction === "in"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-orange-200 bg-orange-50 text-orange-800"
            }`}
          >
            {direction === "in"
              ? "Збільшити залишок"
              : "Зменшити залишок"}
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Напрям корекції
          </label>
          <select
            name="direction"
            value={direction}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "in" || value === "out") {
                setDirection(value);
              }
            }}
            className="min-h-11 w-full rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
          >
            <option value="in">Збільшити залишок</option>
            <option value="out">Зменшити залишок</option>
          </select>
        </div>
      )}

      {lockItem && selectedItem ? (
        <div>
          <input type="hidden" name="item_id" value={selectedItem.id} />
          <p className="mb-2 text-sm font-medium text-gray-700">
            Позиція складу
          </p>
          <div className="rounded-xl border bg-white p-3 sm:p-4">
            <p className="break-words font-semibold text-gray-900">
              {selectedItem.name}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Поточний залишок: {selectedItem.quantity} {selectedItem.unit}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Позиція складу
          </label>
          <select
            name="item_id"
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            className="min-h-11 w-full rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
            required
          >
            <option value="">Обери матеріал</option>
            {safeItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.quantity} {item.unit}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className={`rounded-lg border p-3 text-sm ${
          isOutOfStock
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-blue-200 bg-blue-50 text-blue-700"
        }`}
      >
        Це контрольована корекція фактичного залишку. Причина
        обов’язкова, а операція назавжди залишиться в журналі рухів.
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Кількість
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              type="number"
              name="quantity"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={
                direction === "out" && selectedItem
                  ? Number(selectedItem.quantity)
                  : undefined
              }
              className="min-h-11 min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
              required
            />
            <span className="flex min-h-11 items-center rounded-lg bg-gray-100 px-4 text-sm text-gray-600">
              {selectedItem?.unit || "од."}
            </span>
          </div>
        </div>

        {direction === "in" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Облікова ціна за одиницю
            </label>
            <input
              key={selectedItem?.id || "no-item"}
              type="number"
              name="unit_cost"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={selectedItem?.purchase_price ?? 0}
              className="min-h-11 w-full rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
              required
            />
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Причина корекції
        </label>
        <textarea
          name="reason"
          rows={3}
          maxLength={2000}
          placeholder="Наприклад: інвентаризація, знайдений залишок або пошкодження"
          className="w-full resize-none rounded-lg border bg-white px-3 py-3 outline-none placeholder:text-gray-400 focus:border-green-600"
          required
        />
      </div>

      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={isSubmitting || !selectedItem || isOutOfStock}
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit ${
            direction === "in"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-orange-600 hover:bg-orange-700"
          }`}
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти корекцію"}
        </button>
      </div>
    </form>
  );
}
