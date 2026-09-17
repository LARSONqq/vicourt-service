import Link from "next/link";
import { getWarehouseStockStatus, getRecommendedPurchaseQuantity, warehouseStockPresentation } from "@/lib/warehouseStock";
import WarehouseItemOperations from "@/components/warehouse/WarehouseItemOperations";

import {
  isWarehouseInboundMovement,
  isWarehouseOutboundMovement,
  warehouseMovementLabels,
} from "@/constants/warehouseLedger";
import {
  formatKyivTimestamp,
} from "@/lib/kyivDate";

import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  WarehouseItem,
} from "@/types/warehouseItem";
import type {
  WarehouseItemMovementPreview,
} from "@/types/warehouseMovement";
import type {
  WarehouseItemPurchasePreview,
} from "@/types/warehousePurchase";

type Props = {
  item: WarehouseItem;
  currency: AppCurrency;
  canViewManagementHistory: boolean;
  canAdjustStock: boolean;
  plannedQuantity: number | null;
  movements: WarehouseItemMovementPreview[] | null;
  purchases: WarehouseItemPurchasePreview[] | null;
  objectUsage: WarehouseItemMovementPreview[] | null;
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 3,
  }).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function getMovementQuantitySign(
  movement: WarehouseItemMovementPreview
) {
  if (
    isWarehouseInboundMovement(
      movement.movement_code
    ) ||
    movement.movement_code ===
      "direct_to_object" ||
    movement.movement_code ===
      "object_opening_balance"
  ) {
    return "+";
  }

  if (
    isWarehouseOutboundMovement(
      movement.movement_code
    ) ||
    movement.movement_code ===
      "direct_object_reversal"
  ) {
    return "−";
  }

  return "";
}

function getMovementBadgeClass(
  movement: WarehouseItemMovementPreview
) {
  if (
    isWarehouseInboundMovement(
      movement.movement_code
    )
  ) {
    return "bg-green-50 text-green-700";
  }

  if (
    isWarehouseOutboundMovement(
      movement.movement_code
    )
  ) {
    return "bg-orange-50 text-orange-700";
  }

  return "bg-blue-50 text-blue-700";
}

function getObjectName(
  movement: WarehouseItemMovementPreview
) {
  return (
    movement.object_name_snapshot ||
    movement.object?.name ||
    null
  );
}

