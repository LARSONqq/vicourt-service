import Link from "next/link";

import type {
  ReportsData,
} from "@/types/report";

type Props = {
  data: ReportsData;
};

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatNumber(
  value: number,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatPercent(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "percent",
      maximumFractionDigits: 1,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatOptionalMoney(
  value: number | null
) {
  return value === null
    ? "Не вказано"
    : formatMoney(value);
}

function formatMargin(
  value: number | null,
  clientPrice: number | null
) {
  return value === null
    ? clientPrice === 0
      ? "Не розраховується"
      : "Не вказано"
    : formatPercent(
        value / 100
      );
}

function formatDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
    .split("-");

  return year && month && day
    ? day +
        "." +
        month +
        "." +
        year
    : "Невідома дата";
}

function formatDateTime(
  value: string
) {
  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Невідома дата";
  }

  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone:
        "Europe/Kyiv",
    }
  )
    .format(parsed)
    .replace(",", "");
}

function EmptyState({
  children,
}: {
  children: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-500 sm:p-8 sm:text-base">
      {children}
    </div>
  );
}

export default function ReportsDashboard({
  data,
}: Props) {
  const kpiCards = [
    {
      label:
        "Витрати на матеріали",
      value:
        formatMoney(
          data.kpis
            .materialsCost
        ),
      note:
        "Кількість × зафіксована ціна",
      style:
        "bg-amber-50 text-amber-700",
    },
    {
      label:
        "Витрати на роботи",
      value:
        formatMoney(
          data.kpis.laborCost
        ),
      note:
        "Години × зафіксована ставка",
      style:
        "bg-blue-50 text-blue-700",
    },
    {
      label:
        "Інші витрати",
      value:
        formatMoney(
          data.kpis
            .otherExpensesCost
        ),
      note:
        "Витрати об’єктів за категоріями",
      style:
        "bg-orange-50 text-orange-700",
    },
    {
      label:
        "Загальні витрати об’єктів",
      value:
        formatMoney(
          data.kpis
            .totalObjectCost
        ),
      note:
        "Без закупівель складу",
      style:
        "bg-green-600 text-white",
    },
    {
      label:
        "Відпрацьовано годин",
      value:
        formatNumber(
          data.kpis.totalHours
        ) + " год",
      note:
        "За датою виконання робіт",
      style:
        "bg-violet-50 text-violet-700",
    },
    {
      label:
        "Закупівлі складу",
      value:
        formatMoney(
          data.kpis
            .purchasedCost
        ),
      note:
        "Лише фактично оприбутковані",
      style:
        "bg-cyan-50 text-cyan-700",
    },
  ];

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      {data.invalidPeriod && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700 sm:px-5">
          Дата «від» не може бути
          пізнішою за дату «до».
          Зміни період і застосуй
          фільтри повторно.
        </div>
      )}

      <section className="min-w-0">
        <div className="mb-3 sm:mb-4">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Ключові показники
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            За період{" "}
            {formatDate(
              data.filters.dateFrom
            )}
            {" — "}
            {formatDate(
              data.filters.dateTo
            )}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kpiCards.map(
            (card) => (
              <article
                key={card.label}
                className={
                  "min-w-0 rounded-xl border p-4 sm:p-5 " +
                  card.style
                }
              >
                <p className="text-xs font-medium uppercase tracking-wide opacity-75">
                  {card.label}
                </p>

                <p className="mt-2 break-words text-xl font-bold sm:text-2xl">
                  {card.value}
                </p>

                <p className="mt-2 text-xs leading-5 opacity-75">
                  {card.note}
                </p>
              </article>
            )
          )}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Витрати по об’єктах
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Витрати та години — за
            вибраний період. План,
            фактична собівартість і
            результат — за всю історію
            об’єкта.
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-500">
            Поточний прибуток — це
            управлінський розрахунок
            від поточної собівартості,
            а не касовий прибуток.
          </p>
        </div>

        {data.objectCosts.length ===
        0 ? (
          <div className="p-3 sm:p-5">
            <EmptyState>
              За вибраними фільтрами витрат по об’єктах немає.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {data.objectCosts.map(
                (object) => (
                  <article
                    key={
                      object.objectId
                    }
                    className="min-w-0 rounded-xl border p-4"
                  >
                    <Link
                      href={
                        "/objects/" +
                        object.objectId
                      }
                      className="block break-words font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                    >
                      {
                        object.objectName
                      }
                    </Link>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-amber-50 p-3">
                        <p className="text-xs text-amber-700/70">
                          Матеріали
                        </p>
                        <p className="mt-1 break-words font-semibold text-amber-700">
                          {formatMoney(
                            object.materialsCost
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs text-blue-700/70">
                          Роботи
                        </p>
                        <p className="mt-1 break-words font-semibold text-blue-700">
                          {formatMoney(
                            object.laborCost
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-orange-50 p-3">
                        <p className="text-xs text-orange-700/70">
                          Інші витрати
                        </p>
                        <p className="mt-1 break-words font-semibold text-orange-700">
                          {formatMoney(
                            object.otherExpensesCost
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Години
                        </p>
                        <p className="mt-1 font-semibold text-gray-900">
                          {formatNumber(
                            object.hours
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-green-600 p-3 text-white">
                      <span className="text-xs uppercase tracking-wide text-green-100">
                        Витрати за
                        період
                      </span>
                      <strong className="break-words text-right">
                        {formatMoney(
                          object.totalCost
                        )}
                      </strong>
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Фінанси об’єкта
                        за весь час
                      </p>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                        <div>
                          <dt className="text-xs text-gray-500">
                            Плановий бюджет
                          </dt>
                          <dd className="mt-1 break-words font-semibold text-blue-700">
                            {formatOptionalMoney(
                              object.costBudget
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs text-gray-500">
                            Вартість для
                            клієнта
                          </dt>
                          <dd className="mt-1 break-words font-semibold text-blue-700">
                            {formatOptionalMoney(
                              object.clientPrice
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs text-gray-500">
                            Фактичні витрати
                          </dt>
                          <dd className="mt-1 break-words font-semibold text-gray-900">
                            {formatMoney(
                              object.lifetimeActualCost
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs text-gray-500">
                            {object.budgetOverrun !==
                            null
                              ? "Перевитрата"
                              : "Залишок бюджету"}
                          </dt>
                          <dd
                            className={`mt-1 break-words font-semibold ${
                              object.budgetOverrun !==
                              null
                                ? "text-red-700"
                                : "text-gray-900"
                            }`}
                          >
                            {object.costBudget ===
                            null
                              ? "Не вказано"
                              : formatMoney(
                                  object.budgetOverrun ??
                                    object.budgetRemaining ??
                                    0
                                )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs text-gray-500">
                            Поточний прибуток
                          </dt>
                          <dd
                            className={`mt-1 break-words font-semibold ${
                              object.financialResult ===
                              null
                                ? "text-gray-900"
                                : object.financialResult >=
                                    0
                                  ? "text-green-700"
                                  : "text-red-700"
                            }`}
                          >
                            {formatOptionalMoney(
                              object.financialResult
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs text-gray-500">
                            Маржинальність
                          </dt>
                          <dd className="mt-1 font-semibold text-gray-900">
                            {formatMargin(
                              object.marginPercent,
                              object.clientPrice
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                )
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1280px] text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="p-4 font-medium">
                      Об’єкт
                    </th>
                    <th className="p-4 font-medium">
                      За вибраний період
                    </th>
                    <th className="p-4 font-medium">
                      Витрати за період
                    </th>
                    <th className="p-4 font-medium">
                      План
                    </th>
                    <th className="p-4 font-medium">
                      Фактичні витрати
                    </th>
                    <th className="p-4 font-medium">
                      Бюджет
                    </th>
                    <th className="p-4 font-medium">
                      Результат
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.objectCosts.map(
                    (object) => (
                      <tr
                        key={
                          object.objectId
                        }
                        className="border-t transition hover:bg-gray-50"
                      >
                        <td className="p-4">
                          <Link
                            href={
                              "/objects/" +
                              object.objectId
                            }
                            className="font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                          >
                            {
                              object.objectName
                            }
                          </Link>
                        </td>
                        <td className="p-4">
                          <dl className="space-y-1.5 text-xs">
                            <div className="flex justify-between gap-3">
                              <dt className="text-gray-500">
                                Матеріали
                              </dt>
                              <dd className="font-medium text-amber-700">
                                {formatMoney(
                                  object.materialsCost
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-gray-500">
                                Роботи
                              </dt>
                              <dd className="font-medium text-blue-700">
                                {formatMoney(
                                  object.laborCost
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-gray-500">
                                Інші витрати
                              </dt>
                              <dd className="font-medium text-orange-700">
                                {formatMoney(
                                  object.otherExpensesCost
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-gray-500">
                                Години
                              </dt>
                              <dd className="font-medium text-gray-700">
                                {formatNumber(
                                  object.hours
                                )}
                              </dd>
                            </div>
                          </dl>
                        </td>
                        <td className="p-4 font-semibold text-green-700">
                          {formatMoney(
                            object.totalCost
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-xs text-gray-500">
                            Плановий бюджет
                          </p>
                          <p className="font-medium text-blue-700">
                            {formatOptionalMoney(
                              object.costBudget
                            )}
                          </p>
                          <p className="mt-2 text-xs text-gray-500">
                            Для клієнта
                          </p>
                          <p className="mt-0.5 font-medium text-blue-700">
                            {formatOptionalMoney(
                              object.clientPrice
                            )}
                          </p>
                        </td>
                        <td className="p-4 font-semibold text-gray-900">
                          {formatMoney(
                            object.lifetimeActualCost
                          )}
                          <p className="mt-1 text-xs font-normal text-gray-500">
                            За весь час
                          </p>
                        </td>
                        <td className="p-4">
                          <p
                            className={`font-semibold ${
                              object.budgetOverrun !==
                              null
                                ? "text-red-700"
                                : "text-gray-900"
                            }`}
                          >
                            {object.costBudget ===
                            null
                              ? "Не вказано"
                              : formatMoney(
                                  object.budgetOverrun ??
                                    object.budgetRemaining ??
                                    0
                                )}
                          </p>
                          {object.costBudget !==
                            null && (
                            <p className="mt-1 text-xs text-gray-500">
                              {object.budgetOverrun !==
                              null
                                ? "Перевитрата"
                                : "Залишок"}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <p
                            className={`font-semibold ${
                              object.financialResult ===
                              null
                                ? "text-gray-900"
                                : object.financialResult >=
                                    0
                                  ? "text-green-700"
                                  : "text-red-700"
                            }`}
                          >
                            {formatOptionalMoney(
                              object.financialResult
                            )}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Поточний прибуток
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Маржа:
                            {" "}
                            {formatMargin(
                              object.marginPercent,
                              object.clientPrice
                            )}
                          </p>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Робота працівників
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Розрахунок за записами
            журналу робіт із
            зафіксованою на момент
            роботи ставкою.
          </p>
        </div>

        {data.employeeWork.length ===
        0 ? (
          <div className="p-3 sm:p-5">
            <EmptyState>
              За вибраний період записів журналу робіт немає.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {data.employeeWork.map(
                (employee) => (
                  <article
                    key={
                      employee.employeeId ||
                      "unassigned"
                    }
                    className="rounded-xl border p-4"
                  >
                    <p className="break-words font-semibold text-gray-900">
                      {
                        employee.employeeName
                      }
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Записів
                        </p>
                        <p className="mt-1 font-semibold">
                          {
                            employee.recordsCount
                          }
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Об’єктів
                        </p>
                        <p className="mt-1 font-semibold">
                          {
                            employee.objectsCount
                          }
                        </p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs text-blue-700/70">
                          Години
                        </p>
                        <p className="mt-1 font-semibold text-blue-700">
                          {formatNumber(
                            employee.hours
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3">
                        <p className="text-xs text-green-700/70">
                          Вартість
                        </p>
                        <p className="mt-1 break-words font-semibold text-green-700">
                          {formatMoney(
                            employee.laborCost
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="p-4 font-medium">
                      Працівник
                    </th>
                    <th className="p-4 font-medium">
                      Записів
                    </th>
                    <th className="p-4 font-medium">
                      Години
                    </th>
                    <th className="p-4 font-medium">
                      Вартість робіт
                    </th>
                    <th className="p-4 font-medium">
                      Об’єктів
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.employeeWork.map(
                    (employee) => (
                      <tr
                        key={
                          employee.employeeId ||
                          "unassigned"
                        }
                        className="border-t"
                      >
                        <td className="p-4 font-semibold text-gray-900">
                          {
                            employee.employeeName
                          }
                        </td>
                        <td className="p-4">
                          {
                            employee.recordsCount
                          }
                        </td>
                        <td className="p-4 font-medium text-blue-700">
                          {formatNumber(
                            employee.hours
                          )}
                        </td>
                        <td className="p-4 font-semibold text-green-700">
                          {formatMoney(
                            employee.laborCost
                          )}
                        </td>
                        <td className="p-4">
                          {
                            employee.objectsCount
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Інші витрати
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Розподіл за категоріями
          </p>

          <div className="mt-5 space-y-4">
            {data.expenseCategories.map(
              (category) => (
                <div
                  key={
                    category.category
                  }
                  className="min-w-0"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-gray-800">
                        {
                          category.category
                        }
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {
                          category.recordsCount
                        }{" "}
                        записів ·{" "}
                        {formatPercent(
                          category.share
                        )}
                      </p>
                    </div>

                    <strong className="shrink-0 text-right text-orange-700">
                      {formatMoney(
                        category.amount
                      )}
                    </strong>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-orange-400"
                      style={{
                        width:
                          String(
                            Math.min(
                              category.share *
                                100,
                              100
                            )
                          ) + "%",
                      }}
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Найбільші витрати
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              До п’яти найбільших
              записів за вибраний
              період
            </p>
          </div>

          {data.expenseHighlights
            .length === 0 ? (
            <div className="p-5 text-sm text-gray-500">
              Інших витрат за період
              немає.
            </div>
          ) : (
            <div className="divide-y">
              {data.expenseHighlights.map(
                (expense) => (
                  <article
                    key={expense.id}
                    className="min-w-0 p-4 sm:p-5"
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-gray-900">
                          {
                            expense.description
                          }
                        </p>
                        <p className="mt-1 break-words text-xs leading-5 text-gray-500">
                          {
                            expense.category
                          }{" "}
                          ·{" "}
                          {formatDate(
                            expense.expenseDate
                          )}
                          {" · "}
                          <Link
                            href={
                              "/objects/" +
                              expense.objectId
                            }
                            className="text-green-700 hover:underline"
                          >
                            {
                              expense.objectName
                            }
                          </Link>
                        </p>
                      </div>

                      <strong className="shrink-0 text-orange-700">
                        {formatMoney(
                          expense.amount
                        )}
                      </strong>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Закупівлі складу
            </h2>

            <p className="mt-1 text-sm leading-5 text-gray-500">
              Окремий фінансовий
              показник, який не входить
              у собівартість об’єктів.
            </p>
          </div>

          <Link
            href="/purchases"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            Відкрити закупівлі →
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-yellow-50 p-4">
            <p className="text-xs uppercase tracking-wide text-yellow-700/70">
              Заплановано
            </p>
            <p className="mt-2 text-2xl font-bold text-yellow-700">
              {
                data.purchases
                  .plannedCount
              }
            </p>
          </div>

          <div className="rounded-xl bg-yellow-50 p-4">
            <p className="text-xs uppercase tracking-wide text-yellow-700/70">
              Планова сума
            </p>
            <p className="mt-2 break-words text-xl font-bold text-yellow-700">
              {formatMoney(
                data.purchases
                  .plannedAmount
              )}
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-xs uppercase tracking-wide text-green-700/70">
              Закуплено
            </p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {
                data.purchases
                  .purchasedCount
              }
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-xs uppercase tracking-wide text-green-700/70">
              Фактична сума
            </p>
            <p className="mt-2 break-words text-xl font-bold text-green-700">
              {formatMoney(
                data.purchases
                  .purchasedAmount
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="flex min-w-0 flex-col gap-2 border-b p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Склад
            </h2>

            <p className="mt-1 text-sm leading-5 text-gray-500">
              Коротка аналітика рухів
              за період і поточний стан
              залишків.
            </p>
          </div>

          <Link
            href="/warehouse"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            Відкрити склад →
          </Link>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 border-b p-3 sm:p-5 xl:grid-cols-4">
          <div className="rounded-xl bg-green-50 p-3 sm:p-4">
            <p className="text-xs text-green-700/70">
              Приходів
            </p>
            <p className="mt-1 text-xl font-bold text-green-700 sm:text-2xl">
              {
                data.warehouse
                  .incomeCount
              }
            </p>
            <p className="mt-1 break-words text-xs text-green-700/70">
              {formatMoney(
                data.warehouse
                  .incomeValue
              )}
            </p>
          </div>

          <div className="rounded-xl bg-orange-50 p-3 sm:p-4">
            <p className="text-xs text-orange-700/70">
              Списань
            </p>
            <p className="mt-1 text-xl font-bold text-orange-700 sm:text-2xl">
              {
                data.warehouse
                  .writeOffCount
              }
            </p>
            <p className="mt-1 break-words text-xs text-orange-700/70">
              {formatMoney(
                data.warehouse
                  .writeOffValue
              )}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-3 sm:p-4">
            <p className="text-xs text-gray-500">
              Поточних позицій
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
              {
                data.warehouse
                  .currentItemsCount
              }
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Низький залишок:{" "}
              {
                data.warehouse
                  .currentLowStockCount
              }
            </p>
          </div>

          <div className="rounded-xl bg-cyan-50 p-3 sm:p-4">
            <p className="text-xs text-cyan-700/70">
              Вартість залишків зараз
            </p>
            <p className="mt-1 break-words text-lg font-bold text-cyan-700 sm:text-xl">
              {formatMoney(
                data.warehouse
                  .currentStockValue
              )}
            </p>
            <p className="mt-1 text-xs leading-4 text-cyan-700/70">
              Не залежить від періоду
            </p>
          </div>
        </div>

        {data.warehouse
          .recentMovements.length >
        0 && (
          <div>
            <div className="border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-400 sm:px-5">
              Останні рухи у вибірці
            </div>

            <div className="divide-y">
              {data.warehouse.recentMovements.map(
                (movement) => (
                  <article
                    key={movement.id}
                    className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-gray-900">
                        {
                          movement.itemName
                        }
                      </p>
                      <p className="mt-1 break-words text-xs leading-5 text-gray-500">
                        {formatDateTime(
                          movement.createdAt
                        )}
                        {movement.objectName
                          ? " · " +
                            movement.objectName
                          : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p
                        className={
                          "font-semibold " +
                          (
                            movement.movementType ===
                            "Прихід"
                              ? "text-green-700"
                              : "text-orange-700"
                          )
                        }
                      >
                        {movement.movementType ===
                        "Прихід"
                          ? "+"
                          : "−"}
                        {formatNumber(
                          movement.quantity,
                          3
                        )}{" "}
                        {movement.unit}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatMoney(
                          movement.totalValue
                        )}
                      </p>
                    </div>
                  </article>
                )
              )}
            </div>
          </div>
        )}
      </section>

      <p className="text-xs leading-5 text-gray-500 sm:text-sm">
        Дані розраховані за вибраний
        період. Для матеріалів період
        визначається за датою їх
        додавання до об’єкта.
      </p>
    </div>
  );
}
