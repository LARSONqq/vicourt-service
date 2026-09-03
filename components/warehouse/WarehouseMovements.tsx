import Link from "next/link";

import {
  isWarehouseInboundMovement,
  isWarehouseOutboundMovement,
  warehouseMovementLabels,
  warehouseMovementOptions,
} from "@/constants/warehouseLedger";
import { formatKyivTimestamp } from "@/lib/kyivDate";

import type { AppCurrency } from "@/types/appSettings";
import type { ObjectItem } from "@/types/object";
import type { WarehouseItem } from "@/types/warehouseItem";
import type {
  WarehouseMovement,
  WarehouseMovementPage,
} from "@/types/warehouseMovement";

type FilterValues = {
  search?: string;
  item?: string;
  object?: string;
  movement?: string;
  from?: string;
  to?: string;
};

type Props = {
  movementPage: WarehouseMovementPage;
  items: WarehouseItem[];
  objects: ObjectItem[];
  currency: AppCurrency;
  filters: FilterValues;
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

function getQuantitySign(movement: WarehouseMovement) {
  if (
    isWarehouseInboundMovement(movement.movement_code) ||
    movement.movement_code === "direct_to_object" ||
    movement.movement_code === "object_opening_balance"
  ) {
    return "+";
  }

  if (
    isWarehouseOutboundMovement(movement.movement_code) ||
    movement.movement_code === "direct_object_reversal"
  ) {
    return "−";
  }

  return "";
}

function getBadgeClass(movement: WarehouseMovement) {
  if (movement.ledger_version < 3) {
    return "bg-gray-100 text-gray-600";
  }

  if (isWarehouseInboundMovement(movement.movement_code)) {
    return "bg-green-50 text-green-700";
  }

  if (isWarehouseOutboundMovement(movement.movement_code)) {
    return "bg-orange-50 text-orange-700";
  }

  return "bg-blue-50 text-blue-700";
}

function getItemName(movement: WarehouseMovement) {
  return movement.item_name_snapshot || movement.item?.name || "Матеріал";
}

function getObjectName(movement: WarehouseMovement) {
  return movement.object_name_snapshot || movement.object?.name || null;
}

function buildPageHref(filters: FilterValues, page: number) {
  const params = new URLSearchParams();

  if (filters.search) params.set("ledger_search", filters.search);
  if (filters.item) params.set("ledger_item", filters.item);
  if (filters.object) params.set("ledger_object", filters.object);
  if (filters.movement) params.set("ledger_movement", filters.movement);
  if (filters.from) params.set("ledger_from", filters.from);
  if (filters.to) params.set("ledger_to", filters.to);
  if (page > 1) params.set("ledger_page", String(page));

  const query = params.toString();
  return `/warehouse${query ? `?${query}` : ""}#materials-ledger`;
}

function MovementDetails({
  movement,
  currency,
}: {
  movement: WarehouseMovement;
  currency: AppCurrency;
}) {
  const objectName = getObjectName(movement);

  return (
    <>
      <div className="min-w-0">
        <p className="break-words font-semibold text-gray-900">
          {getItemName(movement)}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {formatKyivTimestamp(movement.created_at) || "Невідома дата"}
        </p>
      </div>

      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(
          movement
        )}`}
      >
        {warehouseMovementLabels[movement.movement_code]}
      </span>

      <div>
        <p className="font-semibold text-gray-900">
          {getQuantitySign(movement)}
          {formatQuantity(Number(movement.quantity))} {movement.unit_snapshot}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {formatMoney(Number(movement.unit_price), currency)} / од. ·{" "}
          {formatMoney(Number(movement.total_cost), currency)}
        </p>
      </div>

      <div className="min-w-0 text-sm">
        {objectName ? (
          movement.object_id ? (
            <Link
              href={`/objects/${movement.object_id}`}
              className="break-words font-medium text-green-700 hover:underline"
            >
              {objectName}
            </Link>
          ) : (
            <p className="break-words text-gray-700">{objectName}</p>
          )
        ) : (
          <p className="text-gray-400">Без об’єкта</p>
        )}
        <p className="mt-1 break-words text-xs text-gray-500">
          {movement.performed_by_name ||
            (movement.performed_by ? "Користувач" : "Система")}
        </p>
      </div>

      <div className="text-sm text-gray-600">
        {movement.warehouse_quantity_after !== null && (
          <p>
            Склад після: {formatQuantity(Number(movement.warehouse_quantity_after))}{" "}
            {movement.unit_snapshot}
          </p>
        )}
        {movement.object_quantity_after !== null && (
          <p>
            Об’єкт після: {formatQuantity(Number(movement.object_quantity_after))}{" "}
            {movement.unit_snapshot}
          </p>
        )}
        {movement.note && (
          <p className="mt-1 break-words text-xs text-gray-500">
            {movement.note}
          </p>
        )}
      </div>
    </>
  );
}

export default function WarehouseMovements({
  movementPage,
  items,
  objects,
  currency,
  filters,
}: Props) {
  return (
    <section
      id="materials-ledger"
      className="scroll-mt-4 overflow-hidden rounded-xl border bg-white"
    >
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Рух матеріалів
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Незмінна історія кількості, собівартості, об’єктів і виконавців
        </p>
      </div>

      <form
        method="get"
        className="grid gap-3 border-b bg-gray-50 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <label className="min-w-0 text-sm font-medium text-gray-700">
          Пошук
          <input
            type="search"
            name="ledger_search"
            defaultValue={filters.search || ""}
            placeholder="Матеріал, об’єкт, виконавець або причина"
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 font-normal outline-none focus:border-green-600"
          />
        </label>

        <label className="min-w-0 text-sm font-medium text-gray-700">
          Матеріал
          <select
            name="ledger_item"
            defaultValue={filters.item || ""}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 font-normal outline-none focus:border-green-600"
          >
            <option value="">Усі матеріали</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm font-medium text-gray-700">
          Тип руху
          <select
            name="ledger_movement"
            defaultValue={filters.movement || ""}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 font-normal outline-none focus:border-green-600"
          >
            <option value="">Усі типи</option>
            {warehouseMovementOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm font-medium text-gray-700">
          Об’єкт
          <select
            name="ledger_object"
            defaultValue={filters.object || ""}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 font-normal outline-none focus:border-green-600"
          >
            <option value="">Усі об’єкти</option>
            {objects.map((object) => (
              <option key={object.id} value={object.id}>
                {object.name}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm font-medium text-gray-700">
          Дата від
          <input
            type="date"
            name="ledger_from"
            defaultValue={filters.from || ""}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 font-normal outline-none focus:border-green-600"
          />
        </label>

        <label className="min-w-0 text-sm font-medium text-gray-700">
          Дата до
          <input
            type="date"
            name="ledger_to"
            defaultValue={filters.to || ""}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 font-normal outline-none focus:border-green-600"
          />
        </label>

        <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row xl:col-span-3">
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-700"
          >
            Застосувати
          </button>
          <Link
            href="/warehouse#materials-ledger"
            className="flex min-h-11 items-center justify-center rounded-lg border bg-white px-5 py-2 font-medium text-gray-700 hover:bg-gray-100"
          >
            Скинути
          </Link>
        </div>
      </form>

      {movementPage.movements.length === 0 ? (
        <div className="p-8 text-center">
          <p className="font-medium text-gray-700">Рухів не знайдено</p>
          <p className="mt-1 text-sm text-gray-500">
            Зміни фільтри або виконай першу складську операцію.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b px-4 py-3 text-sm text-gray-500 sm:px-5">
            Знайдено: <strong className="text-gray-800">{movementPage.total}</strong>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {movementPage.movements.map((movement) => (
              <article key={movement.id} className="space-y-3 rounded-xl border p-4">
                <MovementDetails movement={movement} currency={currency} />
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Матеріал / дата</th>
                  <th className="p-4 font-medium">Тип</th>
                  <th className="p-4 font-medium">Кількість / вартість</th>
                  <th className="p-4 font-medium">Об’єкт / виконавець</th>
                  <th className="p-4 font-medium">Залишки / причина</th>
                </tr>
              </thead>
              <tbody>
                {movementPage.movements.map((movement) => (
                  <tr key={movement.id} className="border-t align-top">
                    <td className="p-4">
                      <p className="break-words font-semibold text-gray-900">
                        {getItemName(movement)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatKyivTimestamp(movement.created_at) || "Невідома дата"}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeClass(movement)}`}>
                        {warehouseMovementLabels[movement.movement_code]}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">
                        {getQuantitySign(movement)}{formatQuantity(Number(movement.quantity))}{" "}
                        {movement.unit_snapshot}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatMoney(Number(movement.unit_price), currency)} / од.
                      </p>
                      <p className="mt-1 font-medium">
                        {formatMoney(Number(movement.total_cost), currency)}
                      </p>
                    </td>
                    <td className="p-4">
                      {getObjectName(movement) ? (
                        movement.object_id ? (
                          <Link href={`/objects/${movement.object_id}`} className="font-medium text-green-700 hover:underline">
                            {getObjectName(movement)}
                          </Link>
                        ) : (
                          <p>{getObjectName(movement)}</p>
                        )
                      ) : (
                        <p className="text-gray-400">Без об’єкта</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {movement.performed_by_name || (movement.performed_by ? "Користувач" : "Система")}
                      </p>
                    </td>
                    <td className="p-4 text-gray-600">
                      {movement.warehouse_quantity_after !== null && (
                        <p>Склад: {formatQuantity(Number(movement.warehouse_quantity_after))} {movement.unit_snapshot}</p>
                      )}
                      {movement.object_quantity_after !== null && (
                        <p>Об’єкт: {formatQuantity(Number(movement.object_quantity_after))} {movement.unit_snapshot}</p>
                      )}
                      {movement.note && <p className="mt-1 max-w-sm break-words text-xs">{movement.note}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(movementPage.hasPreviousPage || movementPage.hasNextPage) && (
        <nav aria-label="Пагінація рухів" className="flex items-center justify-between gap-3 border-t p-4">
          {movementPage.hasPreviousPage ? (
            <Link href={buildPageHref(filters, movementPage.page - 1)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
              ← Новіші
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-gray-500">Сторінка {movementPage.page}</span>
          {movementPage.hasNextPage ? (
            <Link href={buildPageHref(filters, movementPage.page + 1)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Старіші →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
