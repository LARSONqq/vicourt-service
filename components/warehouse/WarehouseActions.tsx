"use client";

import { useState } from "react";
import { ObjectItem } from "@/types/object";
import { WarehouseItem } from "@/types/warehouseItem";
import AddWarehouseItemForm from "./AddWarehouseItemForm";
import AddWarehouseMovementForm from "./AddWarehouseMovementForm";

type Props = {
  items: WarehouseItem[];
  objects: ObjectItem[];
};

type ActiveForm = "item" | "movement" | null;

export default function WarehouseActions({
  items,
  objects,
}: Props) {
  const [activeForm, setActiveForm] =
    useState<ActiveForm>(null);

  function toggleForm(form: ActiveForm) {
    setActiveForm((current) =>
      current === form ? null : form
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => toggleForm("item")}
          className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
        >
          {activeForm === "item"
            ? "Закрити"
            : "+ Додати позицію"}
        </button>

        <button
          type="button"
          onClick={() => toggleForm("movement")}
          className="rounded-lg border border-green-600 px-5 py-3 font-medium text-green-700 hover:bg-green-50"
        >
          {activeForm === "movement"
            ? "Закрити"
            : "Прихід / списання"}
        </button>
      </div>

      {activeForm === "item" && (
        <div className="mt-5 rounded-xl border bg-white p-5">
          <h2 className="mb-5 text-xl font-semibold">
            Нова позиція складу
          </h2>

          <AddWarehouseItemForm
            onCreated={() => setActiveForm(null)}
          />
        </div>
      )}

      {activeForm === "movement" && (
        <div className="mt-5 rounded-xl border bg-white p-5">
          <h2 className="mb-5 text-xl font-semibold">
            Рух товару
          </h2>

          <AddWarehouseMovementForm
            items={items}
            objects={objects}
            onCreated={() => setActiveForm(null)}
          />
        </div>
      )}
    </div>
  );
}