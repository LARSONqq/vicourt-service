"use client";

import { useState } from "react";

import type { WarehouseItem } from "@/types/warehouseItem";

import AddWarehouseItemForm from "./AddWarehouseItemForm";
import AddWarehouseMovementForm from "./AddWarehouseMovementForm";

type Props = {
  items: WarehouseItem[];
};

type ActiveForm =
  | "item"
  | "movement"
  | null;

export default function WarehouseActions({
  items,
}: Props) {
  const [
    activeForm,
    setActiveForm,
  ] = useState<ActiveForm>(
    null
  );

  function toggleForm(
    form: ActiveForm
  ) {
    setActiveForm(
      (current) =>
        current === form
          ? null
          : form
    );
  }

  return (
    <div className="min-w-0">
      {/* ACTION BUTTONS */}
      <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="button"
          onClick={() =>
            toggleForm(
              "item"
            )
          }
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition sm:w-auto ${
            activeForm ===
            "item"
              ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {activeForm ===
          "item"
            ? "Закрити форму"
            : "+ Додати позицію"}
        </button>

        <button
          type="button"
          onClick={() =>
            toggleForm(
              "movement"
            )
          }
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition sm:w-auto ${
            activeForm ===
            "movement"
              ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "border border-green-600 bg-white text-green-700 hover:bg-green-50"
          }`}
        >
          {activeForm ===
          "movement"
            ? "Закрити форму"
            : "Корекція залишку"}
        </button>
      </div>

      {/* ADD ITEM */}
      {activeForm ===
        "item" && (
        <div className="mt-4 min-w-0 rounded-xl border bg-white p-4 sm:mt-5 sm:p-5">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Нова позиція складу
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Додай новий матеріал
              або товар на склад
            </p>
          </div>

          <AddWarehouseItemForm
            onCreated={() =>
              setActiveForm(
                null
              )
            }
          />
        </div>
      )}

      {/* MOVEMENT */}
      {activeForm ===
        "movement" && (
        <div className="mt-4 min-w-0 rounded-xl border bg-white p-4 sm:mt-5 sm:p-5">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Корекція залишку
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Контрольована зміна фактичної кількості з обов’язковою причиною
            </p>
          </div>

          <AddWarehouseMovementForm
            items={items}
            onCreated={() =>
              setActiveForm(
                null
              )
            }
          />
        </div>
      )}
    </div>
  );
}
