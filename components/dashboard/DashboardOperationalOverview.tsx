import Link from "next/link";

import {
  formatDateValue,
} from "@/lib/kyivDate";
import {
  formatWarehouseQuantity,
} from "@/lib/warehousePlanning";

import type {
  DashboardData,
} from "@/types/dashboard";

type Props = {
  data: DashboardData;
};

function formatMoney(
  value: number,
  currency: DashboardData["currency"]
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

function SummaryRow({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 break-words text-gray-500">
        {label}
      </span>
      <span
        className={`shrink-0 text-right font-semibold ${
          danger
            ? "text-red-700"
            : "text-gray-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function DashboardOperationalOverview({
  data,
}: Props) {
  return (
    <section className="min-w-0 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Оперативний огляд
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Короткий стан основних напрямів роботи
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">
              Об’єкти
            </h3>
            <Link
              href="/objects"
              className="shrink-0 text-sm font-medium text-green-700 hover:underline"
            >
              Відкрити →
            </Link>
          </div>

          <div className="mt-3 divide-y">
            <SummaryRow
              label="В роботі"
              value={
                data.objects
                  .working
              }
            />
            <SummaryRow
              label="Постійне обслуговування"
              value={
                data.objects
                  .permanentMaintenance
              }
            />
            <SummaryRow
              label="Періодичний нагляд"
              value={
                data.objects
                  .supervision
              }
            />
          </div>

          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
            <p className="text-gray-500">
              Огляди
            </p>
            <p className="mt-1 font-medium text-gray-800">
              Сьогодні: {data.objects.supervisionToday} · Прострочено:{" "}
              <span
                className={
                  data.objects
                    .supervisionOverdue >
                  0
                    ? "text-red-700"
                    : undefined
                }
              >
                {
                  data.objects
                    .supervisionOverdue
                }
              </span>
            </p>

            {data.objects
              .nextSupervision && (
              <Link
                href={`/objects/${data.objects.nextSupervision.id}`}
                className="mt-2 block min-w-0 break-words text-xs text-green-700 hover:underline"
              >
                Наступний: {data.objects.nextSupervision.name} ·{" "}
                {formatDateValue(
                  data.objects
                    .nextSupervision
                    .date
                )}
              </Link>
            )}
          </div>
        </article>

        <article className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">
              Техніка
            </h3>
            <Link
              href="/equipment"
              className="shrink-0 text-sm font-medium text-green-700 hover:underline"
            >
              Відкрити →
            </Link>
          </div>

          <div className="mt-3 divide-y">
            <SummaryRow
              label="Справна та в роботі"
              value={
                data.equipment.active
              }
            />
            <SummaryRow
              label="ТО сьогодні"
              value={
                data.equipment
                  .maintenanceToday
              }
            />
            <SummaryRow
              label="Прострочене ТО"
              value={
                data.equipment
                  .maintenanceOverdue
              }
              danger={
                data.equipment
                  .maintenanceOverdue >
                0
              }
            />
          </div>

          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
            {data.equipment
              .nextMaintenance ? (
              <>
                <p className="text-gray-500">
                  Найближче планове ТО
                </p>
                <p className="mt-1 break-words font-medium text-gray-800">
                  {
                    data.equipment
                      .nextMaintenance
                      .name
                  }
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDateValue(
                    data.equipment
                      .nextMaintenance
                      .date
                  )}
                </p>
              </>
            ) : (
              <p className="text-gray-500">
                Майбутнього ТО не заплановано.
              </p>
            )}
          </div>
        </article>

        <article className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">
              Склад
            </h3>
            <Link
              href="/warehouse"
              className="shrink-0 text-sm font-medium text-green-700 hover:underline"
            >
              Відкрити →
            </Link>
          </div>

          <p className="mt-3 text-sm text-gray-500">
            Низькі залишки:{" "}
            <span
              className={`font-semibold ${
                data.warehouse
                  .lowStockCount > 0
                  ? "text-orange-700"
                  : "text-green-700"
              }`}
            >
              {
                data.warehouse
                  .lowStockCount
              }
            </span>
          </p>

          {data.warehouse.items
            .length === 0 ? (
            <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Немає позицій із низьким залишком.
            </div>
          ) : (
            <div className="mt-3 divide-y">
              {data.warehouse.items.map(
                (item) => (
                  <Link
                    key={item.id}
                    href={`/warehouse?item=${item.id}#warehouse-item-${item.id}`}
                    className="block min-w-0 py-2.5 hover:text-green-700"
                  >
                    <span className="block break-words text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="mt-1 block break-words text-xs text-gray-500">
                      {formatWarehouseQuantity(
                        item.currentQuantity
                      )}{" "}
                      {item.unit} · мін.{" "}
                      {formatWarehouseQuantity(
                        item.minimumQuantity
                      )}
                      {item.targetQuantity !==
                        null &&
                        ` · ціль ${formatWarehouseQuantity(
                          item.targetQuantity
                        )}`}
                    </span>
                    {data.warehouse
                      .planningVisible && (
                      <span className="mt-1 block break-words text-xs text-gray-400">
                        Заплановано: {formatWarehouseQuantity(
                          item.plannedIncoming ||
                            0
                        )}{" "}
                        {item.unit}
                        {item.recommendedRemaining !==
                          null &&
                          item.recommendedRemaining >
                            0 &&
                          ` · ще потрібно ${formatWarehouseQuantity(
                            item.recommendedRemaining
                          )}`}
                      </span>
                    )}
                  </Link>
                )
              )}
            </div>
          )}

          {data.purchases && (
            <Link
              href="/purchases"
              className="mt-3 block rounded-lg bg-gray-50 p-3 text-sm text-gray-600 hover:bg-gray-100"
            >
              Заплановані закупівлі:{" "}
              <span className="font-semibold text-gray-900">
                {
                  data.purchases
                    .plannedCount
                }
              </span>
            </Link>
          )}
        </article>

        {data.finance && (
          <article className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">
                Розрахунки з клієнтами
              </h3>
              <Link
                href="/notifications?type=finance"
                className="shrink-0 text-sm font-medium text-green-700 hover:underline"
              >
                Деталі →
              </Link>
            </div>

            <div className="mt-3 divide-y">
              <SummaryRow
                label="Прострочені етапи"
                value={
                  data.finance
                    .overdueCount
                }
                danger={
                  data.finance
                    .overdueCount > 0
                }
              />
              <SummaryRow
                label="Прострочена сума"
                value={formatMoney(
                  data.finance
                    .overdueAmount,
                  data.currency
                )}
                danger={
                  data.finance
                    .overdueAmount > 0
                }
              />
              <SummaryRow
                label="До сплати сьогодні"
                value={
                  data.finance
                    .dueTodayCount
                }
              />
              <SummaryRow
                label="Сума на сьогодні"
                value={formatMoney(
                  data.finance
                    .dueTodayAmount,
                  data.currency
                )}
              />
            </div>

            <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-500">
              Суми враховують фактичні оплати за FIFO; платіж на сьогодні не є простроченим.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
