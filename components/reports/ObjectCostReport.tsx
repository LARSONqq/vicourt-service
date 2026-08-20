"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import type {
  ReportMaterial,
  ReportWorkLog,
} from "@/services/reportService";

import type { AppCurrency } from "@/types/appSettings";

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

  const [
    wholePart,
    decimalPart,
  ] = absoluteValue
    .toFixed(2)
    .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${
    negative ? "−" : ""
  }${formattedWhole},${decimalPart} ${
    symbols[currency] ||
    currency
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
  return value.slice(
    0,
    10
  );
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
    Array.isArray(
      workLogs
    )
      ? workLogs
      : [];

  const safeMaterials =
    Array.isArray(
      materials
    )
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
      const map =
        new Map<
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
          map.get(
            objectId
          ) ?? {
            objectId,

            objectName:
              workLog.object
                ?.name ||
              `Об’єкт #${objectId}`,

            hours: 0,

            materialPositions:
              0,

            materialQuantity:
              0,

            materialCost:
              0,
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
          map.get(
            objectId
          ) ?? {
            objectId,

            objectName:
              material.object
                ?.name ||
              `Об’єкт #${objectId}`,

            hours: 0,

            materialPositions:
              0,

            materialQuantity:
              0,

            materialCost:
              0,
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
          materialPositions:
            0,
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
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      {/* HEADER */}
      <div className="border-b p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Витрати по об’єктах
            </h2>

            <p className="mt-1 text-sm leading-5 text-gray-500">
              Робочі години та
              собівартість
              використаних
              матеріалів за вибраний
              період
            </p>
          </div>

          <Link
            href="/objects"
            className="flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 sm:w-fit sm:border-0 sm:bg-transparent sm:p-0 sm:hover:bg-transparent sm:hover:underline"
          >
            Усі об’єкти →
          </Link>
        </div>
      </div>

      {/* FILTERS */}
      <div className="min-w-0 border-b bg-gray-50 p-3 sm:p-5">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Пошук об’єкта
            </label>

            <input
              type="search"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Назва об’єкта"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Від
            </label>

            <input
              type="date"
              value={
                startDate
              }
              onChange={(
                event
              ) =>
                setStartDate(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              До
            </label>

            <input
              type="date"
              value={
                endDate
              }
              min={
                startDate ||
                undefined
              }
              onChange={(
                event
              ) =>
                setEndDate(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            />
          </div>

          <div className="flex min-w-0 items-end sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={
                resetFilters
              }
              disabled={
                !hasFilters
              }
              className="min-h-11 w-full rounded-lg border bg-white px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
            >
              Скинути
            </button>
          </div>
        </div>

        {(startDate ||
          endDate) && (
          <div className="mt-4 break-words rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm leading-5 text-blue-700 sm:px-4">
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

      {/* STATS */}
      <div className="grid min-w-0 grid-cols-2 gap-3 border-b p-3 sm:gap-4 sm:p-5 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-gray-50 p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Об’єктів
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {
              summaries.length
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-gray-50 p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Робочих годин
          </p>

          <p className="mt-2 break-words text-xl font-bold text-blue-700 sm:text-2xl">
            {formatNumber(
              totals.hours
            )}{" "}
            год
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-gray-50 p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Позицій матеріалів
          </p>

          <p className="mt-2 text-2xl font-bold text-orange-600">
            {
              totals.materialPositions
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-gray-50 p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Вартість матеріалів
          </p>

          <p className="mt-2 break-words text-xl font-bold text-green-700 sm:text-2xl">
            {formatMoney(
              totals.materialCost,
              currency
            )}
          </p>
        </div>
      </div>

      {/* EMPTY */}
      {summaries.length ===
      0 ? (
        <div className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            📊
          </div>

          <p className="mt-3 font-medium text-gray-700">
            За вибраний період
            даних немає
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Зміни період або скинь
            фільтри.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="space-y-3 p-3 md:hidden">
            {summaries.map(
              (summary) => (
                <article
                  key={
                    summary.objectId
                  }
                  className="min-w-0 rounded-xl border bg-white p-4"
                >
                  {/* OBJECT */}
                  <div className="min-w-0">
                    <Link
                      href={`/objects/${summary.objectId}`}
                      className="block break-words font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                    >
                      {
                        summary.objectName
                      }
                    </Link>

                    <p className="mt-1 text-xs text-gray-400">
                      ID:{" "}
                      {
                        summary.objectId
                      }
                    </p>
                  </div>

                  {/* HOURS + MATERIALS */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="min-w-0 rounded-lg bg-blue-50 p-3">
                      <p className="text-xs text-gray-500">
                        Робочі години
                      </p>

                      <p className="mt-1 break-words font-semibold text-blue-700">
                        {formatNumber(
                          summary.hours
                        )}{" "}
                        год
                      </p>
                    </div>

                    <div className="min-w-0 rounded-lg bg-orange-50 p-3">
                      <p className="text-xs text-gray-500">
                        Матеріалів
                      </p>

                      <p className="mt-1 font-semibold text-orange-700">
                        {
                          summary.materialPositions
                        }{" "}
                        поз.
                      </p>
                    </div>
                  </div>

                  {/* COST */}
                  <div className="mt-3 min-w-0 rounded-lg bg-green-50 p-3">
                    <p className="text-xs text-gray-500">
                      Вартість
                      матеріалів
                    </p>

                    <p className="mt-1 break-words text-lg font-semibold text-green-700">
                      {formatMoney(
                        summary.materialCost,
                        currency
                      )}
                    </p>
                  </div>

                  {/* OPEN */}
                  <div className="mt-4 border-t pt-4">
                    <Link
                      href={`/objects/${summary.objectId}`}
                      className="flex min-h-10 w-full items-center justify-center rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                    >
                      Відкрити об’єкт
                    </Link>
                  </div>
                </article>
              )
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
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
                  (
                    summary
                  ) => (
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
                          className="inline-flex rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
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
        </>
      )}

      {/* FOOTNOTE */}
      <div className="border-t bg-gray-50 px-4 py-4 sm:px-5">
        <p className="text-xs leading-5 text-gray-500">
          Робочі години
          фільтруються за датою
          виконання роботи.
          Матеріали — за датою їх
          додавання до об’єкта.
        </p>
      </div>
    </section>
  );
}