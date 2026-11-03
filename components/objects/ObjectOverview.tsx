import type { ReactNode } from "react";

import {
  calculateObjectFinancials,
} from "@/lib/objectFinancials";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type { Employee } from "@/types/employee";
import type { ObjectTask } from "@/types/objectTask";
import type {
  ObjectPaymentSummary,
} from "@/types/objectPayment";
import type {
  ObjectPaymentScheduleSummary,
} from "@/types/objectPaymentSchedule";
import type { WorkLog } from "@/types/workLog";

type FinanceOverview = {
  materialsCost: number;
  laborCost: number;
  otherExpensesCost: number;
  costBudget: number | null;
  clientPrice: number | null;
  paymentSummary: ObjectPaymentSummary;
  paymentScheduleSummary:
    ObjectPaymentScheduleSummary;
};

type Props = {
  activeTasks: ObjectTask[];
  activeTasksCount?: number;
  materialsCount: number;
  totalHours: number;
  documentsCount: number;
  photosCount: number;
  recentWorkLogs: WorkLog[];
  employees: Employee[];
  today: string;
  supervision?: ReactNode;
  finance?: FinanceOverview;
};

function formatMoney(value: number) {
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

function formatHours(value: number) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function getTaskDuePresentation(
  dueDate: string | null,
  today: string
) {
  if (!dueDate) {
    return {
      label: "Без терміну",
      className:
        "text-muted-foreground",
    };
  }

  if (dueDate < today) {
    return {
      label:
        "Прострочено · " +
        formatDateValue(dueDate),
      className:
        "text-destructive",
    };
  }

  if (dueDate === today) {
    return {
      label: "Сьогодні",
      className:
        "vc-text-warning",
    };
  }

  return {
    label:
      formatDateValue(dueDate),
    className:
      "text-muted-foreground",
  };
}

function getWorkLogActor(
  workLog: WorkLog,
  employeesById: Map<
    number,
    Employee
  >
) {
  if (workLog.employee_id) {
    const employee =
      employeesById.get(
        workLog.employee_id
      );

    if (employee) {
      return (
        employee.last_name +
        " " +
        employee.first_name
      );
    }
  }

  return (
    workLog.workers ||
    "Виконавця не вказано"
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?:
    | "default"
    | "positive"
    | "negative";
}) {
  return (
    <div className="vc-object-panel vc-surface min-w-0 p-3 sm:p-4">
      <p className="text-xs text-muted-foreground sm:text-sm">
        {label}
      </p>
      <p
        className={
          "mt-2 break-words text-lg font-bold sm:text-xl " +
          (tone === "positive"
            ? "text-primary"
            : tone === "negative"
              ? "text-destructive"
              : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}

export default function ObjectOverview({
  activeTasks,
  activeTasksCount =
    activeTasks.length,
  materialsCount,
  totalHours,
  documentsCount,
  photosCount,
  recentWorkLogs,
  employees,
  today,
  supervision,
  finance,
}: Props) {
  const employeesById = new Map(
    employees.map((employee) => [
      employee.id,
      employee,
    ])
  );
  const financials = finance
    ? calculateObjectFinancials({
        materialsCost:
          finance.materialsCost,
        laborCost:
          finance.laborCost,
        otherExpensesCost:
          finance.otherExpensesCost,
        costBudget:
          finance.costBudget,
        clientPrice:
          finance.clientPrice,
      })
    : null;
  const dueTodayPayment =
    finance?.paymentScheduleSummary.items.find(
      (item) =>
        item.status ===
        "due_today"
    ) ?? null;
  const paymentAlert = !finance
    ? null
    : finance.paymentScheduleSummary.overdueAmount >
        0
      ? {
          title:
            "Є прострочені платежі",
          detail: formatMoney(
            finance.paymentScheduleSummary.overdueAmount
          ),
          className:
            "vc-panel-danger border-border",
        }
      : dueTodayPayment
        ? {
            title:
              "Оплата за графіком сьогодні",
            detail:
              dueTodayPayment.title +
              " · " +
              formatMoney(
                dueTodayPayment.remainingAmount
              ),
            className:
              "vc-panel-warning border-border",
          }
        : finance.paymentScheduleSummary.nextPayment
          ? {
              title:
                "Наступний платіж",
              detail:
                formatDateValue(
                  finance.paymentScheduleSummary.nextPayment.due_date
                ) +
                " · " +
                formatMoney(
                  finance.paymentScheduleSummary.nextPayment.remainingAmount
                ),
              className:
                "vc-panel-info border-border",
            }
          : {
              title:
                "Графік оплат",
              detail:
                finance.paymentScheduleSummary.items.length >
                0
                  ? "Усі заплановані платежі покрито"
                  : "Ще не налаштовано",
              className:
                "vc-panel-neutral border-border",
            };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            Стан об’єкта
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ключові операційні показники
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Активні завдання"
            value={String(
              activeTasksCount
            )}
          />
          <KpiCard
            label="Матеріали"
            value={String(
              materialsCount
            )}
          />
          <KpiCard
            label="Відпрацьовано годин"
            value={formatHours(
              totalHours
            )}
          />
          <KpiCard
            label="Файли"
            value={
              documentsCount +
              " док. · " +
              photosCount +
              " фото"
            }
          />
        </div>
      </section>

      {finance && financials && (
        <section className="vc-object-panel min-w-0 rounded-lg border border-border bg-muted/35 p-3 sm:p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              Фінанси зараз
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Короткий план-факт без дублювання детальної вкладки
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <KpiCard
              label="Ціна для клієнта"
              value={
                financials.clientPrice ===
                null
                  ? "Не вказано"
                  : formatMoney(
                      financials.clientPrice
                    )
              }
            />
            <KpiCard
              label="Фактичні витрати"
              value={formatMoney(
                financials.actualCost
              )}
            />
            <KpiCard
              label="Поточний прибуток"
              value={
                financials.financialResult ===
                null
                  ? "Не вказано"
                  : formatMoney(
                      financials.financialResult
                    )
              }
              tone={
                financials.financialResult ===
                  null
                  ? "default"
                  : financials.financialResult >=
                      0
                    ? "positive"
                    : "negative"
              }
            />
            <KpiCard
              label="Отримано"
              value={formatMoney(
                finance.paymentSummary.totalPaid
              )}
              tone="positive"
            />
            <KpiCard
              label="Залишилось"
              value={
                finance.paymentSummary.remainingToPay ===
                null
                  ? "Не вказано"
                  : formatMoney(
                      finance.paymentSummary.remainingToPay
                    )
              }
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <p className="rounded-md bg-card px-3 py-2 text-muted-foreground">
              Матеріали:{" "}
              <strong className="text-foreground">
                {formatMoney(
                  finance.materialsCost
                )}
              </strong>
            </p>
            <p className="rounded-md bg-card px-3 py-2 text-muted-foreground">
              Робота:{" "}
              <strong className="text-foreground">
                {formatMoney(
                  finance.laborCost
                )}
              </strong>
            </p>
            <p className="rounded-md bg-card px-3 py-2 text-muted-foreground">
              Інші витрати:{" "}
              <strong className="text-foreground">
                {formatMoney(
                  finance.otherExpensesCost
                )}
              </strong>
            </p>
          </div>

          {paymentAlert && (
            <div
              className={
                "mt-3 rounded-md border p-3 " +
                paymentAlert.className
              }
            >
              <p className="font-medium">
                {paymentAlert.title}
              </p>
              <p className="mt-1 break-words text-sm">
                {paymentAlert.detail}
              </p>
            </div>
          )}
        </section>
      )}

      {supervision}

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="vc-object-panel vc-surface min-w-0 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Найближчі завдання
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              До п’яти активних завдань
            </p>
          </div>

          {activeTasks.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Активних завдань немає.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {activeTasks.map(
                (task) => {
                  const due =
                    getTaskDuePresentation(
                      task.due_date,
                      today
                    );

                  return (
                    <article
                      key={task.id}
                      className="min-w-0 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium text-foreground">
                            {task.title}
                          </p>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            {task.assignee ||
                              "Не призначено"}
                          </p>
                        </div>
                        <span
                          className={
                            "w-fit text-xs font-medium sm:shrink-0 " +
                            due.className
                          }
                        >
                          {due.label}
                        </span>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="vc-object-panel vc-surface min-w-0 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Останні роботи
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Три останні записи журналу
            </p>
          </div>

          {recentWorkLogs.length ===
          0 ? (
            <p className="mt-4 rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Записів робіт ще немає.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {recentWorkLogs.map(
                (workLog) => (
                  <article
                    key={workLog.id}
                    className="min-w-0 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-foreground">
                          {workLog.description}
                        </p>
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {getWorkLogActor(
                            workLog,
                            employeesById
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
                        <p>
                          {formatDateValue(
                            workLog.work_date
                          )}
                        </p>
                        <p className="mt-1 font-medium text-foreground">
                          {formatHours(
                            Number(
                              workLog.hours
                            )
                          )}{" "}
                          год.
                        </p>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
