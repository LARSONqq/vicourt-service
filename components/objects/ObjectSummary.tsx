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
  finance: {
    materialsCost: number;
    laborCost: number;
    otherExpensesCost: number;
    costBudget: number | null;
    clientPrice: number | null;
    paymentSummary:
      ObjectPaymentSummary;
  };
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
  finance,
}: Props) {
  const materialsCost =
    finance.materialsCost;
  const laborCost =
    finance.laborCost;
  const otherExpensesCost =
    finance.otherExpensesCost;
  const costBudget =
    finance.costBudget;
  const clientPrice =
    finance.clientPrice;
  const paymentSummary =
    finance.paymentSummary;
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
    <section className="vc-object-panel vc-surface min-w-0 overflow-hidden">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-foreground">
            Фінансовий підсумок
          </h2>

          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            План, фактична
            собівартість і поточний
            фінансовий результат
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          {/* MATERIALS */}
          <div className="min-w-0 rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Матеріали
            </p>

            <p className="mt-2 break-words text-xl font-bold text-foreground sm:text-2xl">
              {formatMoney(
                materialsCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-muted-foreground">
              Кількість ×
              зафіксована ціна
            </p>
          </div>

          {/* LABOR */}
          <div className="vc-panel-info min-w-0 rounded-lg p-4">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              Роботи
            </p>

            <p className="mt-2 break-words text-xl font-bold sm:text-2xl">
              {formatMoney(
                laborCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 opacity-75">
              Години × ставка
              працівника
            </p>
          </div>

          {/* OTHER EXPENSES */}
          <div className="vc-panel-warning min-w-0 rounded-lg p-4">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              Інші витрати
            </p>

            <p className="mt-2 break-words text-xl font-bold sm:text-2xl">
              {formatMoney(
                otherExpensesCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 opacity-75">
              Паливо, доставка,
              оренда та інше
            </p>
          </div>

          {/* TOTAL */}
          <div className="min-w-0 rounded-lg border border-primary/25 bg-primary p-4 text-primary-foreground">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              Загальні витрати
            </p>

            <p className="mt-2 break-words text-xl font-bold sm:text-2xl">
              {formatMoney(
                financials.actualCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 opacity-80">
              Повна собівартість
              об’єкта
            </p>
          </div>
        </div>

        <div className="border-t border-border bg-muted/35 p-3 sm:p-5">
          <div
            className={`grid min-w-0 grid-cols-1 gap-3 ${
              paymentSummary
                ? "lg:grid-cols-2 xl:grid-cols-4"
                : "lg:grid-cols-3"
            }`}
          >
            <article className="min-w-0 rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                План
              </p>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Плановий бюджет
                  </dt>
                  <dd className="mt-1 break-words text-lg font-semibold text-foreground">
                    {financials.costBudget ===
                    null
                      ? "Не вказано"
                      : formatMoney(
                          financials.costBudget
                        )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">
                    Вартість для
                    клієнта
                  </dt>
                  <dd className="mt-1 break-words text-lg font-semibold text-foreground">
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

            <article className="min-w-0 rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Факт
              </p>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Фактичні витрати
                  </dt>
                  <dd className="mt-1 break-words text-lg font-semibold text-foreground">
                    {formatMoney(
                      financials.actualCost
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-muted-foreground">
                    {financials.budgetOverrun !==
                    null
                      ? "Перевитрата бюджету"
                      : "Залишок бюджету"}
                  </dt>
                  <dd
                    className={`mt-1 break-words text-lg font-semibold ${
                      financials.budgetOverrun !==
                      null
                        ? "text-destructive"
                        : "text-foreground"
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
                  <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
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
                    <span className="shrink-0 font-medium text-foreground">
                      {formatPercent(
                        budgetUsagePercent
                      )}
                    </span>
                  </div>

                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
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
                          ? "bg-destructive"
                          : "bg-primary"
                      }`}
                      style={{
                        width: `${progressWidth}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </article>

            <article className="min-w-0 rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Результат
              </p>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Поточний прибуток
                  </dt>
                  <dd
                    className={`mt-1 break-words text-lg font-semibold ${
                      financials.financialResult ===
                      null
                        ? "text-foreground"
                        : resultIsPositive
                          ? "text-primary"
                          : "text-destructive"
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
                  <dt className="text-sm text-muted-foreground">
                    Маржинальність
                  </dt>
                  <dd
                    className={`mt-1 break-words text-lg font-semibold ${
                      financials.marginPercent ===
                      null
                        ? "text-foreground"
                        : resultIsPositive
                          ? "text-primary"
                          : "text-destructive"
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

              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Поточний прибуток
                розрахований від
                поточної собівартості.
                Це не бухгалтерський і
                не касовий прибуток.
              </p>
            </article>

            {paymentSummary && (
              <article className="min-w-0 rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Розрахунки з
                  клієнтом
                </p>

                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Отримано
                    </dt>
                    <dd className="mt-1 break-words text-lg font-semibold text-primary">
                      {formatMoney(
                        paymentSummary.totalPaid
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-muted-foreground">
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
                          ? "text-primary"
                          : "text-foreground"
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

                <p className="mt-4 text-sm font-medium text-foreground">
                  {
                    objectPaymentStatusLabels[
                      paymentSummary.status
                    ]
                  }
                </p>

                {paymentSummary.progressPercent !==
                  null && (
                  <div className="mt-4">
                    <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
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
                      <span className="shrink-0 font-medium text-foreground">
                        {formatPercent(
                          paymentSummary.progressPercent
                        )}
                      </span>
                    </div>

                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
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
                        className="h-full rounded-full bg-primary"
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
  );
}
