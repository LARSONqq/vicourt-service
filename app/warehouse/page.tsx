import WarehouseActions from "@/components/warehouse/WarehouseActions";
import WarehouseList from "@/components/warehouse/WarehouseList";
import WarehouseMovements from "@/components/warehouse/WarehouseMovements";

import { requireSectionAccess } from "@/lib/auth/requireAccess";
import {
  canManagePurchases,
  canManageWarehouse,
  canViewWarehouseLedger,
} from "@/lib/auth/permissions";

import { getObjects } from "@/services/objectService";
import { getAppSettings } from "@/services/settingsService";
import {
  getWarehousePurchaseInsights,
} from "@/services/purchaseService";

import {
  getManagementWarehouseItems,
  getWarehouseItems,
  getWarehouseMovementPage,
} from "@/services/warehouseService";

import type { AppCurrency } from "@/types/appSettings";
import type {
  WarehousePurchaseInsights,
} from "@/types/warehousePurchase";

type Props = {
  searchParams: Promise<{
    item?: string;
    ledger_search?: string;
    ledger_item?: string;
    ledger_object?: string;
    ledger_movement?: string;
    ledger_from?: string;
    ledger_to?: string;
    ledger_page?: string;
  }>;
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

export default async function WarehousePage({
  searchParams,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "warehouse"
    );

  const canManage =
    canManageWarehouse(
      currentProfile.role
    );
  const canCreatePurchases =
    canManagePurchases(
      currentProfile.role
    );
  const canViewLedger =
    canViewWarehouseLedger(
      currentProfile.role
    );
  const resolvedSearchParams =
    await searchParams;
  const requestedItemId =
    Number(
      resolvedSearchParams.item
    );
  const focusedItemId =
    Number.isInteger(
      requestedItemId
    ) && requestedItemId > 0
      ? requestedItemId
      : undefined;
  const ledgerFilters = {
    search:
      resolvedSearchParams.ledger_search,
    item:
      resolvedSearchParams.ledger_item,
    object:
      resolvedSearchParams.ledger_object,
    movement:
      resolvedSearchParams.ledger_movement,
    from:
      resolvedSearchParams.ledger_from,
    to:
      resolvedSearchParams.ledger_to,
  };

  const [
    items,
    movementPage,
    objects,
    settings,
    purchaseInsights,
  ] = await Promise.all([
    canViewLedger
      ? getManagementWarehouseItems()
      : getWarehouseItems(),
    canViewLedger
      ? getWarehouseMovementPage({
          search:
            ledgerFilters.search,
          itemId: Number(
            ledgerFilters.item
          ),
          objectId: Number(
            ledgerFilters.object
          ),
          movementCode:
            ledgerFilters.movement,
          dateFrom:
            ledgerFilters.from,
          dateTo:
            ledgerFilters.to,
          page: Number(
            resolvedSearchParams.ledger_page
          ),
        })
      : Promise.resolve(null),
    canViewLedger
      ? getObjects()
      : Promise.resolve([]),
    getAppSettings(),
    canCreatePurchases
      ? getWarehousePurchaseInsights()
      : Promise.resolve<
          WarehousePurchaseInsights
        >({}),
  ]);

  const itemList =
    Array.isArray(items)
      ? items
      : [];

  const objectList =
    Array.isArray(objects)
      ? objects
      : [];

  const lowStockItems =
    itemList.filter(
      (item) =>
        Number(
          item.quantity
        ) <=
        Number(
          item.min_quantity
        )
    ).length;

  const totalValue =
    itemList.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.quantity
        ) *
          Number(
            item.purchase_price
          ),
      0
    );

  const suppliersCount =
    new Set(
      itemList
        .map(
          (item) =>
            item.supplier
        )
        .filter(Boolean)
    ).size;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Склад
          </h1>

          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Матеріали, залишки та рух
            товарів
          </p>
        </div>

        {canManage && (
          <div className="min-w-0">
            <WarehouseActions
              items={
                itemList
              }
            />
          </div>
        )}
      </div>

      {/* READ ONLY */}
      {!canManage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm">
              👁
            </div>

            <div className="min-w-0">
              <p className="font-medium text-blue-800">
                Режим перегляду
              </p>

              <p className="mt-1 text-sm leading-5 text-blue-700">
                Ти можеш переглядати
                залишки матеріалів
                {canViewLedger
                  ? " та історію рухів"
                  : ""}, але змінювати склад
                може лише адміністратор.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Позицій на складі
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {itemList.length}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-xl border bg-white p-3 sm:p-5 ${
            lowStockItems > 0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            Низький залишок
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              lowStockItems > 0
                ? "text-red-600"
                : "text-gray-900"
            }`}
          >
            {lowStockItems}
          </p>
        </div>

        {canViewLedger && (
          <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
            <p className="text-xs text-gray-500 sm:text-sm">
              Вартість залишків
            </p>

            <p className="mt-2 break-words text-lg font-bold text-green-700 sm:text-2xl">
              {formatMoney(
                totalValue,
                settings.currency
              )}
            </p>
          </div>
        )}

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Постачальники
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {suppliersCount}
          </p>
        </div>
      </div>

      {/* ITEMS */}
      <div className="min-w-0">
        <WarehouseList
          items={
            itemList
          }
          currency={
            settings.currency
          }
          canManage={
            canManage
          }
          canCreatePurchases={
            canCreatePurchases
          }
          canViewPurchaseHistory={
            canCreatePurchases
          }
          canViewCosts={
            canViewLedger
          }
          purchaseInsights={
            purchaseInsights
          }
          focusedItemId={
            focusedItemId
          }
        />
      </div>

      {/* MOVEMENTS */}
      {canViewLedger && movementPage && (
        <div className="min-w-0">
          <WarehouseMovements
            movementPage={movementPage}
            items={itemList}
            objects={objectList}
            currency={settings.currency}
            filters={ledgerFilters}
          />
        </div>
      )}
    </div>
  );
}
