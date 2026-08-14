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
  const router = useRouter();

  const formRef =
    useRef<HTMLFormElement | null>(
      null
    );

  const safeItems = Array.isArray(items)
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
  ] = useState(initialSelectedItem);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const selectedItem = useMemo(() => {
    return (
      safeItems.find(
        (item) =>
          String(item.id) ===
          selectedItemId
      ) || null
    );
  }, [safeItems, selectedItemId]);

  const isOutOfStock =
    movementType === "Списання" &&
    selectedItem !== null &&
    Number(selectedItem.quantity) <= 0;

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createWarehouseMovement(
        formData
      );

      formRef.current?.reset();

      if (!lockItem) {
        setSelectedItemId("");
      }

      if (!lockMovementType) {
        setMovementType("Прихід");
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

  if (safeItems.length === 0) {
    return (
      <p className="text-gray-500">
        Спочатку додай хоча б одну
        позицію на склад.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-5"
    >
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {lockMovementType ? (
        <div>
          <input
            type="hidden"
            name="movement_type"
            value={movementType}
          />

          <p className="mb-2 text-sm font-medium">
            Тип операції
          </p>

          <div
            className={`rounded-lg border p-4 ${
              movementType === "Прихід"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-orange-200 bg-orange-50 text-orange-800"
            }`}
          >
            <p className="font-semibold">
              {movementType === "Прихід"
                ? "Прихід товару"
                : "Списання товару"}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-medium">
            Тип операції
          </label>

          <select
            name="movement_type"
            value={movementType}
            onChange={(event) =>
              setMovementType(
                event.target
                  .value as MovementType
              )
            }
            className="w-full rounded-lg border bg-white p-3"
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

      {lockItem && selectedItem ? (
        <div>
          <input
            type="hidden"
            name="item_id"
            value={selectedItem.id}
          />

          <p className="mb-2 text-sm font-medium">
            Позиція складу
          </p>

          <div className="rounded-lg border bg-white p-4">
            <p className="font-semibold">
              {selectedItem.name}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Зараз на складі:{" "}
              <strong>
                {selectedItem.quantity}{" "}
                {selectedItem.unit}
              </strong>
            </p>
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-medium">
            Позиція складу
          </label>

          <select
            name="item_id"
            value={selectedItemId}
            onChange={(event) =>
              setSelectedItemId(
                event.target.value
              )
            }
            className="w-full rounded-lg border bg-white p-3"
            required
          >
            <option value="">
              Обери товар
            </option>

            {safeItems.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name} —{" "}
                {item.quantity}{" "}
                {item.unit}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedItem && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            isOutOfStock
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          Доступний залишок:{" "}
          <strong>
            {selectedItem.quantity}{" "}
            {selectedItem.unit}
          </strong>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Кількість
          </label>

          <div className="flex items-center gap-3">
            <input
              type="number"
              name="quantity"
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
              className="min-w-0 flex-1 rounded-lg border bg-white p-3"
              required
            />

            {selectedItem && (
              <span className="shrink-0 rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium">
                {selectedItem.unit}
              </span>
            )}
          </div>
        </div>

        {movementType ===
          "Списання" && (
          <div>
            <label className="mb-2 block text-sm font-medium">
              Об’єкт
            </label>

            <select
              name="object_id"
              defaultValue=""
              className="w-full rounded-lg border bg-white p-3"
            >
              <option value="">
                Не прив’язувати до
                об’єкта
              </option>

              {safeObjects.map(
                (object) => (
                  <option
                    key={object.id}
                    value={object.id}
                  >
                    {object.name}
                  </option>
                )
              )}
            </select>

            <p className="mt-2 text-xs text-gray-500">
              Об’єкт буде показаний в
              історії руху товару.
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Примітка
        </label>

        <textarea
          name="note"
          rows={3}
          placeholder={
            movementType === "Прихід"
              ? "Наприклад: закупівля у постачальника"
              : "Наприклад: пошкоджено або використано"
          }
          className="w-full resize-none rounded-lg border bg-white p-3"
        />
      </div>

      {movementType ===
        "Списання" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          Списання на цій сторінці
          змінює залишок та записує рух.
          Щоб матеріал також з’явився у
          вкладці «Матеріали» об’єкта,
          додавай його безпосередньо у
          картці об’єкта.
        </div>
      )}

      <button
        type="submit"
        disabled={
          isSubmitting ||
          !selectedItem ||
          isOutOfStock
        }
        className={`rounded-lg px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
          movementType === "Прихід"
            ? "bg-green-600 hover:bg-green-700"
            : "bg-orange-600 hover:bg-orange-700"
        }`}
      >
        {isSubmitting
          ? "Збереження..."
          : movementType === "Прихід"
            ? "Додати на склад"
            : "Списати зі складу"}
      </button>
    </form>
  );
}