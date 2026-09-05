"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getObjectEditorEmployees,
  updateObject,
} from "@/app/actions/objectActions";
import DeleteObjectButton from "./DeleteObjectButton";
import {
  formatDateValue,
} from "@/lib/kyivDate";
import {
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";

import type { Employee } from "@/types/employee";
import type { ObjectItem } from "@/types/object";

type ObjectEditorEmployee = Pick<
  Employee,
  | "id"
  | "first_name"
  | "last_name"
  | "position"
  | "status"
>;

type Props = {
  object: ObjectItem;
  employees?: ObjectEditorEmployee[];
  canManage?: boolean;
};

const standardStatuses = [
  "Новий",
  "В роботі",
  "На постійному обслуговуванні",
  "Під періодичним наглядом",
  "Призупинено",
  "Завершено",
];

function getStatusStyle(
  status: string | null
) {
  switch (status) {
    case "Новий":
      return "bg-blue-100 text-blue-700";
    case "В роботі":
      return "bg-green-100 text-green-700";
    case "На постійному обслуговуванні":
      return "bg-purple-100 text-purple-700";
    case "Під періодичним наглядом":
      return "bg-rose-100 text-rose-700";
    case "Призупинено":
      return "bg-yellow-100 text-yellow-700";
    case "Завершено":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function ObjectPassportHeader({
  object,
  employees = [],
  canManage = false,
}: Props) {
  const router = useRouter();

  const [isEditing, setIsEditing] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [editorEmployees, setEditorEmployees] =
    useState(employees);

  const [hasLoadedEditorEmployees, setHasLoadedEditorEmployees] =
    useState(
      employees.length > 0
    );

  const [errorMessage, setErrorMessage] =
    useState("");

  const currentStatus =
    object.status || "В роботі";

  const [editingStatus, setEditingStatus] =
    useState(currentStatus);

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

  async function handleStartEditing() {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (!hasLoadedEditorEmployees) {
        const loadedEmployees =
          await getObjectEditorEmployees();

        setEditorEmployees(
          loadedEmployees
        );
        setHasLoadedEditorEmployees(
          true
        );
      }
      setIsEditing(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося завантажити форму редагування."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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

                {editorEmployees.map(
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

              {editorEmployees.length ===
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
                value={editingStatus}
                onChange={(event) =>
                  setEditingStatus(
                    event.target.value
                  )
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

          {editingStatus ===
            PERIODIC_SUPERVISION_STATUS && (
            <fieldset className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <legend className="px-1 font-semibold text-gray-900">
                Періодичний нагляд
              </legend>

              <p className="mt-1 text-sm text-gray-600">
                Налаштуйте інтервал і
                дату наступного огляду.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Періодичність, днів
                  </label>

                  <input
                    type="number"
                    name="supervision_interval_days"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    list={`object-${object.id}-supervision-intervals`}
                    defaultValue={
                      object.supervision_interval_days ??
                      ""
                    }
                    className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
                    placeholder="Наприклад, 14"
                  />

                  <datalist
                    id={`object-${object.id}-supervision-intervals`}
                  >
                    <option value="7" />
                    <option value="14" />
                    <option value="30" />
                  </datalist>
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Дата наступного
                    огляду
                  </label>

                  <input
                    type="date"
                    name="next_supervision_date"
                    defaultValue={
                      object.next_supervision_date ||
                      ""
                    }
                    className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Останній огляд: {formatDateValue(
                  object.last_supervision_date
                ) || "ще не виконувався"}
                . Дата оновлюється через
                дію «Огляд виконано».
              </p>
            </fieldset>
          )}

          <fieldset className="rounded-xl border bg-gray-50 p-4">
            <legend className="px-1 font-semibold text-gray-900">
              Фінанси
            </legend>

            <p className="mt-1 text-sm text-gray-500">
              Очисти поле, щоб
              повернути значення у
              стан «Не вказано».
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Плановий бюджет
                  витрат, грн
                </label>

                <input
                  type="number"
                  name="cost_budget"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={
                    object.cost_budget ??
                    ""
                  }
                  className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
                />
              </div>

              <div className="min-w-0">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Вартість для
                  клієнта, грн
                </label>

                <input
                  type="number"
                  name="client_price"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={
                    object.client_price ??
                    ""
                  }
                  className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
                />
              </div>
            </div>
          </fieldset>

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

                setEditingStatus(
                  currentStatus
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
    <section className="min-w-0 rounded-2xl border bg-white shadow-sm">
      <div className="min-w-0 p-4 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Паспорт об’єкта
            </p>

            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-2xl font-bold text-gray-900 sm:text-3xl">
                {object.name}
              </h1>

              <span
                className={
                  "w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium " +
                  getStatusStyle(
                    object.status
                  )
                }
              >
                {object.status ||
                  "Без статусу"}
              </span>
            </div>

            <p className="mt-2 break-words text-sm text-gray-500 sm:text-base">
              {object.address ||
                "Адресу не вказано"}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            {object.phone && (
              <a
                href={
                  "tel:" +
                  object.phone
                }
                className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-50"
              >
                Зателефонувати
              </a>
            )}

            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={
                    handleStartEditing
                  }
                  disabled={
                    isSubmitting
                  }
                  className="min-h-11 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  {isSubmitting
                    ? "Завантаження…"
                    : "Редагувати"}
                </button>

                <details className="relative col-span-2 sm:col-span-1">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                    Ще
                  </summary>

                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg">
                    <p className="px-2 pb-2 text-xs text-gray-500">
                      Небезпечні дії
                    </p>
                    <DeleteObjectButton
                      objectId={
                        object.id
                      }
                      objectName={
                        object.name
                      }
                    />
                  </div>
                </details>
              </>
            ) : (
              <span className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 sm:col-span-1">
                Тільки перегляд
              </span>
            )}
          </div>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}
      </div>

      <dl className="grid min-w-0 grid-cols-1 divide-y border-t bg-gray-50/60 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
        <div className="min-w-0 py-4 sm:pr-5">
          <dt className="text-xs text-gray-500">
            Замовник
          </dt>
          <dd className="mt-1 break-words font-medium text-gray-900">
            {object.customer ||
              "Не вказано"}
          </dd>
        </div>

        <div className="min-w-0 py-4 sm:px-5">
          <dt className="text-xs text-gray-500">
            Телефон
          </dt>
          <dd className="mt-1 break-all font-medium text-gray-900">
            {object.phone ||
              "Не вказано"}
          </dd>
        </div>

        <div className="min-w-0 py-4 sm:pl-5">
          <dt className="text-xs text-gray-500">
            Відповідальний
          </dt>
          <dd className="mt-1 break-words font-medium text-gray-900">
            {object.manager ||
              "Не призначено"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
