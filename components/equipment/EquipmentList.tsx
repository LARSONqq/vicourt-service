"use client";

import Link from "next/link";
import {
  Fragment,
  useMemo,
  useState,
} from "react";

import {
  deleteEquipment,
  getEquipmentEditorEmployees,
} from "@/app/actions/equipmentActions";
import {
  evaluateEquipmentMaintenance,
  formatEquipmentUsage,
  getEquipmentMaintenanceOverallKind,
  getEquipmentMaintenanceOverallLabel,
  getEquipmentUsageTypeLabel,
} from "@/lib/equipmentMaintenance";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";

import { EditEquipmentForm } from "./EditEquipmentForm";
import {
  EquipmentCategoryIcon,
  EquipmentUsageProgress,
} from "./EquipmentVisuals";

type Props = {
  equipment: Equipment[];
  total: number;
  hasFilters: boolean;
  canManage?: boolean;
  today: string;
};

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "Справна":
      return "vc-status-success";

    case "В роботі":
      return "vc-status-info";

    case "Потребує ремонту":
      return "vc-status-danger";

    case "На ремонті":
      return "vc-status-warning";

    case "Списана":
      return "bg-gray-100 text-gray-600";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function EquipmentList({
  equipment,
  total,
  hasFilters,
  canManage = false,
  today,
}: Props) {
  const safeEquipment =
    useMemo(
      () =>
        Array.isArray(
          equipment
        )
          ? equipment
          : [],
      [equipment]
    );

  const [
    editingId,
    setEditingId,
  ] = useState<
    number | null
  >(null);
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
    employeeLoadError,
    setEmployeeLoadError,
  ] = useState("");

  async function toggleEdit(
    itemId: number
  ) {
    if (!canManage) {
      return;
    }

    if (editingId === itemId) {
      setEditingId(null);
      setEmployeeLoadError("");
      return;
    }

    if (!hasLoadedEmployees) {
      setIsLoadingEmployees(true);
      setEmployeeLoadError("");

      try {
        const options =
          await getEquipmentEditorEmployees();

        setEmployees(options);
        setHasLoadedEmployees(true);
      } catch (error) {
        setEmployeeLoadError(
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити форму редагування."
        );
        return;
      } finally {
        setIsLoadingEmployees(false);
      }
    }

    setEditingId(itemId);
  }

  const columnCount =
    canManage
      ? 8
      : 7;

  return (
    <div className="min-w-0 space-y-5">
      {/* COUNT */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Знайдено одиниць техніки:{" "}
          <span className="font-semibold text-gray-800">
            {
              total
            }
          </span>
        </p>

        {!canManage && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Тільки перегляд
          </span>
        )}
      </div>

      {employeeLoadError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {employeeLoadError}
        </p>
      )}

      {/* EMPTY */}
      {safeEquipment.length ===
      0 ? (
        <div className="vc-surface p-6 text-center sm:p-5">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            🛠️
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Техніки не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {hasFilters
              ? "Спробуйте змінити пошук, категорію або статус."
              : "Додайте першу одиницю техніки, щоб вона з’явилася у списку."}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="space-y-3 md:hidden">
            {safeEquipment.map(
              (item) => {
                const maintenanceState =
                  evaluateEquipmentMaintenance(
                    item,
                    today
                  );
                const maintenanceKind =
                  getEquipmentMaintenanceOverallKind(
                    maintenanceState
                  );
                const serviceOverdue =
                  maintenanceKind === "overdue" ||
                  maintenanceKind === "due";

                const isEditing =
                  canManage &&
                  editingId ===
                    item.id;

                return (
                  <article
                    key={
                      item.id
                    }
                    className={`vc-surface min-w-0 p-4 transition hover:bg-muted/35 ${
                      serviceOverdue
                        ? "border-red-200"
                        : ""
                    }`}
                  >
                    {/* TOP */}
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <EquipmentCategoryIcon category={item.category} />
                        <div className="min-w-0">
                        <h3 className="break-words font-semibold">
                          <Link
                            href={`/equipment/${item.id}`}
                            className="rounded-sm text-gray-900 transition hover:text-green-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            {item.name}
                          </Link>
                        </h3>

                        <p className="mt-1 break-words text-xs text-gray-500">
                          {item.category ||
                            "Без категорії"}
                        </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(
                          item.status
                        )}`}
                      >
                        {
                          item.status
                        }
                      </span>
                    </div>

                    {/* INVENTORY */}
                    <div className="mt-4 rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        Інвентарний номер
                      </p>

                      <p className="mt-1 break-all font-semibold text-gray-800">
                        {item.inventory_number ||
                          "Не вказано"}
                      </p>
                    </div>

                    {/* DETAILS */}
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Відповідальний
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {item.responsible ||
                            "Не призначено"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Локація
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {item.location ||
                            "Не вказано"}
                        </p>
                      </div>

                      <div className="col-span-2 min-w-0">
                        <p className="text-xs text-gray-500">
                          Планове ТО
                        </p>

                        <p
                          className={`mt-1 text-sm font-semibold ${
                            serviceOverdue
                              ? "text-red-600"
                              : "text-gray-800"
                          }`}
                        >
                          {getEquipmentMaintenanceOverallLabel(
                            maintenanceState
                          )}
                        </p>

                        {item.maintenance_interval_days &&
                          item.next_service_date && (
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDateValue(
                              item.next_service_date
                            )}
                          </p>
                        )}

                        <p className="mt-2 break-words text-xs text-gray-500">
                          {getEquipmentUsageTypeLabel(
                            item.usage_type
                          )}
                          {item.usage_type !== "none"
                            ? ` · ${formatEquipmentUsage(
                                item.current_usage,
                                item.usage_type
                              )}`
                            : ""}
                        </p>
                        <EquipmentUsageProgress equipment={item} compact />
                      </div>
                    </div>

                    {/* NOTES */}
                    {item.notes && (
                      <div className="mt-4 border-t pt-4">
                        <p className="text-xs text-gray-500">
                          Примітки
                        </p>

                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-gray-700">
                          {
                            item.notes
                          }
                        </p>
                      </div>
                    )}

                    {/* ACTIONS */}
                    {canManage && (
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            void toggleEdit(
                              item.id
                            )
                          }
                          disabled={isLoadingEmployees}
                          className="min-h-10 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          {isEditing
                            ? "Закрити"
                            : isLoadingEmployees
                              ? "Завантаження…"
                              : "Редагувати"}
                        </button>

                        <form
                          action={deleteEquipment.bind(
                            null,
                            item.id
                          )}
                          onSubmit={(
                            event
                          ) => {
                            const confirmed =
                              window.confirm(
                                `Видалити техніку «${item.name}»?`
                              );

                            if (
                              !confirmed
                            ) {
                              event.preventDefault();
                            }
                          }}
                          className="w-full"
                        >
                          <button
                            type="submit"
                            className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Видалити
                          </button>
                        </form>
                      </div>
                    )}

                    {/* MOBILE EDIT */}
                    {isEditing && (
                      <div className="mt-4 min-w-0 border-t pt-4">
                        <EditEquipmentForm
                          equipment={
                            item
                          }
                          employees={
                            employees
                          }
                          onCancel={() =>
                            setEditingId(
                              null
                            )
                          }
                        />
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div
            className="vc-table-shell hidden max-w-full overflow-x-auto overscroll-x-contain md:block"
            tabIndex={0}
            aria-label="Таблиця техніки. Прокручуйте горизонтально, щоб побачити всі стовпці та дії."
          >
            <table
              className="w-max min-w-full"
            >
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-3">
                    Назва
                  </th>

                  <th className="px-3 py-3">
                    Категорія
                  </th>

                  <th className="px-3 py-3">
                    Інвентарний номер
                  </th>

                  <th className="px-3 py-3">
                    Статус
                  </th>

                  <th className="px-3 py-3">
                    Відповідальний
                  </th>

                  <th className="px-3 py-3">
                    Локація
                  </th>

                  <th className="px-3 py-3">
                    Планове ТО
                  </th>

                  {canManage && (
                    <th className="px-3 py-3 text-right">
                      Дії
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {safeEquipment.map(
                  (item) => {
                    const maintenanceState =
                      evaluateEquipmentMaintenance(
                        item,
                        today
                      );
                    const maintenanceKind =
                      getEquipmentMaintenanceOverallKind(
                        maintenanceState
                      );
                    const serviceOverdue =
                      maintenanceKind === "overdue" ||
                      maintenanceKind === "due";

                    const isEditing =
                      canManage &&
                      editingId ===
                        item.id;

                    return (
                      <Fragment
                        key={
                          item.id
                        }
                      >
                        <tr className={`border-t transition hover:bg-gray-50/80 ${serviceOverdue ? "bg-red-50/25" : ""}`}>
                          <td className="px-3 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <EquipmentCategoryIcon category={item.category} className="h-9 w-9" />
                              <div className="min-w-0">
                            <p className="font-medium">
                              <Link
                                href={`/equipment/${item.id}`}
                                className="rounded-sm text-gray-900 transition hover:text-green-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {item.name}
                              </Link>
                            </p>

                            {item.notes && (
                              <p className="mt-1 max-w-xs truncate text-sm text-gray-500">
                                {
                                  item.notes
                                }
                              </p>
                            )}
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {item.category ||
                              "Без категорії"}
                          </td>

                          <td className="px-3 py-3 font-medium">
                            {item.inventory_number ||
                              "Не вказано"}
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusClasses(
                                item.status
                              )}`}
                            >
                              {
                                item.status
                              }
                            </span>
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {item.responsible ||
                              "Не призначено"}
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {item.location ||
                              "Не вказано"}
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={
                                serviceOverdue
                                  ? "font-medium text-red-600"
                                  : "text-gray-600"
                              }
                            >
                              {getEquipmentMaintenanceOverallLabel(
                                maintenanceState
                              )}
                            </span>

                            {item.maintenance_interval_days &&
                              item.next_service_date && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {formatDateValue(
                                    item.next_service_date
                                  )}
                                </p>
                              )}

                            <p className="mt-1 max-w-xs break-words text-xs text-gray-500">
                              {getEquipmentUsageTypeLabel(
                                item.usage_type
                              )}
                              {item.usage_type !== "none"
                                ? ` · ${formatEquipmentUsage(
                                    item.current_usage,
                                    item.usage_type
                                  )}`
                                : ""}
                            </p>
                            <EquipmentUsageProgress equipment={item} compact />
                          </td>

                          {canManage && (
                            <td className="whitespace-nowrap px-3 py-3">
                              <div className="flex min-w-max justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleEdit(
                                      item.id
                                    )
                                  }
                                  disabled={isLoadingEmployees}
                                  className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                                >
                                  {isEditing
                                    ? "Закрити"
                                    : isLoadingEmployees
                                      ? "Завантаження…"
                                      : "Редагувати"}
                                </button>

                                <form
                                  action={deleteEquipment.bind(
                                    null,
                                    item.id
                                  )}
                                  onSubmit={(
                                    event
                                  ) => {
                                    const confirmed =
                                      window.confirm(
                                        `Видалити техніку «${item.name}»?`
                                      );

                                    if (
                                      !confirmed
                                    ) {
                                      event.preventDefault();
                                    }
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                  >
                                    Видалити
                                  </button>
                                </form>
                              </div>
                            </td>
                          )}
                        </tr>

                        {isEditing && (
                          <tr className="border-t">
                            <td
                              colSpan={
                                columnCount
                              }
                              className="px-3 py-3"
                            >
                              <EditEquipmentForm
                                equipment={
                                  item
                                }
                                employees={
                                  employees
                                }
                                onCancel={() =>
                                  setEditingId(
                                    null
                                  )
                                }
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
