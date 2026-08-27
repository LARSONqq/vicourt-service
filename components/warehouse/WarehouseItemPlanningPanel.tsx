"use client";

import Link from "next/link";
import {
  useState,
} from "react";

import {
  loadWarehouseItemPurchaseHistory,
} from "@/app/actions/purchaseActions";
import {
  formatWarehouseQuantity,
  getWarehouseStockPlan,
} from "@/lib/warehousePlanning";

import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  WarehouseItem,
} from "@/types/warehouseItem";
import type {
  WarehousePurchaseHistoryEntry,
  WarehousePurchaseInsight,
} from "@/types/warehousePurchase";

type Props = {
  item: WarehouseItem;
  insight: WarehousePurchaseInsight;
  currency: AppCurrency;
  canCreatePurchase: boolean;
  canViewPurchaseHistory: boolean;
};

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone:
        "Europe/Kyiv",
    }
  ).format(new Date(value));
}

export default function WarehouseItemPlanningPanel({
  item,
  insight,
  currency,
  canCreatePurchase,
  canViewPurchaseHistory,
}: Props) {
  const [
    history,
    setHistory,
  ] = useState<
    WarehousePurchaseHistoryEntry[] | null
  >(null);
  const [
    isLoadingHistory,
    setIsLoadingHistory,
  ] = useState(false);
  const [
    historyError,
    setHistoryError,
  ] = useState("");
  const plan =
    getWarehouseStockPlan(
      item,
      insight.plannedQuantity
    );
  const priceChange =
    insight.priceChangePercent;

  async function showHistory() {
    if (history !== null) {
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError("");

    try {
      const entries =
        await loadWarehouseItemPurchaseHistory(
          item.id
        );

      setHistory(entries);
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Не вдалося завантажити історію закупівель."
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4 rounded-xl border bg-gray-50 p-3 sm:p-5">
      <div
        className={`rounded-xl border p-4 ${
          plan.isLowStock
            ? "border-orange-200 bg-orange-50"
            : "border-green-200 bg-green-50"
        }`}
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p
              className={`font-semibold ${
                plan.isLowStock
                  ? "text-orange-800"
                  : "text-green-800"
              }`}
            >
              {plan.isLowStock
                ? "Низький залишок"
                : "Планування запасу"}
            </p>

            <p className="mt-1 break-words text-sm text-gray-600">
              {item.name}
            </p>
          </div>

          {canCreatePurchase &&
            plan.suggestedPurchaseQuantity >
              0 && (
            <Link
              href={`/purchases?item=${item.id}#new-purchase`}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              Створити закупівлю
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <div>
            <p className="text-xs text-gray-500">
              Зараз
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatWarehouseQuantity(
                plan.currentQuantity
              )}{" "}
              {item.unit}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Мінімум
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatWarehouseQuantity(
                plan.minimumQuantity
              )}{" "}
              {item.unit}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Ціль
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {plan.targetQuantity ===
              null
                ? "Не задано"
                : `${formatWarehouseQuantity(
                    plan.targetQuantity
                  )} ${item.unit}`}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Вже заплановано
            </p>
            <p className="mt-1 font-semibold text-blue-700">
              {formatWarehouseQuantity(
                plan.plannedIncoming
              )}{" "}
              {item.unit}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Після запланованого
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatWarehouseQuantity(
                plan.expectedQuantity
              )}{" "}
              {item.unit}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              {plan.recommendationBasis ===
              "minimum"
                ? "До мінімуму"
                : "Ще рекомендовано"}
            </p>
            <p className="mt-1 font-semibold text-orange-700">
              {formatWarehouseQuantity(
                plan.suggestedPurchaseQuantity
              )}{" "}
              {item.unit}
            </p>
          </div>
        </div>

        {plan.targetQuantity ===
          null && (
          <p className="mt-3 text-xs leading-5 text-gray-600">
            Цільовий запас не заданий.
            За потреби ViCourt показує
            лише кількість до
            мінімального залишку.
          </p>
        )}

        {plan.isLowStock &&
          plan.plannedIncoming > 0 &&
          plan.suggestedPurchaseQuantity ===
            0 && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-green-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-green-700">
              Поповнення вже
              заплановане.
            </p>

            {canCreatePurchase && (
              <Link
                href="/purchases"
                className="text-sm font-medium text-green-700 hover:underline"
              >
                Відкрити закупівлі →
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">
            Середня ціна складу
          </p>
          <p className="mt-1 break-words font-semibold text-gray-900">
            {formatMoney(
              Number(
                item.purchase_price
              ),
              currency
            )}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">
            Остання закупівельна ціна
          </p>
          <p className="mt-1 break-words font-semibold text-gray-900">
            {insight.lastPurchasePrice ===
            null
              ? "Немає даних"
              : formatMoney(
                  insight.lastPurchasePrice,
                  currency
                )}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">
            Попередня ціна
          </p>
          <p className="mt-1 break-words font-semibold text-gray-900">
            {insight.previousPurchasePrice ===
            null
              ? "Немає даних"
              : formatMoney(
                  insight.previousPurchasePrice,
                  currency
                )}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">
            Зміна ціни
          </p>
          <p
            className={`mt-1 font-semibold ${
              priceChange === null
                ? "text-gray-500"
                : priceChange > 0
                  ? "text-red-600"
                  : priceChange < 0
                    ? "text-green-700"
                    : "text-gray-700"
            }`}
          >
            {priceChange === null
              ? "Немає даних"
              : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(
                  1
                )}%`}
          </p>
        </div>
      </div>

      {canViewPurchaseHistory && (
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h4 className="font-semibold text-gray-900">
                Історія закупівель
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Останні оприбутковані
                закупівлі цього товару.
              </p>
            </div>

            {history === null && (
              <button
                type="button"
                onClick={showHistory}
                disabled={isLoadingHistory}
                className="min-h-10 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                {isLoadingHistory
                  ? "Завантаження..."
                  : "Показати історію"}
              </button>
            )}
          </div>

          {historyError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {historyError}
            </p>
          )}

          {history !== null &&
            history.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">
              Оприбуткованих
              закупівель ще немає.
            </p>
          )}

          {history !== null &&
            history.length > 0 && (
            <div className="mt-4 space-y-2">
              {history.map(
                (purchase) => (
                  <div
                    key={purchase.id}
                    className="grid min-w-0 grid-cols-2 gap-3 rounded-lg border bg-gray-50 p-3 text-sm md:grid-cols-5"
                  >
                    <div>
                      <p className="text-xs text-gray-500">
                        Дата
                      </p>
                      <p className="mt-1 font-medium text-gray-800">
                        {formatDate(
                          purchase.purchasedAt
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Кількість
                      </p>
                      <p className="mt-1 font-medium text-gray-800">
                        {formatWarehouseQuantity(
                          purchase.quantity
                        )}{" "}
                        {item.unit}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Ціна за одиницю
                      </p>
                      <p className="mt-1 font-medium text-gray-800">
                        {formatMoney(
                          purchase.purchasePrice,
                          currency
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Сума
                      </p>
                      <p className="mt-1 font-semibold text-green-700">
                        {formatMoney(
                          purchase.totalAmount,
                          currency
                        )}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        Постачальник
                      </p>
                      <p className="mt-1 break-words font-medium text-gray-800">
                        {purchase.supplier ||
                          "Не вказано"}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
