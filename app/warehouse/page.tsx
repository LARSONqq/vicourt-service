import WarehouseActions from "@/components/warehouse/WarehouseActions";
import WarehouseList from "@/components/warehouse/WarehouseList";
import WarehouseMovements from "@/components/warehouse/WarehouseMovements";

import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canManageWarehouse } from "@/lib/auth/permissions";

import { getObjects } from "@/services/objectService";
import { getAppSettings } from "@/services/settingsService";

import {
  getWarehouseItems,
  getWarehouseMovements,
} from "@/services/warehouseService";

import type { AppCurrency } from "@/types/appSettings";

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

export default async function WarehousePage() {
  const currentProfile =
    await requireSectionAccess(
      "warehouse"
    );

  const canManage =
    canManageWarehouse(
      currentProfile.role
    );

  const [
    items,
    movements,
    objects,
    settings,
  ] = await Promise.all([
    getWarehouseItems(),
    getWarehouseMovements(),
    getObjects(),
    getAppSettings(),
  ]);

  const itemList =
    Array.isArray(items)
      ? items
      : [];

  const movementList =
    Array.isArray(movements)
      ? movements
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
      (sum, item) =>
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Склад
          </h1>

          <p className="mt-1 text-gray-500">
            Матеріали, залишки та рух
            товарів
          </p>
        </div>

        {canManage && (
          <WarehouseActions
            items={itemList}
            objects={objectList}
          />
        )}
      </div>

      {!canManage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="font-medium text-blue-800">
            Режим перегляду
          </p>

          <p className="mt-1 text-sm text-blue-700">
            Ти можеш переглядати
            залишки та історію руху
            матеріалів, але змінювати
            склад може лише
            адміністратор.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Позицій на складі
          </p>

          <p className="mt-2 text-3xl font-bold">
            {itemList.length}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Низький залишок
          </p>

          <p className="mt-2 text-3xl font-bold text-red-600">
            {lowStockItems}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Вартість залишків
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700">
            {formatMoney(
              totalValue,
              settings.currency
            )}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Постачальники
          </p>

          <p className="mt-2 text-3xl font-bold">
            {suppliersCount}
          </p>
        </div>
      </div>

      <WarehouseList
        items={itemList}
        objects={objectList}
        currency={settings.currency}
        canManage={canManage}
      />

      <WarehouseMovements
        movements={movementList}
      />
    </div>
  );
}