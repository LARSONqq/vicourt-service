"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";

import { deleteWarehouseItem } from "@/app/actions/warehouseActions";

import type { AppCurrency } from "@/types/appSettings";
import type { ObjectItem } from "@/types/object";
import type { WarehouseItem } from "@/types/warehouseItem";

import AddWarehouseMovementForm from "./AddWarehouseMovementForm";
import EditWarehouseItemForm from "./EditWarehouseItemForm";

type MovementType =
  | "Прихід"
  | "Списання";

type MovementEditor = {
  itemId: number;
  movementType: MovementType;
};

type Props = {
  items?: WarehouseItem[];
  objects?: ObjectItem[];
  currency: AppCurrency;
  canManage?: boolean;
};

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const currencySymbols: Record<
    string,
    string
  > = {
    UAH: "₴",
    USD: "$",
    EUR: "€",
  };

  const absoluteValue =
    Math.abs(safeValue);

  const [wholePart, decimalPart] =
    absoluteValue
      .toFixed(2)
      .split(".");

  const formattedWholePart =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  const sign =
    safeValue < 0
      ? "−"
      : "";

  const symbol =
    currencySymbols[currency] ??
    currency;

  return `${sign}${formattedWholePart},${decimalPart} ${symbol}`;
}

export default function WarehouseList({
  items = [],
  objects = [],
  currency,
  canManage = false,
}: Props) {
  const safeItems =
    Array.isArray(items)
      ? items
      : [];

  const safeObjects =
    Array.isArray(objects)
      ? objects
      : [];

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("Усі");

  const [
    stockFilter,
    setStockFilter,
  ] = useState("Усі");

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const [
    movementEditor,
    setMovementEditor,
  ] =
    useState<MovementEditor | null>(
      null
    );

  const categories =
    useMemo(() => {
      const values =
        safeItems
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
    }, [safeItems]);

  const filteredItems =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return safeItems.filter(
        (item) => {
          const quantity =
            Number(
              item.quantity
            );

          const minQuantity =
            Number(
              item.min_quantity
            );

          const isLowStock =
            quantity <=
            minQuantity;

          const searchableText =
            [
              item.name,
              item.category,
              item.supplier,
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

          const matchesStock =
            stockFilter ===
              "Усі" ||
            (stockFilter ===
              "Низький залишок" &&
              isLowStock) ||
            (stockFilter ===
              "Є в наявності" &&
              quantity > 0);

          return (
            matchesSearch &&
            matchesCategory &&
            matchesStock
          );
        }
      );
    }, [
      safeItems,
      search,
      category,
      stockFilter,
    ]);

  function toggleMovementForm(
    itemId: number,
    movementType: MovementType
  ) {
    if (!canManage) {
      return;
    }

    setEditingId(null);

    setMovementEditor(
      (current) => {
        if (
          current?.itemId ===
            itemId &&
          current.movementType ===
            movementType
        ) {
          return null;
        }

        return {
          itemId,
          movementType,
        };
      }
    );
  }

  function toggleEditForm(
    itemId: number
  ) {
    if (!canManage) {
      return;
    }

    setMovementEditor(null);

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
          placeholder="Пошук за назвою, категорією або постачальником"
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
          value={stockFilter}
          onChange={(event) =>
            setStockFilter(
              event.target.value
            )
          }
          className="w-full rounded-lg border bg-white px-4 py-3"
        >
          <option value="Усі">
            Усі залишки
          </option>

          <option value="Низький залишок">
            Низький залишок
          </option>

          <option value="Є в наявності">
            Є в наявності
          </option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Знайдено позицій:{" "}
          {filteredItems.length}
        </p>

        {!canManage && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Тільки перегляд
          </span>
        )}
      </div>

      {filteredItems.length ===
      0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">
            Позицій за цими
            параметрами не знайдено.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table
            className={`w-full ${
              canManage
                ? "min-w-[1250px]"
                : "min-w-[1000px]"
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
                  Залишок
                </th>

                <th className="p-4">
                  Мінімум
                </th>

                <th className="p-4">
                  Ціна
                </th>

                <th className="p-4">
                  Вартість
                </th>

                <th className="p-4">
                  Постачальник
                </th>

                {canManage && (
                  <th className="p-4 text-right">
                    Дії
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredItems.map(
                (item) => {
                  const quantity =
                    Number(
                      item.quantity
                    );

                  const minQuantity =
                    Number(
                      item.min_quantity
                    );

                  const purchasePrice =
                    Number(
                      item.purchase_price
                    );

                  const isLowStock =
                    quantity <=
                    minQuantity;

                  const isMovementOpen =
                    canManage &&
                    movementEditor
                      ?.itemId ===
                      item.id;

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
                          <div className="flex items-center gap-3">
                            <span className="font-medium">
                              {
                                item.name
                              }
                            </span>

                            {isLowStock && (
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                                Низький
                                залишок
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-gray-600">
                          {item.category ||
                            "Без категорії"}
                        </td>

                        <td
                          className={`p-4 font-semibold ${
                            isLowStock
                              ? "text-red-600"
                              : "text-green-700"
                          }`}
                        >
                          {quantity}{" "}
                          {item.unit}
                        </td>

                        <td className="p-4 text-gray-600">
                          {
                            minQuantity
                          }{" "}
                          {item.unit}
                        </td>

                        <td className="p-4">
                          {formatMoney(
                            purchasePrice,
                            currency
                          )}
                        </td>

                        <td className="p-4 font-medium">
                          {formatMoney(
                            quantity *
                              purchasePrice,
                            currency
                          )}
                        </td>

                        <td className="p-4 text-gray-600">
                          {item.supplier ||
                            "Не вказано"}
                        </td>

                        {canManage && (
                          <td className="p-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleMovementForm(
                                    item.id,
                                    "Прихід"
                                  )
                                }
                                className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                              >
                                + Прихід
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleMovementForm(
                                    item.id,
                                    "Списання"
                                  )
                                }
                                disabled={
                                  quantity <=
                                  0
                                }
                                className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                − Списання
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleEditForm(
                                    item.id
                                  )
                                }
                                className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                              >
                                Редагувати
                              </button>

                              <form
                                action={deleteWarehouseItem.bind(
                                  null,
                                  item.id
                                )}
                                onSubmit={(
                                  event
                                ) => {
                                  const confirmed =
                                    window.confirm(
                                      `Видалити позицію «${item.name}»?`
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

                      {isMovementOpen &&
                        movementEditor && (
                          <tr className="border-t">
                            <td
                              colSpan={
                                columnCount
                              }
                              className="p-4"
                            >
                              <div className="rounded-xl border bg-gray-50 p-5">
                                <div className="mb-5 flex items-center justify-between gap-4">
                                  <div>
                                    <h3 className="text-lg font-semibold">
                                      {
                                        movementEditor.movementType
                                      }{" "}
                                      —{" "}
                                      {
                                        item.name
                                      }
                                    </h3>

                                    <p className="mt-1 text-sm text-gray-500">
                                      Поточний
                                      залишок:{" "}
                                      {
                                        item.quantity
                                      }{" "}
                                      {
                                        item.unit
                                      }
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMovementEditor(
                                        null
                                      )
                                    }
                                    className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100"
                                  >
                                    Закрити
                                  </button>
                                </div>

                                <AddWarehouseMovementForm
                                  items={[
                                    item,
                                  ]}
                                  objects={
                                    safeObjects
                                  }
                                  initialItemId={
                                    item.id
                                  }
                                  initialMovementType={
                                    movementEditor.movementType
                                  }
                                  lockItem
                                  lockMovementType
                                  onCreated={() =>
                                    setMovementEditor(
                                      null
                                    )
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        )}

                      {isEditing && (
                        <tr className="border-t">
                          <td
                            colSpan={
                              columnCount
                            }
                            className="p-4"
                          >
                            <EditWarehouseItemForm
                              item={item}
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