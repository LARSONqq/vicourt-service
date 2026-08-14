"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateObject } from "@/app/actions/objectActions";
import type { Employee } from "@/types/employee";
import type { ObjectItem } from "@/types/object";

type Props = {
  object: ObjectItem;
  employees?: Employee[];
};

const standardStatuses = [
  "Новий",
  "В роботі",
  "Призупинено",
  "Завершено",
];

export default function ObjectInfo({
  object,
  employees = [],
}: Props) {
  const router = useRouter();

  const [isEditing, setIsEditing] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const currentStatus =
    object.status || "В роботі";

  const statuses = useMemo(() => {
    if (
      standardStatuses.includes(currentStatus)
    ) {
      return standardStatuses;
    }

    return [
      currentStatus,
      ...standardStatuses,
    ];
  }, [currentStatus]);

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateObject(formData);

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити об’єкт."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isEditing) {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h2 className="mb-5 text-xl font-semibold">
          Редагування об’єкта
        </h2>

        <form
          action={handleSubmit}
          className="space-y-5"
        >
          <input
            type="hidden"
            name="object_id"
            value={object.id}
          />

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Назва об’єкта
            </label>

            <input
              name="name"
              defaultValue={object.name}
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Замовник
              </label>

              <input
                name="customer"
                defaultValue={
                  object.customer || ""
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Телефон
              </label>

              <input
                type="tel"
                name="phone"
                defaultValue={
                  object.phone || ""
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Відповідальний працівник
              </label>

              <select
                name="responsible_employee_id"
                defaultValue={
                  object.responsible_employee_id
                    ? String(
                        object.responsible_employee_id
                      )
                    : ""
                }
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
                    {employee.status !==
                    "Активний"
                      ? ` (${employee.status})`
                      : ""}
                  </option>
                ))}
              </select>

              {employees.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Працівників ще не додано або список не
                  завантажився.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Статус
              </label>

              <select
                name="status"
                defaultValue={currentStatus}
                className="w-full rounded-lg border bg-white p-3"
              >
                {statuses.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Адреса
            </label>

            <input
              name="address"
              defaultValue={
                object.address || ""
              }
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-green-600 px-5 py-3 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Збереження..."
                : "Зберегти зміни"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setErrorMessage("");
              }}
              disabled={isSubmitting}
              className="rounded-lg border px-5 py-3 hover:bg-gray-50 disabled:opacity-60"
            >
              Скасувати
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">
          Інформація
        </h2>

        <button
          type="button"
          onClick={() => {
            setIsEditing(true);
            setErrorMessage("");
          }}
          className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
        >
          Редагувати
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="text-sm text-gray-500">
            Замовник
          </p>

          <p className="font-medium">
            {object.customer || "Не вказано"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">
            Телефон
          </p>

          <p className="font-medium">
            {object.phone || "Не вказано"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">
            Відповідальний
          </p>

          <p className="font-medium">
            {object.manager || "Не призначено"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">
            Адреса
          </p>

          <p className="font-medium">
            {object.address || "Не вказано"}
          </p>
        </div>
      </div>
    </section>
  );
}
