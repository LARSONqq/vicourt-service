"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import type { AppCurrency } from "@/types/appSettings";
import type {
  ReportMaterial,
  ReportWorkLog,
} from "@/services/reportService";

type Props = {
  workLogs?: ReportWorkLog[];
  materials?: ReportMaterial[];
  currency: AppCurrency;
};

type ObjectSummary = {
  objectId: number;
  objectName: string;
  hours: number;
  materialPositions: number;
  materialQuantity: number;
  materialCost: number;
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

  const negative =
    safeValue < 0;

  const absoluteValue =
    Math.abs(safeValue);

  const [wholePart, decimalPart] =
    absoluteValue
      .toFixed(2)
      .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${negative ? "−" : ""}${formattedWhole},${decimalPart} ${
    symbols[currency] || currency
  }`;
}

function formatNumber(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return safeValue
    .toFixed(2)
    .replace(".", ",")
    .replace(/,00$/, "");
}

function getMaterialDate(
  value: string
) {
  return value.slice(0, 10);
}

export default function ObjectCostReport({
  workLogs = [],
  materials = [],
  currency,
}: Props) {
  const [
    startDate,
    setStartDate,
  ] = useState("");

  const [
    endDate,
    setEndDate,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const safeWorkLogs =
    Array.isArray(workLogs)
      ? workLogs
      : [];

  const safeMaterials =
    Array.isArray(materials)
      ? materials
      : [];

  const filteredWorkLogs =
    useMemo(() => {
      return safeWorkLogs.filter(
        (workLog) => {
          const date =
            workLog.work_date;

          if (
            startDate &&
            date < startDate
          ) {
            return false;
          }

          if (
            endDate &&
            date > endDate
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      safeWorkLogs,
      startDate,
      endDate,
    ]);

  const filteredMaterials =
    useMemo(() => {
      return safeMaterials.filter(
        (material) => {
          const date =
            getMaterialDate(
              material.created_at
            );

          if (
            startDate &&
            date < startDate
          ) {
            return false;
          }

          if (
            endDate &&
            date > endDate
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      safeMaterials,
      startDate,
      endDate,
    ]);

  const summaries =
    useMemo(() => {
      const map = new Map<
        number,
        ObjectSummary
      >();

      for (
        const workLog of
        filteredWorkLogs
      ) {
        const objectId =
          Number(
            workLog.object_id
          );

        if (
          !Number.isInteger(
            objectId
          ) ||
          objectId <= 0
        ) {
          continue;
        }

        const current =
          map.get(objectId) ?? {
            objectId,
            objectName:
              workLog.object
                ?.name ||
              `Об’єкт #${objectId}`,
            hours: 0,
            materialPositions: 0,
            materialQuantity: 0,
            materialCost: 0,
          };

        current.hours +=
          Number(
            workLog.hours
          ) || 0;

        map.set(
          objectId,
          current
        );
      }

      for (
        const material of
        filteredMaterials
      ) {
        const objectId =
          Number(
            material.object_id
          );

        if (
          !Number.isInteger(
            objectId
          ) ||
          objectId <= 0
        ) {
          continue;
        }

        const current =
          map.get(objectId) ?? {
            objectId,
            objectName:
              material.object
                ?.name ||
              `Об’єкт #${objectId}`,
            hours: 0,
            materialPositions: 0,
            materialQuantity: 0,
            materialCost: 0,
          };

        const quantity =
          Number(
            material.quantity
          ) || 0;

        const price =
          Number(
            material.price
          ) || 0;

        current.materialPositions +=
          1;

        current.materialQuantity +=
          quantity;

        current.materialCost +=
          quantity * price;

        map.set(
          objectId,
          current
        );
      }

      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return Array.from(
        map.values()
      )
        .filter(
          (summary) =>
            !normalizedSearch ||
            summary.objectName
              .toLowerCase()
              .includes(
                normalizedSearch
              )
        )
        .sort(
          (
            first,
            second
          ) =>
            second.materialCost -
              first.materialCost ||
            second.hours -
              first.hours ||
            first.objectName.localeCompare(
              second.objectName,
              "uk"
            )
        );
    }, [
      filteredWorkLogs,
      filteredMaterials,
      search,
    ]);

  const totals =
    useMemo(() => {
      return summaries.reduce(
        (
          total,
          summary
        ) => {
          total.hours +=
            summary.hours;

          total.materialPositions +=
            summary.materialPositions;

          total.materialCost +=
            summary.materialCost;

          return total;
        },
        {
          hours: 0,
          materialPositions: 0,
          materialCost: 0,
        }
      );
    }, [summaries]);

  const hasFilters =
    Boolean(
      startDate ||
      endDate ||
      search
    );

  function resetFilters() {
    setStartDate("");
    setEndDate("");
    setSearch("");
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Витрати по об’єктах
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Робочі години та
              собівартість використаних
              матеріалів за вибраний
              період
            </p>
          </div>

          <Link
            href="/objects"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            Усі об’єкти →
          </Link>
        </div>
      </div>

      <div className="border-b bg-gray-50 p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px_180px_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Пошук об’єкта
            </label>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Назва об’єкта"
              className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Від
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-white px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              До
            </label>

            <input
              type="date"
              value={endDate}
              min={
                startDate ||
                undefined
              }
              onChange={(event) =>
                setEndDate(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-white px-4 py-3"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="w-full rounded-lg border bg-white px-4 py-3 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
            >
              Скинути
            </button>
          </div>
        </div>

        {(startDate ||
          endDate) && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Показано дані{" "}
            {startDate
              ? `від ${startDate
                  .split("-")
                  .reverse()
                  .join(".")}`
              : "від початку"}{" "}
            {endDate
              ? `до ${endDate
                  .split("-")
                  .reverse()
                  .join(".")}`
              : "до сьогодні"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 border-b p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-gray-50 p-4">
          <p className="text-sm text-gray-500">
            Об’єктів
          </p>

          <p className="mt-2 text-2xl font-bold">
            {summaries.length}
          </p>
        </div>

        <div className="rounded-xl border bg-gray-50 p-4">
          <p className="text-sm text-gray-500">
            Робочих годин
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-700">
            {formatNumber(
              totals.hours
            )}{" "}
            год
          </p>
        </div>

        <div className="rounded-xl border bg-gray-50 p-4">
          <p className="text-sm text-gray-500">
            Позицій матеріалів
          </p>

          <p className="mt-2 text-2xl font-bold text-orange-600">
            {
              totals.materialPositions
            }
          </p>
        </div>

        <div className="rounded-xl border bg-gray-50 p-4">
          <p className="text-sm text-gray-500">
            Вартість матеріалів
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700">
            {formatMoney(
              totals.materialCost,
              currency
            )}
          </p>
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="p-8 text-center">
          <p className="font-medium text-gray-700">
            За вибраний період даних
            немає.
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Зміни період або скинь
            фільтри.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-4">
                  Об’єкт
                </th>

                <th className="p-4">
                  Робочі години
                </th>

                <th className="p-4">
                  Матеріалів
                </th>

                <th className="p-4">
                  Вартість матеріалів
                </th>

                <th className="p-4 text-right">
                  Дії
                </th>
              </tr>
            </thead>

            <tbody>
              {summaries.map(
                (summary) => (
                  <tr
                    key={
                      summary.objectId
                    }
                    className="border-t transition hover:bg-gray-50"
                  >
                    <td className="p-4">
                      <p className="font-semibold">
                        {
                          summary.objectName
                        }
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        ID:{" "}
                        {
                          summary.objectId
                        }
                      </p>
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-blue-700">
                        {formatNumber(
                          summary.hours
                        )}{" "}
                        год
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="font-medium">
                        {
                          summary.materialPositions
                        }{" "}
                        поз.
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-green-700">
                        {formatMoney(
                          summary.materialCost,
                          currency
                        )}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <Link
                        href={`/objects/${summary.objectId}`}
                        className="inline-flex rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                      >
                        Відкрити
                      </Link>
                    </td>
                  </tr>
                )
              )}
            </tbody>

            <tfoot className="border-t-2 bg-gray-50">
              <tr>
                <td className="p-4 font-bold">
                  Разом
                </td>

                <td className="p-4 font-bold text-blue-700">
                  {formatNumber(
                    totals.hours
                  )}{" "}
                  год
                </td>

                <td className="p-4 font-bold">
                  {
                    totals.materialPositions
                  }{" "}
                  поз.
                </td>

                <td className="p-4 font-bold text-green-700">
                  {formatMoney(
                    totals.materialCost,
                    currency
                  )}
                </td>

                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="border-t bg-gray-50 px-5 py-4">
        <p className="text-xs text-gray-500">
          Робочі години фільтруються за
          датою виконання роботи.
          Матеріали — за датою їх
          додавання до об’єкта.
        </p>
      </div>
    </section>
  );
}