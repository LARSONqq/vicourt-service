"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";

import { deleteEquipment } from "@/app/actions/equipmentActions";
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

type Props = {
  equipment: Equipment[];
  employees: Employee[];
  canManage?: boolean;
  today: string;
};

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "Справна":
      return "bg-green-50 text-green-700";

    case "В роботі":
      return "bg-blue-50 text-blue-700";

    case "Потребує ремонту":
      return "bg-red-50 text-red-700";

    case "На ремонті":
      return "bg-orange-50 text-orange-700";

    case "Списана":
      return "bg-gray-100 text-gray-600";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function EquipmentList({
  equipment,
  employees,
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

  const safeEmployees =
    useMemo(
      () =>
        Array.isArray(
          employees
        )
          ? employees
          : [],
      [employees]
    );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("Усі");

  const [
    status,
    setStatus,
  ] = useState("Усі");

  const [
    maintenanceFilter,
    setMaintenanceFilter,
  ] = useState("all");

  const [
    editingId,
    setEditingId,
  ] = useState<
    number | null
  >(null);

  const categories =
    useMemo(() => {
      const values =
        safeEquipment
          .map(
            (item) =>
              item.category
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          );

      return [
        "Усі",
        ...Array.from(
          new Set(values)
        ),
      ];
    }, [safeEquipment]);

  const statuses =
    useMemo(() => {
      const values =
        safeEquipment
          .map(
            (item) =>
              item.status
          )
          .filter(Boolean);

      return [
        "Усі",
        ...Array.from(
          new Set(values)
        ),
      ];
    }, [safeEquipment]);

  const filteredEquipment =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return safeEquipment.filter(
        (item) => {
          const searchableText =
            [
              item.name,
              item.category,
              item.inventory_number,
              item.responsible,
              item.location,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchableText.includes(
              normalizedSearch
            );

          const matchesCategory =
            category ===
              "Усі" ||
            item.category ===
              category;

          const matchesStatus =
            status ===
              "Усі" ||
            item.status ===
              status;

          const maintenanceState =
            evaluateEquipmentMaintenance(
              item,
              today
            );
          const maintenanceKind =
            getEquipmentMaintenanceOverallKind(
              maintenanceState
            );
          const matchesMaintenance =
            maintenanceFilter ===
              "all" ||
            (maintenanceFilter ===
              "attention" &&
              maintenanceState.isDue) ||
            (maintenanceFilter ===
              "scheduled" &&
              maintenanceKind ===
                "scheduled") ||
            (maintenanceFilter ===
              "unconfigured" &&
              maintenanceKind ===
                "unconfigured");

          return (
            matchesSearch &&
            matchesCategory &&
            matchesStatus &&
            matchesMaintenance
          );
        }
      );
    }, [
      safeEquipment,
      search,
      category,
      status,
      maintenanceFilter,
      today,
    ]);

  function toggleEdit(
    itemId: number
  ) {
    if (!canManage) {
      return;
    }

    setEditingId(
      (current) =>
        current === itemId
          ? null
          : itemId
    );
  }

  const columnCount =
    canManage
      ? 8
      : 7;

  return (
    <div className="min-w-0 space-y-5">
      {/* FILTERS */}
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:p-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_190px_210px]">
        <input
          type="search"
          value={search}
          onChange={(
            event
          ) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук за назвою, номером, відповідальним або локацією"
          className="min-h-11 w-full min-w-0 rounded-lg border px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />

        <select
          value={category}
          onChange={(
            event
          ) =>
            setCategory(
              event.target.value
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          {categories.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item ===
                "Усі"
                  ? "Усі категорії"
                  : item}
              </option>
            )
          )}
        </select>

        <select
          value={status}
          onChange={(
            event
          ) =>
            setStatus(
              event.target.value
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          {statuses.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item ===
                "Усі"
                  ? "Усі статуси"
                  : item}
              </option>
            )
          )}
        </select>

        <select
          value={maintenanceFilter}
          onChange={(event) =>
            setMaintenanceFilter(
              event.target.value
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          <option value="all">
            Уся техніка
          </option>
          <option value="attention">
            Потребує ТО
          </option>
          <option value="scheduled">
            ТО заплановано
          </option>
          <option value="unconfigured">
            ТО не налаштовано
          </option>
        </select>
      </div>

      {/* COUNT */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Знайдено одиниць техніки:{" "}
          <span className="font-semibold text-gray-800">
            {
              filteredEquipment.length
            }
          </span>
        </p>

        {!canManage && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Тільки перегляд
          </span>
        )}
      </div>

      {/* EMPTY */}
      {filteredEquipment.length ===
      0 ? (
        <div className="rounded-xl border bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            🛠️
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Техніки не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити пошук,
            категорію або статус.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="space-y-3 md:hidden">
            {filteredEquipment.map(
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
                    className={`min-w-0 rounded-xl border bg-white p-4 ${
                      serviceOverdue
                        ? "border-red-200"
                        : ""
                    }`}
                  >
                    {/* TOP */}
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-gray-900">
                          {
                            item.name
                          }
                        </h3>

                        <p className="mt-1 break-words text-xs text-gray-500">
                          {item.category ||
                            "Без категорії"}
                        </p>
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
                            toggleEdit(
                              item.id
                            )
                          }
                          className="min-h-10 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          {isEditing
                            ? "Закрити"
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
                            safeEmployees
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
          <div className="hidden overflow-x-auto rounded-xl border bg-white md:block">
            <table
              className={`w-full ${
                canManage
                  ? "min-w-[1250px]"
                  : "min-w-[1100px]"
              }`}
            >
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-4">
                    Назва
                  </th>

                  <th className="p-4">
                    Категорія
                  </th>

                  <th className="p-4">
                    Інвентарний номер
                  </th>

                  <th className="p-4">
                    Статус
                  </th>

                  <th className="p-4">
                    Відповідальний
                  </th>

                  <th className="p-4">
                    Локація
                  </th>

                  <th className="p-4">
                    Планове ТО
                  </th>

                  {canManage && (
                    <th className="p-4 text-right">
                      Дії
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredEquipment.map(
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
                        <tr className="border-t">
                          <td className="p-4">
                            <p className="font-medium">
                              {
                                item.name
                              }
                            </p>

                            {item.notes && (
                              <p className="mt-1 max-w-xs truncate text-sm text-gray-500">
                                {
                                  item.notes
                                }
                              </p>
                            )}
                          </td>

                          <td className="p-4 text-gray-600">
                            {item.category ||
                              "Без категорії"}
                          </td>

                          <td className="p-4 font-medium">
                            {item.inventory_number ||
                              "Не вказано"}
                          </td>

                          <td className="p-4">
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

                          <td className="p-4 text-gray-600">
                            {item.responsible ||
                              "Не призначено"}
                          </td>

                          <td className="p-4 text-gray-600">
                            {item.location ||
                              "Не вказано"}
                          </td>

                          <td className="p-4">
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
                          </td>

                          {canManage && (
                            <td className="p-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleEdit(
                                      item.id
                                    )
                                  }
                                  className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                                >
                                  {isEditing
                                    ? "Закрити"
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
                              className="p-4"
                            >
                              <EditEquipmentForm
                                equipment={
                                  item
                                }
                                employees={
                                  safeEmployees
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
