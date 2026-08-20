"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import type { WarehouseMovement } from "@/types/warehouseMovement";

type Props = {
  movements?: WarehouseMovement[];
};

function formatDate(
  date: string
) {
  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "Невідома дата";
  }

  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(parsedDate);
}

function formatMoney(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(safeValue);
}

function formatQuantity(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 3,
    }
  ).format(safeValue);
}

function getPerformerName(
  movement: WarehouseMovement
) {
  const name =
    movement.performed_by_name
      ?.trim();

  if (name) {
    return name;
  }

  if (
    movement.performed_by
  ) {
    return "Користувач";
  }

  return "Не зафіксовано";
}

export default function WarehouseMovements({
  movements = [],
}: Props) {
  const safeMovements =
    Array.isArray(
      movements
    )
      ? movements
      : [];

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    movementType,
    setMovementType,
  ] = useState("Усі");

  const [
    selectedObjectId,
    setSelectedObjectId,
  ] = useState("Усі");

  const objectOptions =
    useMemo(() => {
      const objects =
        new Map<
          number,
          string
        >();

      safeMovements.forEach(
        (movement) => {
          if (
            movement.object
          ) {
            objects.set(
              movement.object.id,
              movement.object.name
            );
          }
        }
      );

      return Array.from(
        objects.entries()
      )
        .map(
          ([
            id,
            name,
          ]) => ({
            id,
            name,
          })
        )
        .sort(
          (
            first,
            second
          ) =>
            first.name.localeCompare(
              second.name,
              "uk"
            )
        );
    }, [safeMovements]);

  const filteredMovements =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return safeMovements.filter(
        (movement) => {
          const searchableText =
            [
              movement.item
                ?.name,
              movement.object
                ?.name,
              movement.note,
              movement
                .performed_by_name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchableText.includes(
              normalizedSearch
            );

          const matchesType =
            movementType ===
              "Усі" ||
            movement.movement_type ===
              movementType;

          const matchesObject =
            selectedObjectId ===
              "Усі" ||
            (
              selectedObjectId ===
                "Без об’єкта" &&
              !movement.object
            ) ||
            String(
              movement.object
                ?.id
            ) ===
              selectedObjectId;

          return (
            matchesSearch &&
            matchesType &&
            matchesObject
          );
        }
      );
    }, [
      safeMovements,
      search,
      movementType,
      selectedObjectId,
    ]);

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      {/* HEADER */}
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Історія руху товарів
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Приходи, списання,
          вартість та виконавці
          складських операцій
        </p>
      </div>

      {/* FILTERS */}
      {safeMovements.length >
        0 && (
        <div className="grid min-w-0 grid-cols-1 gap-3 border-b bg-gray-50 p-3 sm:p-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_260px]">
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
            placeholder="Матеріал, об’єкт, виконавець або примітка"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />

          <select
            value={
              movementType
            }
            onChange={(
              event
            ) =>
              setMovementType(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="Усі">
              Усі операції
            </option>

            <option value="Прихід">
              Тільки приходи
            </option>

            <option value="Списання">
              Тільки списання
            </option>
          </select>

          <select
            value={
              selectedObjectId
            }
            onChange={(
              event
            ) =>
              setSelectedObjectId(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600 md:col-span-2 lg:col-span-1"
          >
            <option value="Усі">
              Усі об’єкти
            </option>

            <option value="Без об’єкта">
              Без прив’язки до об’єкта
            </option>

            {objectOptions.map(
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
        </div>
      )}

      {/* EMPTY */}
      {safeMovements.length ===
      0 ? (
        <div className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            ↕
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Операцій поки немає
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Історія приходів та
            списань з’явиться тут.
          </p>
        </div>
      ) : filteredMovements.length ===
        0 ? (
        <div className="p-6 text-center sm:p-8">
          <p className="font-medium text-gray-700">
            Операцій не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити пошук або
            фільтри.
          </p>
        </div>
      ) : (
        <>
          {/* COUNT */}
          <div className="border-b px-4 py-3 sm:px-5">
            <p className="text-sm text-gray-500">
              Показано операцій:{" "}
              <span className="font-semibold text-gray-800">
                {
                  filteredMovements.length
                }
              </span>{" "}
              із{" "}
              {
                safeMovements.length
              }
            </p>
          </div>

          {/* MOBILE CARDS */}
          <div className="space-y-3 p-3 md:hidden">
            {filteredMovements.map(
              (movement) => {
                const isIncome =
                  movement.movement_type ===
                  "Прихід";

                const quantity =
                  Number(
                    movement.quantity
                  ) || 0;

                const unitPrice =
                  Number(
                    movement.unit_price
                  ) || 0;

                const totalPrice =
                  quantity *
                  unitPrice;

                return (
                  <article
                    key={
                      movement.id
                    }
                    className="min-w-0 rounded-xl border bg-white p-4"
                  >
                    {/* TOP */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          isIncome
                            ? "bg-green-50 text-green-700"
                            : "bg-orange-50 text-orange-700"
                        }`}
                      >
                        {
                          movement.movement_type
                        }
                      </span>

                      <p className="text-xs text-gray-400">
                        {formatDate(
                          movement.created_at
                        )}
                      </p>
                    </div>

                    {/* MATERIAL */}
                    <div className="mt-4">
                      <p className="text-xs text-gray-500">
                        Матеріал
                      </p>

                      <p className="mt-1 break-words font-semibold text-gray-900">
                        {movement.item
                          ?.name ||
                          "Позицію видалено"}
                      </p>
                    </div>

                    {/* QUANTITY */}
                    <div
                      className={`mt-3 rounded-lg p-3 ${
                        isIncome
                          ? "bg-green-50"
                          : "bg-orange-50"
                      }`}
                    >
                      <p className="text-xs text-gray-500">
                        Кількість
                      </p>

                      <p
                        className={`mt-1 text-xl font-bold ${
                          isIncome
                            ? "text-green-700"
                            : "text-orange-700"
                        }`}
                      >
                        {isIncome
                          ? "+"
                          : "−"}
                        {formatQuantity(
                          quantity
                        )}{" "}
                        {movement.item
                          ?.unit ||
                          ""}
                      </p>
                    </div>

                    {/* PRICE */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="min-w-0 rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Ціна
                        </p>

                        <p className="mt-1 break-words font-semibold text-gray-800">
                          {formatMoney(
                            unitPrice
                          )}
                        </p>

                        {movement.item
                          ?.unit && (
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            за{" "}
                            {
                              movement
                                .item
                                .unit
                            }
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Сума
                        </p>

                        <p className="mt-1 break-words font-semibold text-gray-900">
                          {formatMoney(
                            totalPrice
                          )}
                        </p>
                      </div>
                    </div>

                    {/* DETAILS */}
                    <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Об’єкт
                        </p>

                        {movement.object ? (
                          <Link
                            href={`/objects/${movement.object.id}`}
                            className="mt-1 block break-words font-medium text-green-700 hover:underline"
                          >
                            {
                              movement
                                .object
                                .name
                            }
                          </Link>
                        ) : (
                          <p className="mt-1 text-sm text-gray-400">
                            Не прив’язано
                          </p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Виконав
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {getPerformerName(
                            movement
                          )}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Примітка
                        </p>

                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">
                          {movement.note ||
                            "Без примітки"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1400px]">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-4">
                    Дата
                  </th>

                  <th className="p-4">
                    Операція
                  </th>

                  <th className="p-4">
                    Матеріал
                  </th>

                  <th className="p-4">
                    Кількість
                  </th>

                  <th className="p-4">
                    Ціна
                  </th>

                  <th className="p-4">
                    Сума
                  </th>

                  <th className="p-4">
                    Об’єкт
                  </th>

                  <th className="p-4">
                    Виконав
                  </th>

                  <th className="p-4">
                    Примітка
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredMovements.map(
                  (movement) => {
                    const isIncome =
                      movement.movement_type ===
                      "Прихід";

                    const quantity =
                      Number(
                        movement.quantity
                      ) || 0;

                    const unitPrice =
                      Number(
                        movement.unit_price
                      ) || 0;

                    const totalPrice =
                      quantity *
                      unitPrice;

                    return (
                      <tr
                        key={
                          movement.id
                        }
                        className="border-t align-top"
                      >
                        <td className="whitespace-nowrap p-4 text-sm text-gray-500">
                          {formatDate(
                            movement.created_at
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${
                              isIncome
                                ? "bg-green-50 text-green-700"
                                : "bg-orange-50 text-orange-700"
                            }`}
                          >
                            {
                              movement.movement_type
                            }
                          </span>
                        </td>

                        <td className="p-4 font-medium text-gray-900">
                          {movement.item
                            ?.name ||
                            "Позицію видалено"}
                        </td>

                        <td
                          className={`whitespace-nowrap p-4 font-semibold ${
                            isIncome
                              ? "text-green-700"
                              : "text-orange-700"
                          }`}
                        >
                          {isIncome
                            ? "+"
                            : "−"}

                          {formatQuantity(
                            quantity
                          )}{" "}

                          {movement.item
                            ?.unit ||
                            ""}
                        </td>

                        <td className="whitespace-nowrap p-4 text-gray-700">
                          {formatMoney(
                            unitPrice
                          )}
                        </td>

                        <td className="whitespace-nowrap p-4 font-semibold text-gray-900">
                          {formatMoney(
                            totalPrice
                          )}
                        </td>

                        <td className="p-4">
                          {movement.object ? (
                            <Link
                              href={`/objects/${movement.object.id}`}
                              className="font-medium text-green-700 hover:underline"
                            >
                              {
                                movement
                                  .object
                                  .name
                              }
                            </Link>
                          ) : (
                            <span className="text-gray-400">
                              Не прив’язано
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <span className="break-words text-sm font-medium text-gray-700">
                            {getPerformerName(
                              movement
                            )}
                          </span>
                        </td>

                        <td className="max-w-[300px] p-4 text-gray-600">
                          <span className="whitespace-pre-wrap break-words">
                            {movement.note ||
                              "Без примітки"}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}