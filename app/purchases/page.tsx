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
  const symbols: Record<string, string> = {
    UAH: "₴",
    USD: "$",
    EUR: "€",
  };

  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const [wholePart, decimalPart] =
    safeValue
      .toFixed(2)
      .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${formattedWhole},${decimalPart} ${
    symbols[currency] || currency
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
      (sum, purchase) =>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Закупівлі
        </h1>

        <p className="mt-1 text-gray-500">
          Планування закупівель та
          оприбуткування матеріалів
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Заплановано
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-600">
            {
              plannedPurchases.length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Планова сума
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700">
            {formatMoney(
              plannedValue,
              settings.currency
            )}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Закуплено
          </p>

          <p className="mt-2 text-3xl font-bold text-green-600">
            {
              completedPurchases.length
            }
          </p>
        </div>

        <div
          className={`rounded-xl border bg-white p-5 ${
            lowStockItems.length > 0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-sm text-gray-500">
            Низькі залишки
          </p>

          <p
            className={`mt-2 text-3xl font-bold ${
              lowStockItems.length > 0
                ? "text-red-600"
                : "text-gray-700"
            }`}
          >
            {lowStockItems.length}
          </p>
        </div>
      </div>

      <section
        id="new-purchase"
        className={`rounded-xl border bg-white p-5 ${
          selectedInitialItem
            ? "border-orange-300"
            : ""
        }`}
      >
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            Нова закупівля
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {selectedInitialItem
              ? `Планування закупівлі: ${selectedInitialItem.name}`
              : "Обери матеріал і заплануй необхідну кількість"}
          </p>
        </div>

        <AddPurchaseForm
          items={itemList}
          initialItemId={
            validInitialItemId
          }
        />
      </section>

      <PurchaseList
        purchases={
          purchaseList
        }
        currency={
          settings.currency
        }
      />
    </div>
  );
}