"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";

import { deleteEquipment } from "@/app/actions/equipmentActions";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";

import { EditEquipmentForm } from "./EditEquipmentForm";

type Props = {
  equipment: Equipment[];
  employees: Employee[];
  canManage?: boolean;
};

function formatDate(
  date: string | null
) {
  if (!date) {
    return "Не вказано";
  }

  return new Intl.DateTimeFormat(
    "uk-UA"
  ).format(
    new Date(
      `${date}T00:00:00`
    )
  );
}

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

function isServiceOverdue(
  date: string | null
) {
  if (!date) {
    return false;
  }

  const serviceDate =
    new Date(
      `${date}T00:00:00`
    );

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return serviceDate < today;
}

export default function EquipmentList({
  equipment,
  employees,
  canManage = false,
}: Props) {
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
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const categories =
    useMemo(() => {
      const values =
        equipment
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
    }, [equipment]);

  const statuses =
    useMemo(() => {
      const values =
        equipment
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
    }, [equipment]);

  const filteredEquipment =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return equipment.filter(
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
            category === "Усі" ||
            item.category ===
              category;

          const matchesStatus =
            status === "Усі" ||
            item.status === status;

          return (
            matchesSearch &&
            matchesCategory &&
            matchesStatus
          );
        }
      );
    }, [
      equipment,
      search,
      category,
      status,
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
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 lg:grid-cols-[1fr_220px_220px]">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук за назвою, номером, відповідальним або локацією"
          className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
        />

        <select
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value
            )
          }
          className="w-full rounded-lg border bg-white px-4 py-3"
        >
          {categories.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item === "Усі"
                  ? "Усі категорії"
                  : item}
              </option>
            )
          )}
        </select>

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="w-full rounded-lg border bg-white px-4 py-3"
        >
          {statuses.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item === "Усі"
                  ? "Усі статуси"
                  : item}
              </option>
            )
          )}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Знайдено одиниць техніки:{" "}
          {
            filteredEquipment.length
          }
        </p>

        {!canManage && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Тільки перегляд
          </span>
        )}
      </div>

      {filteredEquipment.length ===
      0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">
            Техніки за цими
            параметрами не знайдено.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
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
                  Наступний сервіс
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
                  const serviceOverdue =
                    isServiceOverdue(
                      item.next_service_date
                    );

                  const isEditing =
                    canManage &&
                    editingId ===
                      item.id;

                  return (
                    <Fragment
                      key={item.id}
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
                            {formatDate(
                              item.next_service_date
                            )}
                          </span>

                          {serviceOverdue && (
                            <p className="mt-1 text-xs font-medium text-red-600">
                              Сервіс
                              прострочено
                            </p>
                          )}
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
                                Редагувати
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
      )}
    </div>
  );
}