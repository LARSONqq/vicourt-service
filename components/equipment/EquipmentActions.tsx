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
  today: string;
};

type ActiveForm =
  | "equipment"
  | "service"
  | null;

export default function EquipmentActions({
  equipment,
  employees,
  currency,
  today,
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
              "equipment"
            )
          }
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition sm:w-auto ${
            activeForm ===
            "equipment"
              ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {activeForm ===
          "equipment"
            ? "Закрити форму"
            : "+ Додати техніку"}
        </button>

        <button
          type="button"
          onClick={() =>
            toggleForm(
              "service"
            )
          }
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition sm:w-auto ${
            activeForm ===
            "service"
              ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "border border-green-600 bg-white text-green-700 hover:bg-green-50"
          }`}
        >
          {activeForm ===
          "service"
            ? "Закрити форму"
            : "+ Додати обслуговування"}
        </button>
      </div>

      {/* ADD EQUIPMENT */}
      {activeForm ===
        "equipment" && (
        <div className="mt-4 min-w-0 rounded-xl border bg-white p-4 sm:mt-5 sm:p-5">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Нова одиниця техніки
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Додай нове обладнання
              або інструмент до
              обліку.
            </p>
          </div>

          <AddEquipmentForm
            employees={
              employees
            }
            onCreated={() =>
              setActiveForm(
                null
              )
            }
          />
        </div>
      )}

      {/* ADD SERVICE */}
      {activeForm ===
        "service" && (
        <div className="mt-4 min-w-0 rounded-xl border bg-white p-4 sm:mt-5 sm:p-5">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Новий запис
              обслуговування
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Додай ремонт,
              технічне обслуговування
              або інший сервісний
              запис.
            </p>
          </div>

          <AddEquipmentServiceForm
            equipment={
              equipment
            }
            currency={
              currency
            }
            today={today}
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
