"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  completeEquipmentMaintenance,
} from "@/app/actions/equipmentServiceActions";
import {
  getEquipmentMaintenanceLabel,
  getEquipmentMaintenanceState,
} from "@/lib/equipmentMaintenance";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  Equipment,
} from "@/types/equipment";

type Props = {
  equipment: Equipment[];
  currency: AppCurrency;
  canManage: boolean;
  today: string;
};

function getStateClasses(
  kind: ReturnType<
    typeof getEquipmentMaintenanceState
  >["kind"]
) {
  switch (kind) {
    case "today":
      return "bg-orange-50 text-orange-700";

    case "overdue":
      return "bg-red-50 text-red-700";

    case "scheduled":
      return "bg-green-50 text-green-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getStateRank(
  equipment: Equipment,
  today: string
) {
  const state =
    getEquipmentMaintenanceState(
      equipment.maintenance_interval_days,
      equipment.next_service_date,
      today
    );

  switch (state.kind) {
    case "overdue":
      return 0;

    case "today":
      return 1;

    case "scheduled":
      return 2;

    case "unscheduled":
      return 3;

    case "unconfigured":
      return 4;
  }
}

export default function EquipmentMaintenancePanel({
  equipment,
  currency,
  canManage,
  today,
}: Props) {
  const router =
    useRouter();
  const [activeId, setActiveId] =
    useState<number | null>(
      null
    );
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const sortedEquipment =
    useMemo(
      () =>
        [...equipment].sort(
          (first, second) => {
            const rankDifference =
              getStateRank(
                first,
                today
              ) -
              getStateRank(
                second,
                today
              );

            if (rankDifference !== 0) {
              return rankDifference;
            }

            if (
              first.next_service_date &&
              second.next_service_date &&
              first.next_service_date !==
                second.next_service_date
            ) {
              return first.next_service_date.localeCompare(
                second.next_service_date
              );
            }

            return first.name.localeCompare(
              second.name,
              "uk"
            );
          }
        ),
      [equipment, today]
    );

  function toggleForm(
    equipmentId: number
  ) {
    setActiveId((current) =>
      current === equipmentId
        ? null
        : equipmentId
    );
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result =
        await completeEquipmentMaintenance(
          formData
        );

      if (!result.success) {
        setErrorMessage(
          result.message
        );
        return;
      }

      setSuccessMessage(
        result.message
      );
      setActiveId(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося завершити планове ТО."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Планове ТО
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Графік технічного обслуговування та швидке завершення поточного циклу.
          </p>
        </div>

        <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          Одиниць: {equipment.length}
        </span>
      </div>

      {successMessage && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {successMessage}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

      {sortedEquipment.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed bg-gray-50 p-6 text-center text-sm text-gray-500">
          Спочатку додайте техніку.
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {sortedEquipment.map(
            (item) => {
              const state =
                getEquipmentMaintenanceState(
                  item.maintenance_interval_days,
                  item.next_service_date,
                  today
                );
              const formOpen =
                activeId === item.id;

              return (
                <article
                  key={item.id}
                  className={`min-w-0 rounded-xl border p-4 ${
                    state.kind === "overdue"
                      ? "border-red-200"
                      : state.kind === "today"
                        ? "border-orange-200"
                        : "border-gray-200"
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-gray-900">
                        {item.name}
                      </h3>

                      {item.inventory_number && (
                        <p className="mt-1 break-all text-xs text-gray-500">
                          {item.inventory_number}
                        </p>
                      )}
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${getStateClasses(
                        state.kind
                      )}`}
                    >
                      {getEquipmentMaintenanceLabel(
                        state
                      )}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="text-xs text-gray-500">
                        Періодичність
                      </dt>
                      <dd className="mt-1 break-words text-sm font-medium text-gray-800">
                        {item.maintenance_interval_days
                          ? `Кожні ${item.maintenance_interval_days} днів`
                          : "Не налаштовано"}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-xs text-gray-500">
                        Останнє ТО
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-gray-800">
                        {formatDateValue(
                          item.last_maintenance_date
                        ) || "Не виконувалось"}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-xs text-gray-500">
                        Наступне ТО
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-gray-800">
                        {formatDateValue(
                          item.next_service_date
                        ) || "Не заплановано"}
                      </dd>
                    </div>
                  </dl>

                  {canManage &&
                    item.maintenance_interval_days && (
                    <div className="mt-4 border-t pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          toggleForm(
                            item.id
                          )
                        }
                        disabled={isSubmitting}
                        className="min-h-10 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
                      >
                        {formOpen
                          ? "Закрити"
                          : "ТО виконано"}
                      </button>
                    </div>
                  )}

                  {canManage &&
                    !item.maintenance_interval_days && (
                    <p className="mt-4 border-t pt-4 text-xs leading-5 text-gray-500">
                      Спочатку вкажіть періодичність у формі редагування техніки.
                    </p>
                  )}

                  {formOpen && (
                    <form
                      action={handleSubmit}
                      className="mt-4 min-w-0 space-y-4 rounded-lg border bg-gray-50 p-3"
                    >
                      <input
                        type="hidden"
                        name="equipment_id"
                        value={item.id}
                      />

                      <p className="text-sm text-gray-700">
                        Дата виконання: {formatDateValue(
                          today
                        )}
                      </p>

                      <label className="block min-w-0 text-sm font-medium text-gray-700">
                        Вартість, {currency}

                        <input
                          type="number"
                          name="cost"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          defaultValue="0"
                          className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 outline-none transition focus:border-green-600"
                        />
                      </label>

                      <label className="block min-w-0 text-sm font-medium text-gray-700">
                        Примітка

                        <textarea
                          name="description"
                          rows={3}
                          placeholder="Виконані роботи або важливі деталі"
                          className="mt-2 w-full resize-none rounded-lg border bg-white px-3 py-2 outline-none transition placeholder:text-gray-400 focus:border-green-600"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="min-h-10 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmitting
                          ? "Збереження…"
                          : "Підтвердити ТО"}
                      </button>
                    </form>
                  )}
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}
