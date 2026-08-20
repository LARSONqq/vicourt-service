import AddPurchaseForm from "@/components/purchases/AddPurchaseForm";
import PurchaseList from "@/components/purchases/PurchaseList";

import { requireSectionAccess } from "@/lib/auth/requireAccess";

import { getAppSettings } from "@/services/settingsService";
import { getWarehousePurchases } from "@/services/purchaseService";
import { getWarehouseItems } from "@/services/warehouseService";

import type { AppCurrency } from "@/types/appSettings";

type Props = {
  searchParams: Promise<{
    item?: string;
  }>;
};

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  const symbols: Record<
    string,
    string
  > = {
    UAH: "₴",
    USD: "$",
    EUR: "€",
  };

  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const [
    wholePart,
    decimalPart,
  ] = safeValue
    .toFixed(2)
    .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${formattedWhole},${decimalPart} ${
    symbols[currency] ||
    currency
  }`;
}

export default async function PurchasesPage({
  searchParams,
}: Props) {
  await requireSectionAccess(
    "purchases"
  );

  const resolvedSearchParams =
    await searchParams;

  const requestedItemId =
    Number(
      resolvedSearchParams.item
    );

  const initialItemId =
    Number.isInteger(
      requestedItemId
    ) &&
    requestedItemId > 0
      ? requestedItemId
      : undefined;

  const [
    items,
    purchases,
    settings,
  ] = await Promise.all([
    getWarehouseItems(),
    getWarehousePurchases(),
    getAppSettings(),
  ]);

  const itemList =
    Array.isArray(items)
      ? items
      : [];

  const purchaseList =
    Array.isArray(purchases)
      ? purchases
      : [];

  const validInitialItemId =
    initialItemId &&
    itemList.some(
      (item) =>
        Number(item.id) ===
        initialItemId
    )
      ? initialItemId
      : undefined;

  const selectedInitialItem =
    validInitialItemId
      ? itemList.find(
          (item) =>
            Number(item.id) ===
            validInitialItemId
        ) || null
      : null;

  const plannedPurchases =
    purchaseList.filter(
      (purchase) =>
        purchase.status ===
        "Заплановано"
    );

  const completedPurchases =
    purchaseList.filter(
      (purchase) =>
        purchase.status ===
        "Закуплено"
    );

  const plannedValue =
    plannedPurchases.reduce(
      (
        sum,
        purchase
      ) =>
        sum +
        Number(
          purchase.quantity
        ) *
          Number(
            purchase.purchase_price
          ),
      0
    );

  const lowStockItems =
    itemList.filter(
      (item) =>
        Number(
          item.quantity
        ) <=
        Number(
          item.min_quantity
        )
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Закупівлі
        </h1>

        <p className="mt-1 text-sm text-gray-500 sm:text-base">
          Планування закупівель та
          оприбуткування матеріалів
        </p>
      </div>

      {/* STATS */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Заплановано
          </p>

          <p className="mt-2 text-2xl font-bold text-yellow-600 sm:text-3xl">
            {
              plannedPurchases.length
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Планова сума
          </p>

          <p className="mt-2 break-words text-lg font-bold text-green-700 sm:text-2xl">
            {formatMoney(
              plannedValue,
              settings.currency
            )}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Закуплено
          </p>

          <p className="mt-2 text-2xl font-bold text-green-600 sm:text-3xl">
            {
              completedPurchases.length
            }
          </p>
        </div>

        <div
          className={`min-w-0 rounded-xl border bg-white p-3 sm:p-5 ${
            lowStockItems.length >
            0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            Низькі залишки
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              lowStockItems.length >
              0
                ? "text-red-600"
                : "text-gray-700"
            }`}
          >
            {
              lowStockItems.length
            }
          </p>
        </div>
      </div>

      {/* NEW PURCHASE */}
      <section
        id="new-purchase"
        className={`min-w-0 rounded-xl border bg-white p-4 sm:p-5 ${
          selectedInitialItem
            ? "border-orange-300"
            : ""
        }`}
      >
        <div className="mb-4 min-w-0 sm:mb-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Нова закупівля
          </h2>

          <p className="mt-1 break-words text-sm text-gray-500">
            {selectedInitialItem
              ? `Планування закупівлі: ${selectedInitialItem.name}`
              : "Обери матеріал і заплануй необхідну кількість"}
          </p>

          {selectedInitialItem && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
              Матеріал уже вибрано зі
              складу.
            </div>
          )}
        </div>

        <div className="min-w-0">
          <AddPurchaseForm
            items={
              itemList
            }
            initialItemId={
              validInitialItemId
            }
          />
        </div>
      </section>

      {/* PURCHASE LIST */}
      <div className="min-w-0">
        <PurchaseList
          purchases={
            purchaseList
          }
          currency={
            settings.currency
          }
        />
      </div>
    </div>
  );
}