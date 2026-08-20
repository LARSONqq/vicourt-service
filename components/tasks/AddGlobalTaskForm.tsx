"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createObjectTask } from "@/app/actions/taskActions";

import type { Employee } from "@/types/employee";
import type { ObjectItem } from "@/types/object";

type Props = {
  objects: ObjectItem[];
  employees: Employee[];
  initialDueDate?: string;
  defaultOpen?: boolean;
  hideToggleButton?: boolean;
  buttonLabel?: string;
  onClose?: () => void;
};

export default function AddGlobalTaskForm({
  objects,
  employees,
  initialDueDate = "",
  defaultOpen = false,
  hideToggleButton = false,
  buttonLabel = "+ Додати завдання",
  onClose,
}: Props) {
  const router =
    useRouter();

  const [
    isOpen,
    setIsOpen,
  ] = useState(
    defaultOpen
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  function closeForm() {
    setIsOpen(false);
    setErrorMessage("");

    onClose?.();
  }

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createObjectTask(
        formData
      );

      router.refresh();

      closeForm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося створити завдання."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-w-0">
      {/* TOGGLE */}
      {!hideToggleButton && (
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              closeForm();
            } else {
              setIsOpen(true);
            }
          }}
          className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition sm:w-fit ${
            isOpen
              ? "border bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {isOpen
            ? "Закрити форму"
            : buttonLabel}
        </button>
      )}

      {/* FORM */}
      {isOpen && (
        <form
          action={handleSubmit}
          className={`min-w-0 space-y-5 rounded-xl border bg-white p-4 sm:p-6 ${
            hideToggleButton
              ? ""
              : "mt-4 sm:mt-5"
          }`}
        >
          {/* HEADER */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Нове завдання
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Створи завдання та
              прив’яжи його до об’єкта
            </p>
          </div>

          {/* ERROR */}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
              {errorMessage}
            </div>
          )}

          {/* OBJECT */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Об’єкт
            </label>

            <select
              name="object_id"
              defaultValue=""
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              required
            >
              <option
                value=""
                disabled
              >
                Обери об’єкт
              </option>

              {objects.map(
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

            {objects.length ===
              0 && (
              <p className="mt-2 text-xs text-orange-600">
                Спочатку додай хоча б
                один об’єкт.
              </p>
            )}
          </div>

          {/* TITLE */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Назва завдання
            </label>

            <input
              type="text"
              name="title"
              placeholder="Наприклад: підготувати ділянку"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />
          </div>

          {/* DESCRIPTION */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Опис
            </label>

            <textarea
              name="description"
              rows={4}
              placeholder="Додаткова інформація про завдання"
              className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            />
          </div>

          {/* DETAILS */}
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {/* DATE */}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Термін виконання
              </label>

              <input
                type="date"
                name="due_date"
                defaultValue={
                  initialDueDate
                }
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              />
            </div>

            {/* EMPLOYEE */}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Відповідальний
              </label>

              <select
                name="assigned_employee_id"
                defaultValue=""
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              >
                <option value="">
                  Не призначати
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={
                        employee.id
                      }
                      value={
                        employee.id
                      }
                    >
                      {
                        employee.last_name
                      }{" "}
                      {
                        employee.first_name
                      }
                      {employee.position
                        ? ` — ${employee.position}`
                        : ""}
                      {employee.status !==
                      "Активний"
                        ? ` (${employee.status})`
                        : ""}
                    </option>
                  )
                )}
              </select>

              {employees.length ===
                0 && (
                <p className="mt-2 text-xs text-orange-600">
                  Список працівників
                  порожній.
                </p>
              )}
            </div>

            {/* PRIORITY */}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Пріоритет
              </label>

              <select
                name="priority"
                defaultValue="Середній"
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              >
                <option value="Низький">
                  Низький
                </option>

                <option value="Середній">
                  Середній
                </option>

                <option value="Високий">
                  Високий
                </option>

                <option value="Терміновий">
                  Терміновий
                </option>
              </select>
            </div>

            {/* STATUS */}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Статус
              </label>

              <select
                name="status"
                defaultValue="Заплановано"
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              >
                <option value="Заплановано">
                  Заплановано
                </option>

                <option value="В роботі">
                  В роботі
                </option>

                <option value="Виконано">
                  Виконано
                </option>
              </select>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="grid grid-cols-1 gap-2 border-t pt-5 sm:flex sm:flex-wrap sm:gap-3">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                objects.length === 0
              }
              className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
            >
              {isSubmitting
                ? "Збереження..."
                : "Зберегти завдання"}
            </button>

            <button
              type="button"
              onClick={
                closeForm
              }
              disabled={
                isSubmitting
              }
              className="min-h-11 w-full rounded-lg border bg-white px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:w-fit"
            >
              Скасувати
            </button>
          </div>
        </form>
      )}
    </div>
  );
}