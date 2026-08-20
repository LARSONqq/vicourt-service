"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import type { ReportWorkLog } from "@/services/reportService";
import type { Employee } from "@/types/employee";

type Props = {
  employees: Employee[];
  workLogs: ReportWorkLog[];
};

type EmployeeReportItem = {
  employee: Employee;
  hours: number;
  records: number;
  objects: {
    id: number;
    name: string;
  }[];
};

function formatDateForInput(
  date: Date
) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function getToday() {
  return formatDateForInput(
    new Date()
  );
}

function getCurrentMonthStart() {
  const date =
    new Date();

  return formatDateForInput(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    )
  );
}

function getLastSevenDaysPeriod() {
  const endDate =
    new Date();

  const startDate =
    new Date();

  startDate.setDate(
    endDate.getDate() - 6
  );

  return {
    from:
      formatDateForInput(
        startDate
      ),

    to:
      formatDateForInput(
        endDate
      ),
  };
}

function getPreviousMonthPeriod() {
  const now =
    new Date();

  const firstDay =
    new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

  const lastDay =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      0
    );

  return {
    from:
      formatDateForInput(
        firstDay
      ),

    to:
      formatDateForInput(
        lastDay
      ),
  };
}

function formatHours(
  hours: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits:
        1,
    }
  ).format(hours);
}

function escapeCsvValue(
  value: string | number
) {
  const text =
    String(value).replaceAll(
      '"',
      '""'
    );

  return `"${text}"`;
}

