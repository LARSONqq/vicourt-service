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
import WarehousePurchaseHint from "./WarehousePurchaseHint";
import { getWarehouseStockStatus, warehouseStockPresentation } from "@/lib/warehouseStock";

type MovementDirection =
  | "in"
  | "out";

type MovementEditor = {
  itemId: number;
  direction: MovementDirection;
};

type Props = {
  items?: WarehouseItem[];
  currency: AppCurrency;
  canManage?: boolean;
  canCreatePurchases?: boolean;
  canViewPurchaseHistory?: boolean;
  canViewCosts?: boolean;
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
  currency,
  canManage = false,
  canCreatePurchases = false,
  canViewPurchaseHistory = false,
  canViewCosts = false,
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

  function toggleMovementForm(
    itemId: number,
    direction: MovementDirection
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
          current.direction ===
            direction
        ) {
          return null;
        }

        return {
          itemId,
          direction,
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
    canViewCosts ? 8 : 6;

  return (
    <div className="min-w-0 space-y-5">
      {/* RESULT COUNT */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Позицій на сторінці:{" "}
          <span className="font-semibold text-gray-800">
            {
              safeItems.length
            }
          </span>
        </p>

        {!canManage && (
          <span className="vc-status-info">
            Тільки перегляд
          </span>
        )}
      </div>

      {safeItems.length ===
      0 ? (
        /* EMPTY */
        <div className="vc-surface p-6 text-center sm:p-5">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            📦
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Позицій не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуйте змінити пошук або
            фільтри.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="space-y-3 md:hidden">
            {safeItems.map(
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

                const status = getWarehouseStockStatus(item);
                const badge = warehouseStockPresentation[status];
                const isLowStock = status !== "NORMAL";
                const isOutOfStock = status === "OUT_OF_STOCK";

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
                    className={`vc-surface scroll-mt-24 min-w-0 p-4 transition hover:bg-muted/35 ${
                      isOutOfStock
                        ? "border-destructive/30"
                        : isLowStock
                          ? "border-amber-300/40"
                        : focusedItemId ===
                            item.id
                          ? "border-primary/30"
                          : ""
                    }`}
                  >
                    {/* HEADER */}
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-gray-900">
                            <Link
                              href={`/warehouse/${item.id}`}
                              className="rounded-sm text-foreground transition hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              {
                                item.name
                              }
                            </Link>
                          </h3>

                          <p className="mt-1 break-words text-xs text-gray-500">
                            {item.category ||
                              "Без категорії"}
                          </p>
                        </div>

                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.badgeClass}`}>{badge.label}</span>
                      </div>
                    </div>

                    {/* QUANTITY */}
                    <div className="mt-4 rounded-md bg-muted/40 p-3">
                      <p className="text-xs text-gray-500">
                        Залишок
                      </p>

                      <p
                        className={`mt-1 text-2xl font-semibold ${badge.valueClass}`}
                      >
                        {formatWarehouseQuantity(
                          quantity
                        )}{" "}
                        {
                          item.unit
                        }
                      </p>
                    </div>

                    <WarehousePurchaseHint item={item} management={canCreatePurchases} plannedQuantity={insight.plannedQuantity} currency={currency} />

                    {/* DETAILS */}
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Мінімум
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {
                            item.min_quantity == null ? "Не задано" : formatWarehouseQuantity(minQuantity)
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

                      {canViewCosts && (
                        <>
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

                            <p className="mt-1 break-words text-sm font-semibold text-foreground">
                              {formatMoney(
                                totalValue,
                                currency
                              )}
                            </p>
                          </div>
                        </>
                      )}

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
                        className="min-h-10 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isDetailsOpen
                          ? "Сховати деталі"
                          : canViewCosts
                            ? "Запас і ціни"
                            : "Деталі запасу"}
                      </button>

                    </div>

                    {/* ACTIONS */}
                    {canManage && (
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            toggleMovementForm(
                              item.id,
                              "in"
                            )
                          }
                          className="min-h-10 rounded-md border border-primary/20 bg-accent px-3 py-2 text-sm font-medium text-primary transition hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          + Корекція
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleMovementForm(
                              item.id,
                              "out"
                            )
                          }
                          disabled={
                            quantity <=
                            0
                          }
                          className="vc-panel-warning min-h-10 rounded-md border border-transparent px-3 py-2 text-sm font-medium transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          − Корекція
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleEditForm(
                              item.id
                            )
                          }
                          className="min-h-10 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-primary transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                            className="min-h-10 w-full rounded-md border border-destructive/20 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                          <div className="rounded-lg border bg-gray-50 p-3">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="break-words font-semibold text-gray-900">
                                  {
                                    movementEditor.direction === "in"
                                      ? "збільшення"
                                      : "зменшення"
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
                              initialItemId={
                                item.id
                              }
                              initialDirection={
                                movementEditor.direction
                              }
                              lockItem
                              lockDirection
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
                          canViewCosts={
                            canViewCosts
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
          <div className="vc-table-shell hidden overflow-x-auto overscroll-x-contain md:block">
            <table
              className={`w-full ${
                canManage
                  ? "min-w-[1250px]"
                  : "min-w-[1000px]"
              }`}
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
                    Залишок
                  </th>

                  <th className="px-3 py-3">
                    Мінімум
                  </th>

                  {canViewCosts && (
                    <>
                      <th className="px-3 py-3">
                        Ціна
                      </th>

                      <th className="px-3 py-3">
                        Вартість
                      </th>
                    </>
                  )}

                  <th className="px-3 py-3">
                    Постачальник
                  </th>

                  <th className="px-3 py-3 text-right">
                    Дії
                  </th>
                </tr>
              </thead>

              <tbody>
                {safeItems.map(
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

                    const status = getWarehouseStockStatus(item);
                    const badge = warehouseStockPresentation[status];
                    const isLowStock = status !== "NORMAL";
                    const isOutOfStock = status === "OUT_OF_STOCK";

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
                          className={`scroll-mt-24 border-t transition hover:bg-muted/40 ${
                            focusedItemId ===
                            item.id
                              ? "bg-accent/50"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/warehouse/${item.id}`}
                                className="rounded-sm font-medium text-foreground transition hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {
                                  item.name
                                }
                              </Link>

                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.badgeClass}`}>{badge.label}</span>
                            </div>
                            <WarehousePurchaseHint item={item} management={canCreatePurchases} plannedQuantity={insight.plannedQuantity} currency={currency} />
                          </td>

                          <td className="px-3 py-3 text-gray-600">
                            {item.category ||
                              "Без категорії"}
                          </td>

                          <td
                            className={`px-3 py-3 font-semibold ${badge.valueClass}`}
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

                          <td className="px-3 py-3 text-gray-600">
                            {
                              item.min_quantity == null ? "Не задано" : formatWarehouseQuantity(minQuantity)
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

                          {canViewCosts && (
                            <>
                              <td className="px-3 py-3">
                                {formatMoney(
                                  purchasePrice,
                                  currency
                                )}
                              </td>

                              <td className="px-3 py-3 font-medium">
                                {formatMoney(
                                  quantity *
                                    purchasePrice,
                                  currency
                                )}
                              </td>
                            </>
                          )}

                          <td className="px-3 py-3 text-gray-600">
                            {item.supplier ||
                              "Не вказано"}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleDetails(
                                    item.id
                                  )
                                }
                                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {isDetailsOpen
                                  ? "Сховати"
                                  : canViewCosts
                                    ? "Запас і ціни"
                                    : "Деталі"}
                              </button>

                              {canManage && (
                                <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleMovementForm(
                                      item.id,
                                      "in"
                                    )
                                  }
                                  className="rounded-md border border-primary/20 bg-accent px-3 py-2 text-sm font-medium text-primary transition hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  + Корекція
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleMovementForm(
                                      item.id,
                                      "out"
                                    )
                                  }
                                  disabled={
                                    quantity <=
                                    0
                                  }
                                  className="vc-panel-warning rounded-md border border-transparent px-3 py-2 text-sm font-medium transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  − Корекція
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleEditForm(
                                      item.id
                                    )
                                  }
                                  className="rounded-md px-3 py-2 text-sm font-medium text-primary transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                    className="rounded-md px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                className="px-3 py-3"
                              >
                                <div className="rounded-lg border bg-gray-50 p-5">
                                  <div className="mb-5 flex items-start justify-between gap-4">
                                    <div>
                                      <h3 className="text-lg font-semibold">
                                        {
                                          movementEditor.direction === "in"
                                            ? "збільшення"
                                            : "зменшення"
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
                                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-gray-100"
                                    >
                                      Закрити
                                    </button>
                                  </div>

                                  <AddWarehouseMovementForm
                                    items={[
                                      item,
                                    ]}
                                    initialItemId={
                                      item.id
                                    }
                                    initialDirection={
                                      movementEditor.direction
                                    }
                                    lockItem
                                    lockDirection
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
                              className="px-3 py-3"
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
                              className="px-3 py-3"
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
                                canViewCosts={
                                  canViewCosts
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
