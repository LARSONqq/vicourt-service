"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

function formatDateForInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getToday() {
  return formatDateForInput(new Date());
}

function getCurrentMonthStart() {
  const date = new Date();

  return formatDateForInput(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    )
  );
}

function getLastSevenDaysPeriod() {
  const endDate = new Date();
  const startDate = new Date();

  startDate.setDate(endDate.getDate() - 6);

  return {
    from: formatDateForInput(startDate),
    to: formatDateForInput(endDate),
  };
}

function getPreviousMonthPeriod() {
  const now = new Date();

  const firstDay = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  const lastDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    0
  );

  return {
    from: formatDateForInput(firstDay),
    to: formatDateForInput(lastDay),
  };
}

function formatHours(hours: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 1,
  }).format(hours);
}

function escapeCsvValue(value: string | number) {
  const text = String(value).replaceAll(
    '"',
    '""'
  );

  return `"${text}"`;
}

export default function EmployeeWorkReport({
  employees,
  workLogs,
}: Props) {
  const [dateFrom, setDateFrom] = useState(
    getCurrentMonthStart()
  );

  const [dateTo, setDateTo] = useState(
    getToday()
  );

  const [search, setSearch] = useState("");

  const [
    showOnlyWithHours,
    setShowOnlyWithHours,
  ] = useState(true);

  const invalidPeriod = Boolean(
    dateFrom &&
      dateTo &&
      dateFrom > dateTo
  );

  const filteredWorkLogs = useMemo(() => {
    if (invalidPeriod) {
      return [];
    }

    return workLogs.filter((workLog) => {
      const matchesStart =
        !dateFrom ||
        workLog.work_date >= dateFrom;

      const matchesEnd =
        !dateTo ||
        workLog.work_date <= dateTo;

      return matchesStart && matchesEnd;
    });
  }, [
    workLogs,
    dateFrom,
    dateTo,
    invalidPeriod,
  ]);

  const reportItems = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    const items: EmployeeReportItem[] =
      employees.map((employee) => {
        const employeeLogs =
          filteredWorkLogs.filter(
            (workLog) =>
              Number(
                workLog.employee_id
              ) === Number(employee.id)
          );

        const hours = employeeLogs.reduce(
          (sum, workLog) =>
            sum +
            Number(workLog.hours || 0),
          0
        );

        const objectMap = new Map<
          number,
          {
            id: number;
            name: string;
          }
        >();

        employeeLogs.forEach((workLog) => {
          if (workLog.object) {
            objectMap.set(
              workLog.object.id,
              workLog.object
            );
          }
        });

        return {
          employee,
          hours,
          records: employeeLogs.length,
          objects: Array.from(
            objectMap.values()
          ),
        };
      });

    return items
      .filter((item) => {
        const fullName = [
          item.employee.last_name,
          item.employee.first_name,
          item.employee.position,
        ]
          .filter(Boolean)
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
      })
      .sort(
        (firstItem, secondItem) => {
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
    employees,
    filteredWorkLogs,
    search,
    showOnlyWithHours,
  ]);

  const totalHours = reportItems.reduce(
    (sum, item) =>
      sum + item.hours,
    0
  );

  const totalRecords =
    reportItems.reduce(
      (sum, item) =>
        sum + item.records,
      0
    );

  const uniqueObjectsCount = new Set(
    filteredWorkLogs
      .map(
        (workLog) =>
          workLog.object?.id
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

    setDateFrom(period.from);
    setDateTo(period.to);
  }

  function selectCurrentMonth() {
    setDateFrom(
      getCurrentMonthStart()
    );

    setDateTo(getToday());
  }

  function selectPreviousMonth() {
    const period =
      getPreviousMonthPeriod();

    setDateFrom(period.from);
    setDateTo(period.to);
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

    const rows = reportItems.map(
      (item) => [
        `${item.employee.last_name} ${item.employee.first_name}`,
        item.employee.position || "",
        item.hours,
        item.records,
        item.objects.length,
        item.objects
          .map(
            (object) =>
              object.name
          )
          .join(", "),
        dateFrom || "Увесь час",
        dateTo || "Увесь час",
      ]
    );

    const csv = [
      headers
        .map(escapeCsvValue)
        .join(";"),

      ...rows.map((row) =>
        row
          .map(escapeCsvValue)
          .join(";")
      ),
    ].join("\n");

    const blob = new Blob(
      [`\uFEFF${csv}`],
      {
        type: "text/csv;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "vicourt-employee-report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5 rounded-xl border bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Звіт по працівниках
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Відпрацьовані години та роботи
            за вибраний період
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          disabled={
            reportItems.length === 0 ||
            invalidPeriod
          }
          className="w-fit rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Експорт звіту CSV
        </button>
      </div>

      <div className="rounded-xl bg-gray-50 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_190px_190px]">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Пошук працівника"
            className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-green-600"
          />

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Від дати
            </label>

            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-white px-3 py-3"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              До дати
            </label>

            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-white px-3 py-3"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={
              selectLastSevenDays
            }
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:border-green-300 hover:bg-green-50"
          >
            Останні 7 днів
          </button>

          <button
            type="button"
            onClick={
              selectCurrentMonth
            }
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:border-green-300 hover:bg-green-50"
          >
            Цей місяць
          </button>

          <button
            type="button"
            onClick={
              selectPreviousMonth
            }
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:border-green-300 hover:bg-green-50"
          >
            Попередній місяць
          </button>

          <button
            type="button"
            onClick={selectAllTime}
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:border-green-300 hover:bg-green-50"
          >
            Увесь час
          </button>

          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={
                showOnlyWithHours
              }
              onChange={(event) =>
                setShowOnlyWithHours(
                  event.target.checked
                )
              }
              className="h-4 w-4"
            />

            Лише з записами
          </label>
        </div>
      </div>

      {invalidPeriod && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Початкова дата не може бути
          пізнішою за кінцеву.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">
            Працівників
          </p>

          <p className="mt-1 text-2xl font-bold">
            {reportItems.length}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">
            Усього годин
          </p>

          <p className="mt-1 text-2xl font-bold text-green-700">
            {formatHours(totalHours)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">
            Записів
          </p>

          <p className="mt-1 text-2xl font-bold">
            {totalRecords}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">
            Об’єктів
          </p>

          <p className="mt-1 text-2xl font-bold">
            {uniqueObjectsCount}
          </p>
        </div>
      </div>

      {unassignedLogs.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          За цей період є записів без
          призначеного працівника:{" "}
          <strong>
            {unassignedLogs.length}
          </strong>
        </div>
      )}

      {invalidPeriod ? null :
      reportItems.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-gray-500">
          За вибраний період даних немає.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {reportItems.map((item) => (
            <article
              key={item.employee.id}
              className="rounded-xl border p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/employees/${item.employee.id}`}
                    className="block truncate font-semibold hover:text-green-700 hover:underline"
                  >
                    {
                      item.employee
                        .last_name
                    }{" "}
                    {
                      item.employee
                        .first_name
                    }
                  </Link>

                  <p className="mt-1 text-sm text-gray-500">
                    {item.employee
                      .position ||
                      "Посаду не вказано"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
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

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    Записів
                  </p>

                  <p className="mt-1 font-semibold">
                    {item.records}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    Об’єктів
                  </p>

                  <p className="mt-1 font-semibold">
                    {item.objects.length}
                  </p>
                </div>
              </div>

              {item.objects.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                    Робота на об’єктах
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {item.objects.map(
                      (object) => (
                        <Link
                          key={object.id}
                          href={`/objects/${object.id}`}
                          className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          {object.name}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}