export default function EmployeeWorkReport({
  employees,
  workLogs,
}: Props) {
  const safeEmployees =
    Array.isArray(
      employees
    )
      ? employees
      : [];

  const safeWorkLogs =
    Array.isArray(
      workLogs
    )
      ? workLogs
      : [];

  const [
    dateFrom,
    setDateFrom,
  ] = useState(
    getCurrentMonthStart()
  );

  const [
    dateTo,
    setDateTo,
  ] = useState(
    getToday()
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    showOnlyWithHours,
    setShowOnlyWithHours,
  ] = useState(true);

  const invalidPeriod =
    Boolean(
      dateFrom &&
        dateTo &&
        dateFrom >
          dateTo
    );

  const filteredWorkLogs =
    useMemo(() => {
      if (
        invalidPeriod
      ) {
        return [];
      }

      return safeWorkLogs.filter(
        (workLog) => {
          const matchesStart =
            !dateFrom ||
            workLog.work_date >=
              dateFrom;

          const matchesEnd =
            !dateTo ||
            workLog.work_date <=
              dateTo;

          return (
            matchesStart &&
            matchesEnd
          );
        }
      );
    }, [
      safeWorkLogs,
      dateFrom,
      dateTo,
      invalidPeriod,
    ]);

  const reportItems =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      const items:
        EmployeeReportItem[] =
        safeEmployees.map(
          (employee) => {
            const employeeLogs =
              filteredWorkLogs.filter(
                (workLog) =>
                  Number(
                    workLog.employee_id
                  ) ===
                  Number(
                    employee.id
                  )
              );

            const hours =
              employeeLogs.reduce(
                (
                  sum,
                  workLog
                ) =>
                  sum +
                  Number(
                    workLog.hours ||
                      0
                  ),
                0
              );

            const objectMap =
              new Map<
                number,
                {
                  id: number;
                  name: string;
                }
              >();

            employeeLogs.forEach(
              (workLog) => {
                if (
                  workLog.object
                ) {
                  objectMap.set(
                    workLog
                      .object
                      .id,
                    workLog.object
                  );
                }
              }
            );

            return {
              employee,
              hours,
              records:
                employeeLogs.length,
              objects:
                Array.from(
                  objectMap.values()
                ),
            };
          }
        );

      return items
        .filter(
          (item) => {
            const fullName =
              [
                item.employee
                  .last_name,
                item.employee
                  .first_name,
                item.employee
                  .position,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .toLowerCase();

            const matchesSearch =
              !normalizedSearch ||
              fullName.includes(
                normalizedSearch
              );

            const matchesHours =
              !showOnlyWithHours ||
              item.records > 0;

            return (
              matchesSearch &&
              matchesHours
            );
          }
        )
        .sort(
          (
            firstItem,
            secondItem
          ) => {
            if (
              secondItem.hours !==
              firstItem.hours
            ) {
              return (
                secondItem.hours -
                firstItem.hours
              );
            }

            return `${firstItem.employee.last_name} ${firstItem.employee.first_name}`.localeCompare(
              `${secondItem.employee.last_name} ${secondItem.employee.first_name}`,
              "uk"
            );
          }
        );
    }, [
      safeEmployees,
      filteredWorkLogs,
      search,
      showOnlyWithHours,
    ]);

  const totalHours =
    reportItems.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.hours,
      0
    );

  const totalRecords =
    reportItems.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.records,
      0
    );

  const uniqueObjectsCount =
    new Set(
      filteredWorkLogs
        .map(
          (workLog) =>
            workLog.object
              ?.id
        )
        .filter(Boolean)
    ).size;

  const unassignedLogs =
    filteredWorkLogs.filter(
      (workLog) =>
        !workLog.employee_id
    );

  function selectLastSevenDays() {
    const period =
      getLastSevenDaysPeriod();

    setDateFrom(
      period.from
    );

    setDateTo(
      period.to
    );
  }

  function selectCurrentMonth() {
    setDateFrom(
      getCurrentMonthStart()
    );

    setDateTo(
      getToday()
    );
  }

  function selectPreviousMonth() {
    const period =
      getPreviousMonthPeriod();

    setDateFrom(
      period.from
    );

    setDateTo(
      period.to
    );
  }

  function selectAllTime() {
    setDateFrom("");
    setDateTo("");
  }

  function exportCsv() {
    const headers = [
      "Працівник",
      "Посада",
      "Відпрацьовано годин",
      "Записів у журналі",
      "Кількість об’єктів",
      "Об’єкти",
      "Початок періоду",
      "Кінець періоду",
    ];

    const rows =
      reportItems.map(
        (item) => [
          `${item.employee.last_name} ${item.employee.first_name}`,

          item.employee
            .position ||
            "",

          item.hours,

          item.records,

          item.objects.length,

          item.objects
            .map(
              (object) =>
                object.name
            )
            .join(", "),

          dateFrom ||
            "Увесь час",

          dateTo ||
            "Увесь час",
        ]
      );

    const csv = [
      headers
        .map(
          escapeCsvValue
        )
        .join(";"),

      ...rows.map(
        (row) =>
          row
            .map(
              escapeCsvValue
            )
            .join(";")
      ),
    ].join("\n");

    const blob =
      new Blob(
        [
          `\uFEFF${csv}`,
        ],
        {
          type: "text/csv;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      "vicourt-employee-report.csv";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }

  return (
    <section className="min-w-0 space-y-5 rounded-xl border bg-white p-4 sm:p-5">
      {/* HEADER */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Звіт по працівниках
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Відпрацьовані години та
            роботи за вибраний
            період
          </p>
        </div>

        <button
          type="button"
          onClick={
            exportCsv
          }
          disabled={
            reportItems.length ===
              0 ||
            invalidPeriod
          }
          className="min-h-11 w-full rounded-lg border border-green-600 px-4 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent sm:w-fit"
        >
          Експорт звіту CSV
        </button>
      </div>

      {/* FILTERS */}
      <div className="min-w-0 rounded-xl bg-gray-50 p-3 sm:p-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_190px]">
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <label className="mb-1 block text-xs text-gray-500 xl:hidden">
              Пошук
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
              placeholder="Пошук працівника"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs text-gray-500">
              Від дати
            </label>

            <input
              type="date"
              value={
                dateFrom
              }
              onChange={(
                event
              ) =>
                setDateFrom(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs text-gray-500">
              До дати
            </label>

            <input
              type="date"
              value={
                dateTo
              }
              onChange={(
                event
              ) =>
                setDateTo(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            />
          </div>
        </div>

        {/* PERIOD BUTTONS */}
        <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={
              selectLastSevenDays
            }
            className="min-h-10 rounded-lg border bg-white px-2 py-2 text-sm transition hover:border-green-300 hover:bg-green-50 sm:px-3"
          >
            Останні 7 днів
          </button>

          <button
            type="button"
            onClick={
              selectCurrentMonth
            }
            className="min-h-10 rounded-lg border bg-white px-2 py-2 text-sm transition hover:border-green-300 hover:bg-green-50 sm:px-3"
          >
            Цей місяць
          </button>

          <button
            type="button"
            onClick={
              selectPreviousMonth
            }
            className="min-h-10 rounded-lg border bg-white px-2 py-2 text-sm transition hover:border-green-300 hover:bg-green-50 sm:px-3"
          >
            Попередній місяць
          </button>

          <button
            type="button"
            onClick={
              selectAllTime
            }
            className="min-h-10 rounded-lg border bg-white px-2 py-2 text-sm transition hover:border-green-300 hover:bg-green-50 sm:px-3"
          >
            Увесь час
          </button>

          <label className="col-span-2 mt-1 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-600 sm:ml-auto sm:mt-0 sm:border-0 sm:bg-transparent sm:px-0">
            <input
              type="checkbox"
              checked={
                showOnlyWithHours
              }
              onChange={(
                event
              ) =>
                setShowOnlyWithHours(
                  event.target.checked
                )
              }
              className="h-4 w-4 shrink-0"
            />

            <span>
              Лише з записами
            </span>
          </label>
        </div>
      </div>

      {/* INVALID PERIOD */}
      {invalidPeriod && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700 sm:p-4">
          Початкова дата не може
          бути пізнішою за кінцеву.
        </div>
      )}

      {/* STATS */}
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Працівників
          </p>

          <p className="mt-1 text-2xl font-bold text-gray-900">
            {
              reportItems.length
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Усього годин
          </p>

          <p className="mt-1 break-words text-2xl font-bold text-green-700">
            {formatHours(
              totalHours
            )}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Записів
          </p>

          <p className="mt-1 text-2xl font-bold text-gray-900">
            {
              totalRecords
            }
          </p>
        </div>

        <div className="min-w-0 rounded-xl border p-3 sm:p-4">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Об’єктів
          </p>

          <p className="mt-1 text-2xl font-bold text-gray-900">
            {
              uniqueObjectsCount
            }
          </p>
        </div>
      </div>

      {/* UNASSIGNED */}
      {unassignedLogs.length >
        0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm leading-5 text-orange-700 sm:p-4">
          За цей період є записів
          без призначеного
          працівника:{" "}
          <strong>
            {
              unassignedLogs.length
            }
          </strong>
        </div>
      )}

      {/* REPORT */}
      {invalidPeriod ? null : reportItems.length ===
        0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500 sm:p-8 sm:text-base">
          За вибраний період даних
          немає.
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
          {reportItems.map(
            (item) => (
              <article
                key={
                  item.employee.id
                }
                className="min-w-0 rounded-xl border p-4 sm:p-5"
              >
                {/* EMPLOYEE */}
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/employees/${item.employee.id}`}
                      className="block break-words font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                    >
                      {
                        item
                          .employee
                          .last_name
                      }{" "}
                      {
                        item
                          .employee
                          .first_name
                      }
                    </Link>

                    <p className="mt-1 break-words text-sm text-gray-500">
                      {item
                        .employee
                        .position ||
                        "Посаду не вказано"}
                    </p>
                  </div>

                  <div className="w-fit shrink-0 rounded-lg bg-green-50 px-3 py-2 sm:bg-transparent sm:p-0 sm:text-right">
                    <p className="text-2xl font-bold text-green-700">
                      {formatHours(
                        item.hours
                      )}
                    </p>

                    <p className="text-xs text-gray-500">
                      годин
                    </p>
                  </div>
                </div>

                {/* COUNTS */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="min-w-0 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      Записів
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {
                        item.records
                      }
                    </p>
                  </div>

                  <div className="min-w-0 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      Об’єктів
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {
                        item.objects
                          .length
                      }
                    </p>
                  </div>
                </div>

                {/* OBJECTS */}
                {item.objects
                  .length > 0 && (
                  <div className="mt-4 min-w-0 border-t pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                      Робота на
                      об’єктах
                    </p>

                    <div className="flex min-w-0 flex-wrap gap-2">
                      {item.objects.map(
                        (
                          object
                        ) => (
                          <Link
                            key={
                              object.id
                            }
                            href={`/objects/${object.id}`}
                            className="max-w-full break-words rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100"
                          >
                            {
                              object.name
                            }
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}