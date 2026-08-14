"use client";

import { useState } from "react";
import type { AppCurrency } from "@/types/appSettings";
import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import AddEquipmentForm from "./AddEquipmentForm";
import AddEquipmentServiceForm from "./AddEquipmentServiceForm";

type Props = {
  equipment: Equipment[];
  employees: Employee[];
  currency: AppCurrency;
};

type ActiveForm =
  | "equipment"
  | "service"
  | null;

export default function EquipmentActions({
  equipment,
  employees,
  currency,
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
          onClick={() => toggleForm("equipment")}
          className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
        >
          {activeForm === "equipment"
            ? "Закрити"
            : "+ Додати техніку"}
        </button>

        <button
          type="button"
          onClick={() => toggleForm("service")}
          className="rounded-lg border border-green-600 px-5 py-3 font-medium text-green-700 hover:bg-green-50"
        >
          {activeForm === "service"
            ? "Закрити"
            : "+ Додати обслуговування"}
        </button>
      </div>

      {activeForm === "equipment" && (
        <div className="mt-5 rounded-xl border bg-white p-5">
          <h2 className="mb-5 text-xl font-semibold">
            Нова одиниця техніки
          </h2>

          <AddEquipmentForm
            employees={employees}
            onCreated={() =>
              setActiveForm(null)
            }
          />
        </div>
      )}

      {activeForm === "service" && (
        <div className="mt-5 rounded-xl border bg-white p-5">
          <h2 className="mb-5 text-xl font-semibold">
            Новий запис обслуговування
          </h2>

          <AddEquipmentServiceForm
            equipment={equipment}
            currency={currency}
            onCreated={() =>
              setActiveForm(null)
            }
          />
        </div>
      )}
    </div>
  );
}