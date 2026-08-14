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
  const router = useRouter();

  const [isOpen, setIsOpen] =
    useState(defaultOpen);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  function closeForm() {
    setIsOpen(false);
    setErrorMessage("");
    onClose?.();
  }

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createObjectTask(formData);

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
    <div>
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
          className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
        >
          {isOpen ? "Закрити" : buttonLabel}
        </button>
      )}

      {isOpen && (
        <form
          action={handleSubmit}
          className={`space-y-5 rounded-xl border bg-white p-6 ${
            hideToggleButton ? "" : "mt-5"
          }`}
        >
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Об’єкт
            </label>

            <select
              name="object_id"
              defaultValue=""
              className="w-full rounded-lg border bg-white p-3"
              required
            >
              <option value="" disabled>
                Обери об’єкт
              </option>

              {objects.map((object) => (
                <option
                  key={object.id}
                  value={object.id}
                >
                  {object.name}
                </option>
              ))}
            </select>

            {objects.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Спочатку додай хоча б один об’єкт.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Назва завдання
            </label>

            <input
              type="text"
              name="title"
              placeholder="Наприклад: підготувати ділянку"
              className="w-full rounded-lg border bg-white p-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Опис
            </label>

            <textarea
              name="description"
              rows={4}
              placeholder="Додаткова інформація про завдання"
              className="w-full resize-none rounded-lg border bg-white p-3"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Термін виконання
              </label>

              <input
                type="date"
                name="due_date"
                defaultValue={initialDueDate}
                className="w-full rounded-lg border bg-white p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Відповідальний працівник
              </label>

              <select
                name="assigned_employee_id"
                defaultValue=""
                className="w-full rounded-lg border bg-white p-3"
              >
                <option value="">
                  Не призначати
                </option>

                {employees.map((employee) => (
                  <option
                    key={employee.id}
                    value={employee.id}
                  >
                    {employee.last_name}{" "}
                    {employee.first_name}
                    {employee.position
                      ? ` — ${employee.position}`
                      : ""}
                    {employee.status !== "Активний"
                      ? ` (${employee.status})`
                      : ""}
                  </option>
                ))}
              </select>

              {employees.length === 0 && (
                <p className="mt-2 text-xs text-red-600">
                  Список працівників порожній.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Пріоритет
              </label>

              <select
                name="priority"
                defaultValue="Середній"
                className="w-full rounded-lg border bg-white p-3"
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

            <div>
              <label className="mb-2 block text-sm font-medium">
                Статус
              </label>

              <select
                name="status"
                defaultValue="Заплановано"
                className="w-full rounded-lg border bg-white p-3"
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

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                objects.length === 0
              }
              className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Збереження..."
                : "Зберегти завдання"}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="rounded-lg border bg-white px-5 py-3 font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              Скасувати
            </button>
          </div>
        </form>
      )}
    </div>
  );
}