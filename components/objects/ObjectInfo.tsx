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
  "На постійному обслуговуванні",
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
      standardStatuses.includes(
        currentStatus
      )
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
      await updateObject(
        formData
      );

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
      <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold sm:text-xl">
            Редагування об’єкта
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Зміни інформацію про об’єкт
          </p>
        </div>

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
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Назва об’єкта
            </label>

            <input
              name="name"
              defaultValue={
                object.name
              }
              className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-3 outline-none transition focus:border-green-600"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Замовник
              </label>

              <input
                name="customer"
                defaultValue={
                  object.customer ||
                  ""
                }
                className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-3 outline-none transition focus:border-green-600"
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Телефон
              </label>

              <input
                type="tel"
                name="phone"
                defaultValue={
                  object.phone ||
                  ""
                }
                className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-3 outline-none transition focus:border-green-600"
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
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
                <p className="mt-2 text-xs text-gray-500">
                  Працівників ще не
                  додано або список не
                  завантажився.
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Статус
              </label>

              <select
                name="status"
                defaultValue={
                  currentStatus
                }
                className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              >
                {statuses.map(
                  (status) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {status}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Адреса
            </label>

            <input
              name="address"
              defaultValue={
                object.address ||
                ""
              }
              className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-3 outline-none transition focus:border-green-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 border-t pt-5 sm:flex sm:flex-wrap sm:gap-3">
            <button
              type="submit"
              disabled={
                isSubmitting
              }
              className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
            >
              {isSubmitting
                ? "Збереження..."
                : "Зберегти зміни"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEditing(
                  false
                );

                setErrorMessage(
                  ""
                );
              }}
              disabled={
                isSubmitting
              }
              className="min-h-11 w-full rounded-lg border px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:w-fit"
            >
              Скасувати
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
            Інформація
          </h2>

          <p className="mt-1 hidden text-sm text-gray-500 sm:block">
            Основні дані об’єкта
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsEditing(
              true
            );

            setErrorMessage(
              ""
            );
          }}
          className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:px-4"
        >
          Редагувати
        </button>
      </div>

      <div className="divide-y md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-6 md:divide-y-0">
        <div className="py-3 first:pt-0 md:py-0">
          <p className="text-xs text-gray-400 sm:text-sm">
            Замовник
          </p>

          <p className="mt-1 break-words font-medium text-gray-800">
            {object.customer ||
              "Не вказано"}
          </p>
        </div>

        <div className="py-3 md:py-0">
          <p className="text-xs text-gray-400 sm:text-sm">
            Телефон
          </p>

          {object.phone ? (
            <a
              href={`tel:${object.phone}`}
              className="mt-1 inline-block break-all font-medium text-green-700 hover:underline"
            >
              {object.phone}
            </a>
          ) : (
            <p className="mt-1 font-medium text-gray-800">
              Не вказано
            </p>
          )}
        </div>

        <div className="py-3 md:py-0">
          <p className="text-xs text-gray-400 sm:text-sm">
            Відповідальний
          </p>

          <p className="mt-1 break-words font-medium text-gray-800">
            {object.manager ||
              "Не призначено"}
          </p>
        </div>

        <div className="py-3 pb-0 md:py-0">
          <p className="text-xs text-gray-400 sm:text-sm">
            Адреса
          </p>

          <p className="mt-1 break-words font-medium text-gray-800">
            {object.address ||
              "Не вказано"}
          </p>
        </div>
      </div>
    </section>
  );
}