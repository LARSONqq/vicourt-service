"use client";

import { useState } from "react";

import {
  getEquipmentEditorEmployees,
  getEquipmentServiceFormOptions,
} from "@/app/actions/equipmentActions";

import type { AppCurrency } from "@/types/appSettings";
import type { Employee } from "@/types/employee";
import type {
  EquipmentServiceFormOption,
} from "@/types/equipment";

import AddEquipmentForm from "./AddEquipmentForm";
import AddEquipmentServiceForm from "./AddEquipmentServiceForm";

type Props = {
  currency: AppCurrency;
  today: string;
};

type ActiveForm =
  | "equipment"
  | "service"
  | null;

export default function EquipmentActions({
  currency,
  today,
}: Props) {
  const [
    activeForm,
    setActiveForm,
  ] = useState<ActiveForm>(
    null
  );
  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);
  const [
    hasLoadedEmployees,
    setHasLoadedEmployees,
  ] = useState(false);
  const [
    isLoadingEmployees,
    setIsLoadingEmployees,
  ] = useState(false);
  const [
    serviceEquipment,
    setServiceEquipment,
  ] = useState<
    EquipmentServiceFormOption[]
  >([]);
  const [
    hasLoadedServiceEquipment,
    setHasLoadedServiceEquipment,
  ] = useState(false);
  const [
    isLoadingServiceEquipment,
    setIsLoadingServiceEquipment,
  ] = useState(false);
  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function toggleForm(
    form: ActiveForm
  ) {
    if (activeForm === form) {
      setActiveForm(null);
      setErrorMessage("");
      return;
    }

    setErrorMessage("");

    if (
      form === "equipment" &&
      !hasLoadedEmployees
    ) {
      setIsLoadingEmployees(true);

      try {
        const options =
          await getEquipmentEditorEmployees();

        setEmployees(options);
        setHasLoadedEmployees(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити форму техніки."
        );
        return;
      } finally {
        setIsLoadingEmployees(false);
      }
    }

    if (
      form === "service" &&
      !hasLoadedServiceEquipment
    ) {
      setIsLoadingServiceEquipment(
        true
      );

      try {
        const options =
          await getEquipmentServiceFormOptions();

        setServiceEquipment(
          options
        );
        setHasLoadedServiceEquipment(
          true
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити форму обслуговування."
        );
        return;
      } finally {
        setIsLoadingServiceEquipment(
          false
        );
      }
    }

    setActiveForm(form);
  }

  return (
    <div className="min-w-0">
      {/* ACTION BUTTONS */}
      <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="button"
          onClick={() =>
            void toggleForm(
              "equipment"
            )
          }
          disabled={
            isLoadingEmployees ||
            isLoadingServiceEquipment
          }
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
            activeForm ===
            "equipment"
              ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {activeForm ===
          "equipment"
            ? "Закрити форму"
            : isLoadingEmployees
              ? "Завантаження…"
              : "+ Додати техніку"}
        </button>

        <button
          type="button"
          onClick={() =>
            void toggleForm(
              "service"
            )
          }
          disabled={
            isLoadingEmployees ||
            isLoadingServiceEquipment
          }
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
            activeForm ===
            "service"
              ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "border border-green-600 bg-white text-green-700 hover:bg-green-50"
          }`}
        >
          {activeForm ===
          "service"
            ? "Закрити форму"
            : isLoadingServiceEquipment
              ? "Завантаження…"
              : "+ Додати обслуговування"}
        </button>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

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
            onCreated={() => {
              setActiveForm(
                null
              );
              setServiceEquipment(
                []
              );
              setHasLoadedServiceEquipment(
                false
              );
            }}
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
              serviceEquipment
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
