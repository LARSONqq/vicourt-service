"use client";

import {
  warehouseMovementLabels,
} from "@/constants/warehouseLedger";
import { formatKyivTimestamp } from "@/lib/kyivDate";

import type { AppCurrency } from "@/types/appSettings";
import type { WarehouseMovement } from "@/types/warehouseMovement";

type Props = {
  movements: WarehouseMovement[];
  currency: AppCurrency;
};

function formatMoney(value: number, currency: AppCurrency) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 3,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function ObjectMaterialHistory({
  movements,
  currency,
}: Props) {
  return (
    <div className="mt-6 border-t pt-5">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">Історія рухів</h3>
        <p className="mt-1 text-sm text-gray-500">
          Останні операції з історичною собівартістю
        </p>
      </div>

      {movements.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 p-4 text-sm text-gray-500">
          Історичних рухів для цього об’єкта ще немає.
        </div>
      ) : (
        <div className="space-y-2">
          {movements.map((movement) => (
            <article
              key={movement.id}
              className="grid min-w-0 gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {warehouseMovementLabels[movement.movement_code]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatKyivTimestamp(movement.created_at) || "Невідома дата"}
                  </span>
                </div>
                <p className="mt-2 break-words font-medium text-gray-900">
                  {movement.item_name_snapshot}
                </p>
                <p className="mt-1 break-words text-xs text-gray-500">
                  {movement.performed_by_name ||
                    (movement.performed_by ? "Користувач" : "Система")}
                  {movement.note ? ` · ${movement.note}` : ""}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="font-semibold text-gray-900">
                  {formatQuantity(Number(movement.quantity))}{" "}
                  {movement.unit_snapshot}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatMoney(Number(movement.unit_price), currency)} / од.
                </p>
                <p className="mt-1 text-sm font-medium text-green-700">
                  {formatMoney(Number(movement.total_cost), currency)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
