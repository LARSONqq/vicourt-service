import Link from "next/link";

import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  DashboardData,
} from "@/types/dashboard";
import type {
  NotificationItem,
} from "@/types/notification";

type Props = {
  attention: DashboardData["attention"];
};

function getCategoryLabel(
  category: NotificationItem["category"]
) {
  switch (category) {
    case "tasks":
      return "Завдання";
    case "supervision":
      return "Нагляд";
    case "warehouse":
      return "Склад";
    case "purchases":
      return "Закупівля";
    case "equipment":
      return "Техніка";
    case "finance":
      return "Фінанси";
  }
}

function getSeverityClasses(
  severity: NotificationItem["severity"]
) {
  switch (severity) {
    case "critical":
      return {
        card: "border-red-200",
        badge:
          "bg-red-50 text-red-700",
        marker:
          "bg-red-100 text-red-700",
      };
    case "warning":
      return {
        card: "border-orange-200",
        badge:
          "bg-orange-50 text-orange-700",
        marker:
          "bg-orange-100 text-orange-700",
      };
    case "info":
      return {
        card: "border-blue-200",
        badge:
          "bg-blue-50 text-blue-700",
        marker:
          "bg-blue-100 text-blue-700",
      };
  }
}

export default function DashboardAttention({
  attention,
}: Props) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Потребує уваги
            </h2>

            {attention.summary.total >
              0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                {
                  attention.summary
                    .total
                }
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-gray-500">
            Найважливіші актуальні події
          </p>
        </div>

        <Link
          href="/notifications"
          className="w-fit text-sm font-medium text-green-700 hover:underline"
        >
          Усі сповіщення →
        </Link>
      </div>

      {attention.items.length ===
      0 ? (
        <div className="flex items-start gap-3 p-5 sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
            ✓
          </span>

          <div className="min-w-0">
            <p className="font-medium text-gray-800">
              Все гаразд
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Наразі немає подій, які потребують уваги.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {attention.items.map(
            (item) => {
              const styles =
                getSeverityClasses(
                  item.severity
                );

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`group flex min-w-0 items-start gap-3 rounded-lg border p-3 transition hover:bg-gray-50 sm:p-4 ${styles.card}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${styles.marker}`}
                    aria-hidden="true"
                  >
                    {item.severity ===
                    "critical"
                      ? "!"
                      : "•"}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}
                      >
                        {getCategoryLabel(
                          item.category
                        )}
                      </span>

                      {item.detail && (
                        <span className="break-words text-xs font-medium text-gray-500">
                          {item.detail}
                        </span>
                      )}
                    </span>

                    <span className="mt-2 block break-words font-semibold text-gray-900 group-hover:text-green-700">
                      {item.title}
                    </span>

                    <span className="mt-1 line-clamp-2 block break-words text-sm leading-5 text-gray-600">
                      {item.message}
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                      {item.contextLabel && (
                        <span className="break-words">
                          {
                            item.contextLabel
                          }
                        </span>
                      )}
                      {item.date && (
                        <span>
                          {formatDateValue(
                            item.date.slice(
                              0,
                              10
                            )
                          ) || ""}
                        </span>
                      )}
                      <span className="font-medium text-green-700">
                        Перейти →
                      </span>
                    </span>
                  </span>
                </Link>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}
