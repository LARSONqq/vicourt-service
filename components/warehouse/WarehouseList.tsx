"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import { deleteWarehouseItem } from "@/app/actions/warehouseActions";

import type { AppCurrency } from "@/types/appSettings";
import type { ObjectItem } from "@/types/object";
import type { WarehouseItem } from "@/types/warehouseItem";
import type {
  WarehousePurchaseInsights,
} from "@/types/warehousePurchase";
import {
  formatWarehouseQuantity,
  getWarehousePurchaseInsight,
  getWarehouseStockPlan,
} from "@/lib/warehousePlanning";

import AddWarehouseMovementForm from "./AddWarehouseMovementForm";
import EditWarehouseItemForm from "./EditWarehouseItemForm";
import WarehouseItemPlanningPanel from "./WarehouseItemPlanningPanel";

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
  canCreatePurchases?: boolean;
  canViewPurchaseHistory?: boolean;
  purchaseInsights?: WarehousePurchaseInsights;
  focusedItemId?: number;
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

  const [
    wholePart,
    decimalPart,
  ] = absoluteValue
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
    currencySymbols[
      currency
    ] ?? currency;

  return `${sign}${formattedWholePart},${decimalPart} ${symbol}`;
}

export default function WarehouseList({
  items = [],
  objects = [],
  currency,
  canManage = false,
  canCreatePurchases = false,
  canViewPurchaseHistory = false,
  purchaseInsights = {},
  focusedItemId,
}: Props) {
  const safeItems =
    useMemo(
      () =>
        Array.isArray(items)
          ? items
          : [],
      [items]
    );

  const safeObjects =
    useMemo(
      () =>
        Array.isArray(objects)
          ? objects
          : [],
      [objects]
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
    stockFilter,
    setStockFilter,
  ] = useState("Усі");

  const [
    editingId,
    setEditingId,
  ] = useState<
    number | null
  >(null);

  const [
    movementEditor,
    setMovementEditor,
  ] =
    useState<MovementEditor | null>(
      null
    );

  const [
    detailsId,
    setDetailsId,
  ] = useState<
    number | null
  >(
    focusedItemId || null
  );

  useEffect(() => {
    if (!focusedItemId) {
      return;
    }

    const frameId =
      window.requestAnimationFrame(
        () => {
          const focusedElement =
            Array.from(
              document.querySelectorAll<HTMLElement>(
                "[data-warehouse-item-id]"
              )
            ).find(
              (element) =>
                element.dataset
                  .warehouseItemId ===
                  String(
                    focusedItemId
                  ) &&
                element.getClientRects()
                  .length > 0
            );

          focusedElement?.scrollIntoView(
            {
              block: "center",
            }
          );
        }
      );

    return () => {
      window.cancelAnimationFrame(
        frameId
      );
    };
  }, [focusedItemId]);

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

    setEditingId(
      null
    );

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

    setMovementEditor(
      null
    );

    setEditingId(
      (current) =>
        current === itemId
          ? null
          : itemId
    );
  }

  function toggleDetails(
    itemId: number
  ) {
    setDetailsId(
      (current) =>
        current === itemId
          ? null
          : itemId
    );
  }

  const columnCount =
    8;

  return (
    <div className="min-w-0 space-y-5">
      {/* FILTERS */}
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
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
          placeholder="Пошук за назвою, категорією або постачальником"
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
          value={
            stockFilter
          }
          onChange={(
            event
          ) =>
            setStockFilter(
              event.target.value
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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

      {/* RESULT COUNT */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Знайдено позицій:{" "}
          <span className="font-semibold text-gray-800">
            {
              filteredItems.length
            }
          </span>
        </p>

        {!canManage && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Тільки перегляд
          </span>
        )}
      </div>

      {filteredItems.length ===
      0 ? (
        /* EMPTY */
        <div className="rounded-xl border bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            📦
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Позицій не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити пошук або
            фільтри.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="space-y-3 md:hidden">
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

                const totalValue =
                  quantity *
                  purchasePrice;

                const isLowStock =
                  quantity <=
                  minQuantity;

                const insight =
                  getWarehousePurchaseInsight(
                    purchaseInsights,
                    item.id
                  );

                const plan =
                  getWarehouseStockPlan(
                    item,
                    insight.plannedQuantity
                  );

                const isMovementOpen =
                  canManage &&
                  movementEditor
                    ?.itemId ===
                    item.id;

                const isEditing =
                  canManage &&
                  editingId ===
                    item.id;

                const isDetailsOpen =
                  detailsId ===
                  item.id;

                return (
                  <article
                    key={
                      item.id
                    }
                    id={`warehouse-item-${item.id}`}
                    data-warehouse-item-id={
                      item.id
                    }
                    className={`scroll-mt-24 min-w-0 rounded-xl border bg-white p-4 ${
                      isLowStock
                        ? "border-red-200"
                        : focusedItemId ===
                            item.id
                          ? "border-green-300"
                          : ""
                    }`}
                  >
                    {/* HEADER */}
                    <div className="flex min-w-0 flex-col gap-2">
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

                        {isLowStock && (
                          <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-medium text-red-700">
                            Низький
                          </span>
                        )}
                      </div>
                    </div>

                    {/* QUANTITY */}
                    <div
                      className={`mt-4 rounded-xl p-3 ${
                        isLowStock
                          ? "bg-red-50"
                          : "bg-green-50"
                      }`}
                    >
                      <p className="text-xs text-gray-500">
                        Залишок
                      </p>

                      <p
                        className={`mt-1 text-2xl font-bold ${
                          isLowStock
                            ? "text-red-600"
                            : "text-green-700"
                        }`}
                      >
                        {formatWarehouseQuantity(
                          quantity
                        )}{" "}
                        {
                          item.unit
                        }
                      </p>
                    </div>

                    {/* DETAILS */}
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Мінімум
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {
                            formatWarehouseQuantity(
                              minQuantity
                            )
                          }{" "}
                          {
                            item.unit
                          }
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Ціль
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {plan.targetQuantity ===
                          null
                            ? "Не задано"
                            : `${formatWarehouseQuantity(
                                plan.targetQuantity
                              )} ${item.unit}`}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Вже заплановано
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-blue-700">
                          {formatWarehouseQuantity(
                            plan.plannedIncoming
                          )}{" "}
                          {item.unit}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          {plan.recommendationBasis ===
                          "minimum"
                            ? "До мінімуму"
                            : "Ще рекомендовано"}
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold text-orange-700">
                          {formatWarehouseQuantity(
                            plan.suggestedPurchaseQuantity
                          )}{" "}
                          {item.unit}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Ціна
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {formatMoney(
                            purchasePrice,
                            currency
                          )}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Вартість
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold text-green-700">
                          {formatMoney(
                            totalValue,
                            currency
                          )}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Основний постачальник
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {item.supplier ||
                            "Не вказано"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleDetails(
                            item.id
                          )
                        }
                        className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        {isDetailsOpen
                          ? "Сховати деталі"
                          : "Запас і ціни"}
                      </button>

                      {canCreatePurchases &&
                        plan.suggestedPurchaseQuantity >
                          0 && (
                        <Link
                          href={`/purchases?item=${item.id}#new-purchase`}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-green-700"
                        >
                          Створити закупівлю
                        </Link>
                      )}
                    </div>

                    {/* ACTIONS */}
                    {canManage && (
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            toggleMovementForm(
                              item.id,
                              "Прихід"
                            )
                          }
                          className="min-h-10 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
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
                          className="min-h-10 rounded-lg bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
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
                          className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
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

                    {/* MOBILE MOVEMENT FORM */}
                    {isMovementOpen &&
                      movementEditor && (
                        <div className="mt-4 min-w-0 border-t pt-4">
                          <div className="rounded-xl border bg-gray-50 p-3">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="break-words font-semibold text-gray-900">
                                  {
                                    movementEditor.movementType
                                  }{" "}
                                  —{" "}
                                  {
                                    item.name
                                  }
                                </h4>

                                <p className="mt-1 text-xs text-gray-500">
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
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg text-gray-500"
                                aria-label="Закрити"
                              >
                                ×
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
                        </div>
                      )}

                    {/* MOBILE EDIT FORM */}
                    {isEditing && (
                      <div className="mt-4 min-w-0 border-t pt-4">
                        <EditWarehouseItemForm
                          item={
                            item
                          }
                          onCancel={() =>
                            setEditingId(
                              null
                            )
                          }
                        />
                      </div>
                    )}

                    {isDetailsOpen && (
                      <div className="mt-4 min-w-0 border-t pt-4">
                        <WarehouseItemPlanningPanel
                          item={item}
                          insight={
                            insight
                          }
                          currency={
                            currency
                          }
                          canCreatePurchase={
                            canCreatePurchases
                          }
                          canViewPurchaseHistory={
                            canViewPurchaseHistory
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

                  <th className="p-4 text-right">
                    Дії
                  </th>
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

                    const insight =
                      getWarehousePurchaseInsight(
                        purchaseInsights,
                        item.id
                      );

                    const plan =
                      getWarehouseStockPlan(
                        item,
                        insight.plannedQuantity
                      );

                    const isMovementOpen =
                      canManage &&
                      movementEditor
                        ?.itemId ===
                        item.id;

                    const isEditing =
                      canManage &&
                      editingId ===
                          item.id;

                    const isDetailsOpen =
                      detailsId ===
                      item.id;

                    return (
                      <Fragment
                        key={
                          item.id
                        }
                      >
                        <tr
                          id={`warehouse-item-${item.id}`}
                          data-warehouse-item-id={
                            item.id
                          }
                          className={`scroll-mt-24 border-t ${
                            focusedItemId ===
                            item.id
                              ? "bg-green-50/50"
                              : ""
                          }`}
                        >
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
                            {
                              formatWarehouseQuantity(
                                quantity
                              )
                            }{" "}
                            {
                              item.unit
                            }
                          </td>

                          <td className="p-4 text-gray-600">
                            {
                              formatWarehouseQuantity(
                                minQuantity
                              )
                            }{" "}
                            {
                              item.unit
                            }

                            <p className="mt-1 text-xs text-gray-500">
                              Ціль: {plan.targetQuantity ===
                              null
                                ? "не задано"
                                : `${formatWarehouseQuantity(
                                    plan.targetQuantity
                                  )} ${item.unit}`}
                            </p>
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

                          <td className="p-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleDetails(
                                    item.id
                                  )
                                }
                                className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                {isDetailsOpen
                                  ? "Сховати"
                                  : "Запас і ціни"}
                              </button>

                              {canCreatePurchases &&
                                plan.suggestedPurchaseQuantity >
                                  0 && (
                                <Link
                                  href={`/purchases?item=${item.id}#new-purchase`}
                                  className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                                >
                                  Закупівля
                                </Link>
                              )}

                              {canManage && (
                                <>
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
                                </>
                              )}
                            </div>

                            <p className="mt-2 text-right text-xs text-gray-500">
                              Заплановано: {formatWarehouseQuantity(
                                plan.plannedIncoming
                              )} {item.unit}
                              <br />
                              {plan.recommendationBasis ===
                              "minimum"
                                ? "До мінімуму"
                                : "Ще рекомендовано"}
                              : {formatWarehouseQuantity(
                                plan.suggestedPurchaseQuantity
                              )} {item.unit}
                            </p>
                          </td>
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
                                  <div className="mb-5 flex items-start justify-between gap-4">
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
                                item={
                                  item
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

                        {isDetailsOpen && (
                          <tr className="border-t">
                            <td
                              colSpan={
                                columnCount
                              }
                              className="p-4"
                            >
                              <WarehouseItemPlanningPanel
                                item={
                                  item
                                }
                                insight={
                                  insight
                                }
                                currency={
                                  currency
                                }
                                canCreatePurchase={
                                  canCreatePurchases
                                }
                                canViewPurchaseHistory={
                                  canViewPurchaseHistory
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
