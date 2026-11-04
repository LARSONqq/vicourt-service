import Link from "next/link";

import MaterialLedgerReport from "@/components/reports/MaterialLedgerReport";
import EquipmentCostReport from "@/components/reports/EquipmentCostReport";

import {
  objectPaymentStatusLabels,
} from "@/constants/objectPayments";
import {
  objectPaymentScheduleStatusLabels,
} from "@/constants/objectPaymentSchedule";

import type {
  ReportsData,
  ReportsSection,
} from "@/types/report";

type Props = {
  data: ReportsData;
  section: ReportsSection;
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

function clampPercent(
  value: number
) {
  return Math.max(
    0,
    Math.min(value, 100)
  );
}

function CostComposition({
  materials,
  labor,
  other,
  compact = false,
}: {
  materials: number;
  labor: number;
  other: number;
  compact?: boolean;
}) {
  const total =
    materials + labor + other;
  const parts = [
    {
      label: "Матеріали",
      value: materials,
      color: "vc-chart-materials",
    },
    {
      label: "Роботи",
      value: labor,
      color: "vc-chart-labor",
    },
    {
      label: "Інше",
      value: other,
      color: "vc-chart-other",
    },
  ];
  const canCompose =
    total > 0 &&
    parts.every(
      (part) => part.value >= 0
    );

  return (
    <div className="min-w-0">
      <div
        className={`${
          compact ? "h-1.5" : "h-2"
        } flex overflow-hidden rounded-full bg-muted`}
        aria-label="Склад витрат"
      >
        {canCompose &&
          parts.map((part) => (
            <span
              key={part.label}
              className={part.color}
              style={{
                width: `${clampPercent(
                  (part.value /
                    total) *
                    100
                )}%`,
              }}
              title={`${part.label}: ${formatMoney(
                part.value
              )}`}
            />
          ))}
      </div>

      {!compact && (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          {parts.map((part) => (
            <div
              key={part.label}
              className="min-w-0"
            >
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className={`size-2 shrink-0 rounded-sm ${part.color}`}
                />
                {part.label}
              </p>
              <p className="mt-0.5 break-words font-semibold text-foreground">
                {formatMoney(
                  part.value
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressMeter({
  value,
  total,
  tone,
  label,
}: {
  value: number;
  total: number | null;
  tone:
    | "success"
    | "warning"
    | "danger";
  label: string;
}) {
  if (
    total === null ||
    total <= 0
  ) {
    return null;
  }

  const percent =
    (value / total) * 100;
  const toneClass = {
    success: "vc-progress-success",
    warning: "vc-progress-warning",
    danger: "vc-progress-danger",
  }[tone];

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {formatPercent(
            percent / 100
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${toneClass}`}
          style={{
            width: `${clampPercent(
              percent
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

function getBudgetTone(
  actual: number,
  budget: number | null
) {
  if (
    budget === null ||
    budget <= 0
  ) {
    return "success" as const;
  }

  if (actual > budget) {
    return "danger" as const;
  }

  return actual / budget >= 0.9
    ? ("warning" as const)
    : ("success" as const);
}

function getBudgetLabel(
  actual: number,
  budget: number | null
) {
  if (
    budget === null ||
    budget <= 0
  ) {
    return "Використано бюджет";
  }

  if (actual > budget) {
    return "Перевищено бюджет";
  }

  return actual / budget >= 0.9
    ? "Бюджет майже вичерпано"
    : "Використано бюджет";
}

export default function ReportsDashboard({
  data,
  section,
}: Props) {
  const overviewCards = [
    {
      label: "Загальні витрати",
      value:
        formatMoney(
          data.kpis
            .totalObjectCost
        ),
      note:
        "Без закупівель складу",
      tone: "primary",
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
      tone: "neutral",
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
      tone: "neutral",
    },
    {
      label:
        "Отримано від клієнтів",
      value:
        formatMoney(
          data.kpis
            .paymentsReceived
        ),
      note:
        "За вибраний період",
      tone: "positive",
    },
    {
      label:
        "До отримання по об’єктах",
      value:
        formatMoney(
          data.kpis
            .outstandingReceivables
        ),
      note:
        data.kpis
          .objectsWithoutClientPrice >
        0
          ? `Поточний стан · без ціни: ${data.kpis.objectsWithoutClientPrice}`
          : "Поточний стан за встановленими цінами",
      tone: "neutral",
    },
    {
      label:
        "Прострочено за графіком",
      value: formatMoney(
        data.kpis
          .overdueScheduleAmount
      ),
      note:
        "Поточний стан, не дохід за період",
      tone:
        data.kpis
          .overdueScheduleAmount > 0
          ? "danger"
          : "neutral",
    },
  ];
  const employeeWorkByHours = [
    ...data.employeeWork,
  ].sort(
    (left, right) =>
      right.hours - left.hours ||
      left.employeeName.localeCompare(
        right.employeeName,
        "uk"
      )
  );
  const maximumEmployeeHours =
    employeeWorkByHours.reduce(
      (maximum, employee) =>
        Math.max(
          maximum,
          employee.hours
        ),
      0
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {data.invalidPeriod && (
        <div
          role="alert"
          className="vc-alert-danger rounded-lg px-3 py-2.5 text-sm leading-5"
        >
          Дата «від» не може бути
          пізнішою за дату «до».
          Зміни період і застосуй
          фільтри повторно.
        </div>
      )}

      {!data.invalidPeriod &&
        [
          "overview",
          "objects",
          "warehouse",
        ].includes(section) &&
        data.materialAccounting
          .limitation && (
          <div className="vc-alert-warning rounded-lg px-3 py-2.5 text-xs leading-5 sm:text-sm">
            <span className="font-semibold">
              Метод обліку матеріалів. {" "}
            </span>
            {
              data.materialAccounting
                .limitation
            }
          </div>
        )}

      {section === "overview" && (
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

        <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
          {overviewCards.map(
            (card) => (
              <article
                key={card.label}
                data-tone={card.tone}
                className="vc-kpi-card min-w-0 rounded-lg border p-3 sm:p-4"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>

                <p className="mt-1.5 break-words text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {card.value}
                </p>

                <p className="mt-1.5 text-xs leading-4 text-muted-foreground">
                  {card.note}
                </p>
              </article>
            )
          )}
        </div>

        <article className="vc-surface mt-3 min-w-0 p-4">
          <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Склад витрат
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Матеріали, роботи та інші витрати за вибраний період
              </p>
            </div>
            <strong className="break-words text-sm text-foreground sm:shrink-0 sm:text-right">
              {formatMoney(
                data.kpis
                  .totalObjectCost
              )}
            </strong>
          </div>
          <CostComposition
            materials={
              data.kpis
                .materialsCost
            }
            labor={
              data.kpis.laborCost
            }
            other={
              data.kpis
                .otherExpensesCost
            }
          />
        </article>
      </section>
      )}

      {section === "objects" && (
      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Витрати по об’єктах
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Витрати та години — за
            вибраний період. План,
            фактична собівартість і
            результат, а також оплата
            клієнта — за всю історію
            об’єкта.
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-500">
            Поточний прибуток — це
            управлінський розрахунок
            від поточної собівартості,
            а не касовий прибуток.
            {" "}
            {data.materialAccounting
              .lifetimeMethod ===
            "exact_ledger"
              ? "Матеріали за весь час рахуються як початковий знімок плюс подальші exact-рухи."
              : "Матеріали за весь час поки використовують поточний legacy-баланс."}
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

                      <div className="rounded-lg bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700/70">
                          Оплати за період
                        </p>
                        <p className="mt-1 break-words font-semibold text-emerald-700">
                          {formatMoney(
                            object.periodPaymentsReceived
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

                    <div className="mt-3 rounded-lg bg-muted/60 p-3">
                      <CostComposition
                        compact
                        materials={
                          object.materialsCost
                        }
                        labor={
                          object.laborCost
                        }
                        other={
                          object.otherExpensesCost
                        }
                      />
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Матеріали {formatMoney(object.materialsCost)} · роботи {formatMoney(object.laborCost)} · інше {formatMoney(object.otherExpensesCost)}
                      </p>
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
                          <ProgressMeter
                            value={
                              object.lifetimeActualCost
                            }
                            total={
                              object.costBudget
                            }
                            tone={getBudgetTone(
                              object.lifetimeActualCost,
                              object.costBudget
                            )}
                            label={getBudgetLabel(
                              object.lifetimeActualCost,
                              object.costBudget
                            )}
                          />
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
                          <dd className="mt-1 text-xs leading-5 text-gray-500">
                            Матеріали {formatMoney(object.lifetimeMaterialsCost)} · роботи {formatMoney(object.lifetimeLaborCost)} · інше {formatMoney(object.lifetimeOtherExpensesCost)}
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

                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Розрахунки з
                        клієнтом
                      </p>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                        <div>
                          <dt className="text-xs text-gray-500">
                            Отримано
                          </dt>
                          <dd className="mt-1 break-words font-semibold text-emerald-700">
                            {formatMoney(
                              object.lifetimePaid
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs text-gray-500">
                            {object.overpayment !==
                              null &&
                            object.overpayment >
                              0
                              ? "Переплата"
                              : "Залишилось"}
                          </dt>
                          <dd className="mt-1 break-words font-semibold text-gray-900">
                            {object.clientPrice ===
                            null
                              ? "Не вказано"
                              : formatMoney(
                                  object.overpayment !==
                                    null &&
                                  object.overpayment >
                                    0
                                    ? object.overpayment
                                    : object.remainingToPay ??
                                        0
                                )}
                          </dd>
                        </div>
                      </dl>

                      <ProgressMeter
                        value={
                          object.lifetimePaid
                        }
                        total={
                          object.clientPrice
                        }
                        tone="success"
                        label="Сплачено від вартості"
                      />

                      <p className="mt-3 text-xs font-medium text-gray-600">
                        {
                          objectPaymentStatusLabels[
                            object.paymentStatus
                          ]
                        }
                      </p>
                    </div>
                  </article>
                )
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1480px] text-sm">
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
                      Оплата клієнта
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
                                Оплати
                              </dt>
                              <dd className="font-medium text-emerald-700">
                                {formatMoney(
                                  object.periodPaymentsReceived
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
                          <div className="mt-2 w-44">
                            <CostComposition
                              compact
                              materials={
                                object.materialsCost
                              }
                              labor={
                                object.laborCost
                              }
                              other={
                                object.otherExpensesCost
                              }
                            />
                          </div>
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
                          <p className="mt-1 text-xs font-normal leading-5 text-gray-500">
                            Матеріали {formatMoney(object.lifetimeMaterialsCost)} · роботи {formatMoney(object.lifetimeLaborCost)} · інше {formatMoney(object.lifetimeOtherExpensesCost)}
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
                          <ProgressMeter
                            value={
                              object.lifetimeActualCost
                            }
                            total={
                              object.costBudget
                            }
                            tone={getBudgetTone(
                              object.lifetimeActualCost,
                              object.costBudget
                            )}
                            label={getBudgetLabel(
                              object.lifetimeActualCost,
                              object.costBudget
                            )}
                          />
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-emerald-700">
                            {formatMoney(
                              object.lifetimePaid
                            )}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Отримано за весь
                            час
                          </p>
                          <p className="mt-2 font-medium text-gray-900">
                            {object.clientPrice ===
                            null
                              ? "Ціна не задана"
                              : object.overpayment !==
                                    null &&
                                  object.overpayment >
                                    0
                                ? `Переплата: ${formatMoney(
                                    object.overpayment
                                  )}`
                                : `Залишилось: ${formatMoney(
                                    object.remainingToPay ??
                                      0
                                  )}`}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {
                              objectPaymentStatusLabels[
                                object.paymentStatus
                              ]
                            }
                          </p>
                          <ProgressMeter
                            value={
                              object.lifetimePaid
                            }
                            total={
                              object.clientPrice
                            }
                            tone="success"
                            label="Сплачено"
                          />
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
      )}

      {section === "workforce" && (
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

        {employeeWorkByHours.length ===
        0 ? (
          <div className="p-3 sm:p-5">
            <EmptyState>
              За вибраний період записів журналу робіт немає.
            </EmptyState>
          </div>
        ) : (
          <div className="divide-y">
            {employeeWorkByHours.map(
              (employee) => (
                <article
                  key={
                    employee.employeeId ||
                    "unassigned"
                  }
                  className="min-w-0 p-4 sm:px-5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-foreground">
                        {employee.employeeName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {employee.objectsCount} об’єктів · {employee.recordsCount} записів
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums text-foreground">
                        {formatNumber(
                          employee.hours
                        )} год
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatMoney(
                          employee.laborCost
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="vc-progress-success h-full rounded-full"
                      style={{
                        width:
                          maximumEmployeeHours >
                          0
                            ? `${clampPercent(
                                (employee.hours /
                                  maximumEmployeeHours) *
                                  100
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>
      )}

      {section === "equipment" && (
        <EquipmentCostReport data={data} />
      )}

      {section === "cashflow" && (
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
                        записів
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
      )}

      {section === "cashflow" &&
        data.expenseDetails.length >
          0 && (
        <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Деталізація інших витрат
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Усі записи за вибраними фільтрами
            </p>
          </div>
          <div className="divide-y">
            {data.expenseDetails.map(
              (expense) => (
                <article
                  key={expense.id}
                  className="flex min-w-0 flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium text-foreground">
                      {expense.description}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                      {formatDate(
                        expense.expenseDate
                      )} · {expense.category} · {expense.objectName}
                      {expense.createdBy
                        ? ` · ${expense.createdBy}`
                        : ""}
                    </p>
                    {expense.note && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {expense.note}
                      </p>
                    )}
                  </div>
                  <strong className="shrink-0 text-sm text-foreground">
                    {formatMoney(
                      expense.amount
                    )}
                  </strong>
                </article>
              )
            )}
          </div>
        </section>
      )}

      {section === "cashflow" && (
      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Платежі клієнтів
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Фактично отримані платежі
            за вибраний період. Це не
            змінює собівартість або
            поточний прибуток об’єкта.
          </p>
        </div>

        {data.paymentDetails.length ===
        0 ? (
          <div className="p-3 sm:p-5">
            <EmptyState>
              За вибраними фільтрами платежів клієнтів немає.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {data.paymentDetails.map(
                (payment) => (
                  <article
                    key={payment.id}
                    className="min-w-0 rounded-xl border p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={
                            "/objects/" +
                            payment.objectId
                          }
                          className="block break-words font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                        >
                          {payment.objectName}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(
                            payment.paymentDate
                          )}
                          {payment.paymentMethod
                            ? ` · ${payment.paymentMethod}`
                            : ""}
                        </p>
                      </div>

                      <strong className="shrink-0 break-words text-right text-emerald-700">
                        {formatMoney(
                          payment.amount
                        )}
                      </strong>
                    </div>

                    {payment.note && (
                      <p className="mt-3 whitespace-pre-wrap break-words border-t pt-3 text-sm text-gray-600">
                        {payment.note}
                      </p>
                    )}
                  </article>
                )
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="p-4 font-medium">
                      Дата
                    </th>
                    <th className="p-4 font-medium">
                      Об’єкт
                    </th>
                    <th className="p-4 font-medium">
                      Сума
                    </th>
                    <th className="p-4 font-medium">
                      Спосіб оплати
                    </th>
                    <th className="p-4 font-medium">
                      Примітка
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.paymentDetails.map(
                    (payment) => (
                      <tr
                        key={payment.id}
                        className="border-t align-top"
                      >
                        <td className="p-4 text-gray-700">
                          {formatDate(
                            payment.paymentDate
                          )}
                        </td>
                        <td className="p-4">
                          <Link
                            href={
                              "/objects/" +
                              payment.objectId
                            }
                            className="font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                          >
                            {payment.objectName}
                          </Link>
                        </td>
                        <td className="p-4 font-semibold text-emerald-700">
                          {formatMoney(
                            payment.amount
                          )}
                        </td>
                        <td className="p-4 text-gray-700">
                          {payment.paymentMethod ||
                            "Не вказано"}
                        </td>
                        <td className="max-w-sm whitespace-pre-wrap break-words p-4 text-gray-600">
                          {payment.note ||
                            "—"}
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
      )}

      {section === "cashflow" && (
      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Графік оплат
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            Планові етапи з датою платежу у вибраному періоді. Покриття розраховане з усієї історії фактичних надходжень.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b p-3 sm:p-5 xl:grid-cols-4">
          {[
            {
              label: "Заплановано",
              value:
                data.paymentScheduleSummary
                  .plannedAmount,
            },
            {
              label: "Покрито",
              value:
                data.paymentScheduleSummary
                  .paidAmount,
            },
            {
              label: "До сплати сьогодні",
              value:
                data.paymentScheduleSummary
                  .dueTodayAmount,
            },
            {
              label: "Прострочено",
              value:
                data.paymentScheduleSummary
                  .overdueAmount,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-xl bg-gray-50 p-3"
            >
              <p className="break-words text-xs text-gray-500">
                {item.label}
              </p>
              <p className="mt-1 break-words font-semibold text-gray-900">
                {formatMoney(item.value)}
              </p>
            </div>
          ))}
          <div className="col-span-2 xl:col-span-4">
            <ProgressMeter
              value={
                data.paymentScheduleSummary
                  .paidAmount
              }
              total={
                data.paymentScheduleSummary
                  .plannedAmount
              }
              tone="success"
              label="Покрито за графіком"
            />
          </div>
        </div>

        {data.paymentScheduleDetails.length === 0 ? (
          <div className="p-3 sm:p-5">
            <EmptyState>
              За вибраними фільтрами планових етапів оплати немає.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {data.paymentScheduleDetails.map((item) => (
                <article key={item.id} className="min-w-0 rounded-xl border p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900">{item.title}</p>
                      <Link href={`/objects/${item.objectId}#payment-schedule`} className="mt-1 block break-words text-xs text-green-700 hover:underline">
                        {item.objectName}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">{formatDate(item.dueDate)}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-y py-3 text-sm">
                    <div><dt className="text-xs text-gray-500">План</dt><dd className="mt-1 font-medium">{formatMoney(item.plannedAmount)}</dd></div>
                    <div><dt className="text-xs text-gray-500">Покрито</dt><dd className="mt-1 font-medium text-green-700">{formatMoney(item.paidAmount)}</dd></div>
                    <div><dt className="text-xs text-gray-500">Залишок</dt><dd className="mt-1 font-medium">{formatMoney(item.remainingAmount)}</dd></div>
                  </dl>
                  <p className="mt-3 text-sm font-medium text-gray-700">{objectPaymentScheduleStatusLabels[item.status]}</p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    {[
                      "Дата",
                      "Об’єкт",
                      "Етап",
                      "Планова сума",
                      "Покрито",
                      "Залишок",
                      "Статус",
                    ].map((label) => (
                      <th key={label} className="p-4 font-medium">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.paymentScheduleDetails.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="p-4 text-gray-700">{formatDate(item.dueDate)}</td>
                      <td className="p-4"><Link href={`/objects/${item.objectId}#payment-schedule`} className="font-semibold text-gray-900 hover:text-green-700 hover:underline">{item.objectName}</Link></td>
                      <td className="max-w-xs p-4"><p className="break-words font-medium">{item.title}</p>{item.note && <p className="mt-1 break-words text-xs text-gray-500">{item.note}</p>}</td>
                      <td className="p-4 font-medium">{formatMoney(item.plannedAmount)}</td>
                      <td className="p-4 font-medium text-green-700">{formatMoney(item.paidAmount)}</td>
                      <td className="p-4 font-medium">{formatMoney(item.remainingAmount)}</td>
                      <td className="p-4 text-gray-700">{objectPaymentScheduleStatusLabels[item.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      )}

      {section === "warehouse" && (
        <MaterialLedgerReport
          data={data}
        />
      )}

      {section === "cashflow" && (
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
      )}

      {section === "warehouse" && (
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
      )}

      {section === "warehouse" && (
      <p className="text-xs leading-5 text-gray-500 sm:text-sm">
        Дані розраховані за вибраний
        період. Після переходу на
        Warehouse 3.0 матеріальні
        витрати визначаються за
        історичними рухами Ledger;
        legacy-частина позначена як
        приблизна.
      </p>
      )}
    </div>
  );
}
