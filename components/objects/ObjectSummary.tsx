import {
  calculateObjectFinancials,
} from "@/lib/objectFinancials";
import {
  objectPaymentStatusLabels,
} from "@/constants/objectPayments";

import type {
  ObjectPaymentSummary,
} from "@/types/objectPayment";

type Props = {
  activeTasks: number;
  materialsCount: number;
  totalHours: number;
  photosCount: number;
  materialsCost: number;
  laborCost: number;
  otherExpensesCost: number;
  costBudget: number | null;
  clientPrice: number | null;
  paymentSummary?:
    ObjectPaymentSummary;
};

function formatMoney(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(safeValue);
}

function formatHours(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 2,
    }
  ).format(safeValue);
}

function formatPercent(
  value: number
) {
  return `${new Intl.NumberFormat(
    "uk-UA",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  ).format(value)}%`;
}

export default function ObjectSummary({
  activeTasks,
  materialsCount,
  totalHours,
  photosCount,
  materialsCost,
  laborCost,
  otherExpensesCost,
  costBudget,
  clientPrice,
  paymentSummary,
}: Props) {
  const financials =
    calculateObjectFinancials({
      materialsCost,
      laborCost,
      otherExpensesCost,
      costBudget,
      clientPrice,
    });
  const budgetUsagePercent =
    financials.costBudget !==
      null &&
    financials.costBudget > 0
      ? (financials.actualCost /
          financials.costBudget) *
        100
      : null;
  const progressWidth =
    budgetUsagePercent === null
      ? 0
      : Math.min(
          Math.max(
            budgetUsagePercent,
            0
          ),
          100
        );
  const resultIsPositive =
    financials.financialResult !==
      null &&
    financials.financialResult >=
      0;
  const paymentProgressWidth =
    paymentSummary
      ?.progressPercent ===
      null ||
    paymentSummary
      ?.progressPercent ===
      undefined
      ? 0
      : Math.min(
          Math.max(
            paymentSummary.progressPercent,
            0
          ),
          100
        );

  return (
    <div className="min-w-0 space-y-4">
      {/* GENERAL SUMMARY */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Активні завдання
          </p>

          <p className="mt-2 text-2xl font-bold text-yellow-600">
            {activeTasks}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Матеріали
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {materialsCount}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Відпрацьовано годин
          </p>

          <p className="mt-2 break-words text-2xl font-bold text-green-600">
            {formatHours(
              totalHours
            )}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Фотографії
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {photosCount}
          </p>
        </div>
      </div>

      {/* FINANCIAL SUMMARY */}
      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Фінансовий підсумок
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            План, фактична
            собівартість і поточний
            фінансовий результат
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          {/* MATERIALS */}
          <div className="min-w-0 rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Матеріали
            </p>

            <p className="mt-2 break-words text-xl font-bold text-gray-900 sm:text-2xl">
              {formatMoney(
                materialsCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-gray-500">
              Кількість ×
              зафіксована ціна
            </p>
          </div>

          {/* LABOR */}
          <div className="min-w-0 rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
              Роботи
            </p>

            <p className="mt-2 break-words text-xl font-bold text-blue-700 sm:text-2xl">
              {formatMoney(
                laborCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-blue-700/70">
              Години × ставка
              працівника
            </p>
          </div>

          {/* OTHER EXPENSES */}
          <div className="min-w-0 rounded-xl bg-orange-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-orange-600">
              Інші витрати
            </p>

            <p className="mt-2 break-words text-xl font-bold text-orange-700 sm:text-2xl">
              {formatMoney(
                otherExpensesCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-orange-700/70">
              Паливо, доставка,
              оренда та інше
            </p>
          </div>

          {/* TOTAL */}
          <div className="min-w-0 rounded-xl border border-green-200 bg-green-600 p-4 text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-green-100">
              Загальні витрати
            </p>

            <p className="mt-2 break-words text-xl font-bold sm:text-2xl">
              {formatMoney(
                financials.actualCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-green-100">
              Повна собівартість
              об’єкта
            </p>
          </div>
        </div>

        <div className="border-t bg-gray-50/60 p-3 sm:p-5">
          <div
            className={`grid min-w-0 grid-cols-1 gap-3 ${
              paymentSummary
                ? "lg:grid-cols-2 xl:grid-cols-4"
                : "lg:grid-cols-3"
            }`}
          >
            <article className="min-w-0 rounded-xl border border-blue-100 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                План
              </p>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">
                    Плановий бюджет
                  </dt>
                  <dd className="mt-1 break-words text-lg font-semibold text-blue-700">
                    {financials.costBudget ===
                    null
                      ? "Не вказано"
                      : formatMoney(
                          financials.costBudget
                        )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-gray-500">
                    Вартість для
                    клієнта
                  </dt>
                  <dd className="mt-1 break-words text-lg font-semibold text-blue-700">
                    {financials.clientPrice ===
                    null
                      ? "Не вказано"
                      : formatMoney(
                          financials.clientPrice
                        )}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="min-w-0 rounded-xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Факт
              </p>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">
                    Фактичні витрати
                  </dt>
                  <dd className="mt-1 break-words text-lg font-semibold text-gray-900">
                    {formatMoney(
                      financials.actualCost
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-gray-500">
                    {financials.budgetOverrun !==
                    null
                      ? "Перевитрата бюджету"
                      : "Залишок бюджету"}
                  </dt>
                  <dd
                    className={`mt-1 break-words text-lg font-semibold ${
                      financials.budgetOverrun !==
                      null
                        ? "text-red-700"
                        : "text-gray-900"
                    }`}
                  >
                    {financials.costBudget ===
                    null
                      ? "Не вказано"
                      : formatMoney(
                          financials.budgetOverrun ??
                            financials.budgetRemaining ??
                            0
                        )}
                  </dd>
                </div>
              </dl>

              {budgetUsagePercent !==
                null && (
                <div className="mt-5">
                  <div className="flex items-start justify-between gap-3 text-xs text-gray-500">
                    <span className="break-words">
                      {formatMoney(
                        financials.actualCost
                      )}
                      {" / "}
                      {formatMoney(
                        financials.costBudget ??
                          0
                      )}
                    </span>
                    <span className="shrink-0 font-medium text-gray-700">
                      {formatPercent(
                        budgetUsagePercent
                      )}
                    </span>
                  </div>

                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"
                    role="progressbar"
                    aria-label="Використання планового бюджету"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                      Math.round(
                        progressWidth
                      )
                    }
                  >
                    <div
                      className={`h-full rounded-full ${
                        financials.budgetOverrun !==
                        null
                          ? "bg-red-600"
                          : "bg-green-600"
                      }`}
                      style={{
                        width: `${progressWidth}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </article>

            <article className="min-w-0 rounded-xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Результат
              </p>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">
                    Поточний прибуток
                  </dt>
                  <dd
                    className={`mt-1 break-words text-lg font-semibold ${
                      financials.financialResult ===
                      null
                        ? "text-gray-900"
                        : resultIsPositive
                          ? "text-green-700"
                          : "text-red-700"
                    }`}
                  >
                    {financials.financialResult ===
                    null
                      ? "Не вказано"
                      : formatMoney(
                          financials.financialResult
                        )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-gray-500">
                    Маржинальність
                  </dt>
                  <dd
                    className={`mt-1 break-words text-lg font-semibold ${
                      financials.marginPercent ===
                      null
                        ? "text-gray-900"
                        : resultIsPositive
                          ? "text-green-700"
                          : "text-red-700"
                    }`}
                  >
                    {financials.marginPercent ===
                    null
                      ? financials.clientPrice ===
                        0
                        ? "Не розраховується"
                        : "Не вказано"
                      : formatPercent(
                          financials.marginPercent
                        )}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-xs leading-5 text-gray-500">
                Поточний прибуток
                розрахований від
                поточної собівартості.
                Це не бухгалтерський і
                не касовий прибуток.
              </p>
            </article>

            {paymentSummary && (
              <article className="min-w-0 rounded-xl border border-emerald-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Розрахунки з
                  клієнтом
                </p>

                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">
                      Отримано
                    </dt>
                    <dd className="mt-1 break-words text-lg font-semibold text-emerald-700">
                      {formatMoney(
                        paymentSummary.totalPaid
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-gray-500">
                      {paymentSummary.overpayment !==
                        null &&
                      paymentSummary.overpayment >
                        0
                        ? "Переплата"
                        : "Залишилось"}
                    </dt>
                    <dd
                      className={`mt-1 break-words text-lg font-semibold ${
                        paymentSummary.overpayment !==
                          null &&
                        paymentSummary.overpayment >
                          0
                          ? "text-violet-700"
                          : "text-gray-900"
                      }`}
                    >
                      {paymentSummary.clientPrice ===
                      null
                        ? "Вартість для клієнта не задана"
                        : formatMoney(
                            paymentSummary.overpayment !==
                              null &&
                            paymentSummary.overpayment >
                              0
                              ? paymentSummary.overpayment
                              : paymentSummary.remainingToPay ??
                                  0
                          )}
                    </dd>
                  </div>
                </dl>

                <p className="mt-4 text-sm font-medium text-gray-700">
                  {
                    objectPaymentStatusLabels[
                      paymentSummary.status
                    ]
                  }
                </p>

                {paymentSummary.progressPercent !==
                  null && (
                  <div className="mt-4">
                    <div className="flex items-start justify-between gap-3 text-xs text-gray-500">
                      <span className="break-words">
                        {formatMoney(
                          paymentSummary.totalPaid
                        )}
                        {" / "}
                        {formatMoney(
                          paymentSummary.clientPrice ??
                            0
                        )}
                      </span>
                      <span className="shrink-0 font-medium text-gray-700">
                        {formatPercent(
                          paymentSummary.progressPercent
                        )}
                      </span>
                    </div>

                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"
                      role="progressbar"
                      aria-label="Отримані платежі від вартості для клієнта"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        Math.round(
                          paymentProgressWidth
                        )
                      }
                    >
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{
                          width: `${paymentProgressWidth}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
