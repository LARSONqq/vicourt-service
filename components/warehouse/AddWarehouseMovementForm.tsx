"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { createWarehouseMovement } from "@/app/actions/warehouseMovementActions";

import type { ObjectItem } from "@/types/object";
import type { WarehouseItem } from "@/types/warehouseItem";

type MovementType =
  | "Прихід"
  | "Списання";

type Props = {
  items?: WarehouseItem[];
  objects?: ObjectItem[];
  onCreated: () => void;
  initialItemId?: number;
  initialMovementType?: MovementType;
  lockItem?: boolean;
  lockMovementType?: boolean;
};

export default function AddWarehouseMovementForm({
  items = [],
  objects = [],
  onCreated,
  initialItemId,
  initialMovementType = "Прихід",
  lockItem = false,
  lockMovementType = false,
}: Props) {
  const router =
    useRouter();

  const formRef =
    useRef<HTMLFormElement | null>(
      null
    );

  const safeItems =
    Array.isArray(items)
      ? items
      : [];

  const safeObjects =
    Array.isArray(objects)
      ? objects
      : [];

  const initialSelectedItem =
    initialItemId &&
    safeItems.some(
      (item) =>
        Number(item.id) ===
        Number(initialItemId)
    )
      ? String(initialItemId)
      : "";

  const [
    movementType,
    setMovementType,
  ] = useState<MovementType>(
    initialMovementType
  );

  const [
    selectedItemId,
    setSelectedItemId,
  ] = useState(
    initialSelectedItem
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const selectedItem =
    useMemo(() => {
      return (
        safeItems.find(
          (item) =>
            String(item.id) ===
            selectedItemId
        ) || null
      );
    }, [
      safeItems,
      selectedItemId,
    ]);

  const isOutOfStock =
    movementType ===
      "Списання" &&
    selectedItem !== null &&
    Number(
      selectedItem.quantity
    ) <= 0;

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createWarehouseMovement(
        formData
      );

      formRef.current?.reset();

      if (!lockItem) {
        setSelectedItemId(
          ""
        );
      }

      if (
        !lockMovementType
      ) {
        setMovementType(
          "Прихід"
        );
      }

      router.refresh();

      onCreated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося виконати операцію."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (
    safeItems.length === 0
  ) {
    return (
      <div className="rounded-xl border border-dashed bg-gray-50 p-5 text-center">
        <p className="font-medium text-gray-700">
          На складі ще немає позицій
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Спочатку додай хоча б одну
          позицію на склад.
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
      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* MOVEMENT TYPE */}
      {lockMovementType ? (
        <div className="min-w-0">
          <input
            type="hidden"
            name="movement_type"
            value={
              movementType
            }
          />

          <p className="mb-2 text-sm font-medium text-gray-700">
            Тип операції
          </p>

          <div
            className={`rounded-xl border p-3 sm:p-4 ${
              movementType ===
              "Прихід"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-orange-200 bg-orange-50 text-orange-800"
            }`}
          >
            <p className="font-semibold">
              {movementType ===
              "Прихід"
                ? "Прихід товару"
                : "Списання товару"}
            </p>
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Тип операції
          </label>

          <select
            name="movement_type"
            value={
              movementType
            }
            onChange={(
              event
            ) =>
              setMovementType(
                event.target
                  .value as MovementType
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          >
            <option value="Прихід">
              Прихід товару
            </option>

            <option value="Списання">
              Списання товару
            </option>
          </select>
        </div>
      )}

      {/* ITEM */}
      {lockItem &&
      selectedItem ? (
        <div className="min-w-0">
          <input
            type="hidden"
            name="item_id"
            value={
              selectedItem.id
            }
          />

          <p className="mb-2 text-sm font-medium text-gray-700">
            Позиція складу
          </p>

          <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
            <p className="break-words font-semibold text-gray-900">
              {
                selectedItem.name
              }
            </p>

            <div className="mt-3 border-t pt-3">
              <p className="text-xs text-gray-500">
                Зараз на складі
              </p>

              <p className="mt-1 text-lg font-bold text-gray-800">
                {
                  selectedItem.quantity
                }{" "}
                {
                  selectedItem.unit
                }
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Позиція складу
          </label>

          <select
            name="item_id"
            value={
              selectedItemId
            }
            onChange={(
              event
            ) =>
              setSelectedItemId(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          >
            <option value="">
              Обери товар
            </option>

            {safeItems.map(
              (item) => (
                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {
                    item.name
                  }{" "}
                  —{" "}
                  {
                    item.quantity
                  }{" "}
                  {
                    item.unit
                  }
                </option>
              )
            )}
          </select>
        </div>
      )}

      {/* AVAILABLE STOCK */}
      {selectedItem && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            isOutOfStock
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Доступний залишок
            </span>

            <strong className="text-base">
              {
                selectedItem.quantity
              }{" "}
              {
                selectedItem.unit
              }
            </strong>
          </div>

          {isOutOfStock && (
            <p className="mt-2 text-xs font-medium">
              Цю позицію зараз
              неможливо списати.
            </p>
          )}
        </div>
      )}

      {/* QUANTITY + OBJECT */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Кількість
          </label>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              type="number"
              name="quantity"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={
                movementType ===
                  "Списання" &&
                selectedItem
                  ? Number(
                      selectedItem.quantity
                    )
                  : undefined
              }
              placeholder="0"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              required
            />

            {selectedItem && (
              <span className="flex min-h-11 items-center justify-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700">
                {
                  selectedItem.unit
                }
              </span>
            )}
          </div>
        </div>

        {movementType ===
          "Списання" && (
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Об’єкт
            </label>

            <select
              name="object_id"
              defaultValue=""
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            >
              <option value="">
                Не прив’язувати до
                об’єкта
              </option>

              {safeObjects.map(
                (object) => (
                  <option
                    key={
                      object.id
                    }
                    value={
                      object.id
                    }
                  >
                    {
                      object.name
                    }
                  </option>
                )
              )}
            </select>

            <p className="mt-2 text-xs text-gray-500">
              Об’єкт буде показаний
              в історії руху товару.
            </p>
          </div>
        )}
      </div>

      {/* NOTE */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Примітка
        </label>

        <textarea
          name="note"
          rows={3}
          placeholder={
            movementType ===
            "Прихід"
              ? "Наприклад: закупівля у постачальника"
              : "Наприклад: пошкоджено або використано"
          }
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      {/* INFO */}
      {movementType ===
        "Списання" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-5 text-blue-700 sm:p-4">
          Списання на цій сторінці
          змінює залишок та записує
          рух. Щоб матеріал також
          з’явився у вкладці
          «Матеріали» об’єкта,
          додавай його безпосередньо
          у картці об’єкта.
        </div>
      )}

      {/* SAVE */}
      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            !selectedItem ||
            isOutOfStock
          }
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit ${
            movementType ===
            "Прихід"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-orange-600 hover:bg-orange-700"
          }`}
        >
          {isSubmitting
            ? "Збереження..."
            : movementType ===
                "Прихід"
              ? "Додати на склад"
              : "Списати зі складу"}
        </button>
      </div>
    </form>
  );
}