function HistoryUnavailable({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="status"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

function RecentMovements({
  movements,
}: {
  movements: WarehouseItemMovementPreview[] | null;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Останні рухи
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Останні зміни залишку цього матеріалу
        </p>
      </div>

      {movements === null ? (
        <div className="p-4 sm:p-5">
          <HistoryUnavailable message="Не вдалося завантажити рухи матеріалу. Спробуй оновити сторінку." />
        </div>
      ) : movements.length === 0 ? (
        <p className="p-5 text-sm text-gray-500">
          Для цього матеріалу ще немає рухів.
        </p>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {movements.map((movement) => {
              const objectName =
                getObjectName(movement);

              return (
                <article
                  key={movement.id}
                  className="min-w-0 space-y-3 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getMovementBadgeClass(
                        movement
                      )}`}
                    >
                      {
                        warehouseMovementLabels[
                          movement.movement_code
                        ]
                      }
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatKyivTimestamp(
                        movement.created_at
                      ) || "Невідома дата"}
                    </span>
                  </div>

                  <p className="text-lg font-semibold text-gray-900">
                    {getMovementQuantitySign(
                      movement
                    )}
                    {formatQuantity(
                      Number(movement.quantity)
                    )}{" "}
                    {movement.unit_snapshot}
                  </p>

                  <div className="min-w-0 text-sm text-gray-600">
                    {objectName ? (
                      movement.object?.id ? (
                        <Link
                          href={`/objects/${movement.object.id}`}
                          className="break-words font-medium text-green-700 hover:underline"
                        >
                          {objectName}
                        </Link>
                      ) : (
                        <p className="break-words">
                          {objectName}
                        </p>
                      )
                    ) : (
                      <p className="text-gray-400">
                        Без об’єкта
                      </p>
                    )}
                    <p className="mt-1 break-words text-xs text-gray-500">
                      {movement.performed_by_name ||
                        "Система"}
                    </p>
                    {movement.note && (
                      <p className="mt-2 break-words">
                        {movement.note}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Дата</th>
                  <th className="p-4 font-medium">Тип</th>
                  <th className="p-4 font-medium">Кількість</th>
                  <th className="p-4 font-medium">Об’єкт</th>
                  <th className="p-4 font-medium">Виконавець / примітка</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const objectName =
                    getObjectName(movement);

                  return (
                    <tr
                      key={movement.id}
                      className="border-t align-top"
                    >
                      <td className="whitespace-nowrap p-4 text-gray-600">
                        {formatKyivTimestamp(
                          movement.created_at
                        ) || "Невідома дата"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getMovementBadgeClass(
                            movement
                          )}`}
                        >
                          {
                            warehouseMovementLabels[
                              movement.movement_code
                            ]
                          }
                        </span>
                      </td>
                      <td className="whitespace-nowrap p-4 font-semibold text-gray-900">
                        {getMovementQuantitySign(
                          movement
                        )}
                        {formatQuantity(
                          Number(movement.quantity)
                        )}{" "}
                        {movement.unit_snapshot}
                      </td>
                      <td className="p-4">
                        {objectName ? (
                          movement.object?.id ? (
                            <Link
                              href={`/objects/${movement.object.id}`}
                              className="font-medium text-green-700 hover:underline"
                            >
                              {objectName}
                            </Link>
                          ) : (
                            <span className="text-gray-700">
                              {objectName}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">
                            Без об’єкта
                          </span>
                        )}
                      </td>
                      <td className="max-w-sm p-4 text-gray-600">
                        <p className="break-words">
                          {movement.performed_by_name ||
                            "Система"}
                        </p>
                        {movement.note && (
                          <p className="mt-1 break-words text-xs text-gray-500">
                            {movement.note}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Purchases({
  purchases,
  unit,
  currency,
}: {
  purchases: WarehouseItemPurchasePreview[] | null;
  unit: string;
  currency: AppCurrency;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Закупівлі
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Актуальні та останні закупівлі матеріалу
        </p>
      </div>

      {purchases === null ? (
        <div className="p-4 sm:p-5">
          <HistoryUnavailable message="Не вдалося завантажити закупівлі матеріалу. Спробуй оновити сторінку." />
        </div>
      ) : purchases.length === 0 ? (
        <p className="p-5 text-sm text-gray-500">
          Для цього матеріалу ще немає закупівель.
        </p>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {purchases.map((purchase) => {
              const quantity = Number(
                purchase.quantity
              );
              const price = Number(
                purchase.purchase_price
              );

              return (
                <article
                  key={purchase.id}
                  className="min-w-0 space-y-3 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        purchase.status === "Закуплено"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {purchase.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatKyivTimestamp(
                        purchase.purchased_at ||
                          purchase.created_at
                      ) || "Невідома дата"}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatQuantity(quantity)} {unit}
                  </p>
                  <p className="break-words text-sm text-gray-600">
                    {purchase.supplier ||
                      "Постачальника не вказано"}
                  </p>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <p>
                      Ціна: {formatMoney(price, currency)} / {unit}
                    </p>
                    <p className="mt-1 font-medium text-gray-900">
                      Разом: {formatMoney(
                        quantity * price,
                        currency
                      )}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Дата</th>
                  <th className="p-4 font-medium">Статус</th>
                  <th className="p-4 font-medium">Кількість</th>
                  <th className="p-4 font-medium">Постачальник</th>
                  <th className="p-4 font-medium">Ціна / сума</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const quantity = Number(
                    purchase.quantity
                  );
                  const price = Number(
                    purchase.purchase_price
                  );

                  return (
                    <tr
                      key={purchase.id}
                      className="border-t align-top"
                    >
                      <td className="whitespace-nowrap p-4 text-gray-600">
                        {formatKyivTimestamp(
                          purchase.purchased_at ||
                            purchase.created_at
                        ) || "Невідома дата"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            purchase.status === "Закуплено"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {purchase.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap p-4 font-medium">
                        {formatQuantity(quantity)} {unit}
                      </td>
                      <td className="max-w-xs p-4 text-gray-600">
                        <span className="break-words">
                          {purchase.supplier || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap p-4 text-gray-600">
                        <p>
                          {formatMoney(price, currency)} / {unit}
                        </p>
                        <p className="mt-1 font-medium text-gray-900">
                          {formatMoney(
                            quantity * price,
                            currency
                          )}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function ObjectUsage({
  movements,
}: {
  movements: WarehouseItemMovementPreview[] | null;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Використання на об’єктах
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Останні видачі, повернення та початкові залишки
        </p>
      </div>

      {movements === null ? (
        <div className="p-4 sm:p-5">
          <HistoryUnavailable message="Не вдалося завантажити використання матеріалу на об’єктах. Спробуй оновити сторінку." />
        </div>
      ) : movements.length === 0 ? (
        <p className="p-5 text-sm text-gray-500">
          Цей матеріал ще не використовувався на об’єктах.
        </p>
      ) : (
        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2">
          {movements.map((movement) => {
            const objectName =
              getObjectName(movement) ||
              "Об’єкт видалено";
            const isReturn =
              movement.movement_code ===
                "return_from_object" ||
              movement.movement_code ===
                "direct_object_reversal";

            return (
              <article
                key={movement.id}
                className="min-w-0 rounded-xl border p-4"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  {movement.object?.id ? (
                    <Link
                      href={`/objects/${movement.object.id}`}
                      className="min-w-0 break-words font-semibold text-green-700 hover:underline"
                    >
                      {objectName}
                    </Link>
                  ) : (
                    <p className="min-w-0 break-words font-semibold text-gray-900">
                      {objectName}
                    </p>
                  )}
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatKyivTimestamp(
                      movement.created_at
                    ) || "Невідома дата"}
                  </span>
                </div>
                <p
                  className={`mt-3 text-lg font-semibold ${
                    isReturn
                      ? "text-orange-700"
                      : "text-green-700"
                  }`}
                >
                  {isReturn ? "−" : "+"}
                  {formatQuantity(
                    Number(movement.quantity)
                  )}{" "}
                  {movement.unit_snapshot}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {
                    warehouseMovementLabels[
                      movement.movement_code
                    ]
                  }
                </p>
                {movement.note && (
                  <p className="mt-3 break-words text-sm text-gray-600">
                    {movement.note}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function WarehouseItemPassport({
  item,
  currency,
  canViewManagementHistory,
  canAdjustStock,
  plannedQuantity,
  movements,
  purchases,
  objectUsage,
}: Props) {
  const quantity = Number(item.quantity);
  const minimumQuantity = Number(
    item.min_quantity
  );
  const stockStatus = warehouseStockPresentation[getWarehouseStockStatus(item)];
  const recommended = getRecommendedPurchaseQuantity(item);

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 space-y-5 p-4 sm:p-6">
      <Link
        href="/warehouse"
        className="inline-flex min-h-10 items-center text-sm font-medium text-green-700 hover:underline"
      >
        ← Назад до складу
      </Link>

      <header className="min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-2xl font-bold text-gray-900 sm:text-3xl">
                {item.name}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${stockStatus.badgeClass}`}
              >
                {stockStatus.label}
              </span>
            </div>
            <p className="mt-2 break-words text-sm text-gray-500 sm:text-base">
              {item.category || "Без категорії"} · {item.unit}
            </p>
          </div>

          <div
            className={`min-w-0 rounded-xl border px-5 py-4 lg:min-w-56 ${stockStatus.panelClass}`}
          >
            <p className="text-sm text-gray-600">
              Поточний залишок
            </p>
            <p
              className={`mt-1 break-words text-3xl font-bold ${stockStatus.valueClass}`}
            >
              {formatQuantity(quantity)} {item.unit}
            </p>
          </div>
        </div>
      </header>

      {recommended !== null && <p className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-medium text-orange-800">Рекомендовано докупити: {formatQuantity(recommended)} {item.unit}</p>}

      {canViewManagementHistory && (
        <WarehouseItemOperations
          itemId={item.id}
          name={item.name}
          unit={item.unit}
          currency={currency}
          canAdjust={canAdjustStock}
          recommendedQuantity={recommended}
          plannedQuantity={plannedQuantity}
          supplier={item.supplier}
        />
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Основна інформація
          </h2>
          <dl className="mt-4 divide-y text-sm">
            <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
              <dt className="text-gray-500">Назва</dt>
              <dd className="break-words font-medium text-gray-900 sm:text-right">
                {item.name}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
              <dt className="text-gray-500">Категорія</dt>
              <dd className="break-words font-medium text-gray-900 sm:text-right">
                {item.category || "Не вказано"}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
              <dt className="text-gray-500">Одиниця виміру</dt>
              <dd className="break-words font-medium text-gray-900 sm:text-right">
                {item.unit}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
              <dt className="text-gray-500">Постачальник</dt>
              <dd className="break-words font-medium text-gray-900 sm:text-right">
                {item.supplier || "Не вказано"}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
              <dt className="text-gray-500">Створено</dt>
              <dd className="font-medium text-gray-900 sm:text-right">
                {formatKyivTimestamp(
                  item.created_at
                ) || "Не вказано"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="min-w-0 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Запас
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Поточний</p>
              <p className="mt-2 break-words text-xl font-semibold text-gray-900">
                {formatQuantity(quantity)} {item.unit}
              </p>
            </div>
            <div className="min-w-0 rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Мінімальний</p>
              <p className="mt-2 break-words text-xl font-semibold text-gray-900">
                {item.min_quantity == null ? "Не вказано" : formatQuantity(minimumQuantity)}{" "}
                {item.unit}
              </p>
            </div>
            <div className="min-w-0 rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Цільовий</p>
              <p className="mt-2 break-words text-xl font-semibold text-gray-900">
                {item.target_quantity === null
                  ? "Не вказано"
                  : `${formatQuantity(
                      Number(
                        item.target_quantity
                      )
                    )} ${item.unit}`}
              </p>
            </div>
          </div>

          <div
            className={`mt-4 rounded-xl border p-4 ${stockStatus.panelClass}`}
          >
            <p className="text-xs text-gray-500">
              Стан запасу
            </p>
            <p
              className={`mt-1 text-lg font-semibold ${stockStatus.valueClass}`}
            >
              {stockStatus.label}
            </p>
          </div>
        </section>
      </div>

      {canViewManagementHistory ? (
        <div className="min-w-0 space-y-5">
          <RecentMovements movements={movements} />
          <Purchases
            purchases={purchases}
            unit={item.unit}
            currency={currency}
          />
          <ObjectUsage movements={objectUsage} />
        </div>
      ) : (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold text-gray-900">
            Історія матеріалу
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Детальна історія рухів і закупівель доступна відповідальним ролям.
          </p>
        </section>
      )}
    </main>
  );
}
