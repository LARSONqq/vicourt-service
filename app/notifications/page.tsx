import Link from "next/link";

import DevicePushSettings from "@/components/notifications/DevicePushSettings";

import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  formatDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";
import {
  getNotificationCenter,
} from "@/services/notificationService";

import type {
  NotificationCategory,
  NotificationItem,
} from "@/types/notification";

type SearchParams = {
  type?: string | string[];
};

type Props = {
  searchParams: Promise<
    SearchParams
  >;
};

type NotificationFilter =
  | "all"
  | NotificationCategory;

const filters: Array<{
  value: NotificationFilter;
  label: string;
}> = [
  {
    value: "all",
    label: "Усі",
  },
  {
    value: "tasks",
    label: "Завдання",
  },
  {
    value: "supervision",
    label: "Огляди",
  },
  {
    value: "warehouse",
    label: "Склад",
  },
  {
    value: "purchases",
    label: "Закупівлі",
  },
];

function getFirstParam(
  value:
    | string
    | string[]
    | undefined
) {
  return Array.isArray(value)
    ? value[0] || ""
    : value || "";
}

function parseFilter(
  value: string
): NotificationFilter {
  return filters.some(
    (filter) =>
      filter.value === value
  )
    ? (value as NotificationFilter)
    : "all";
}

function getFilterHref(
  filter: NotificationFilter
) {
  return filter === "all"
    ? "/notifications"
    : `/notifications?type=${filter}`;
}

function formatNotificationDate(
  value: string | null
) {
  if (!value) {
    return null;
  }

  if (
    isValidDateValue(value)
  ) {
    return formatDateValue(
      value
    );
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
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
    .format(date)
    .replace(",", "");
}

function getNotificationIcon(
  type: NotificationItem["type"]
) {
  switch (type) {
    case "overdue_task":
      return "!";

    case "supervision_today":
    case "supervision_overdue":
      return "◉";

    case "low_stock":
      return "↓";

    case "planned_purchase":
      return "+";
  }
}

function getNotificationStyle(
  severity: NotificationItem["severity"]
) {
  switch (severity) {
    case "critical":
      return {
        card: "border-red-200",
        icon: "bg-red-100 text-red-700",
        badge: "bg-red-50 text-red-700",
      };

    case "warning":
      return {
        card: "border-orange-200",
        icon: "bg-orange-100 text-orange-700",
        badge:
          "bg-orange-50 text-orange-700",
      };

    case "info":
      return {
        card: "border-blue-200",
        icon: "bg-blue-100 text-blue-700",
        badge: "bg-blue-50 text-blue-700",
      };
  }
}

export const dynamic =
  "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: Props) {
  await requireSectionAccess(
    "notifications"
  );

  const params =
    await searchParams;
  const activeFilter =
    parseFilter(
      getFirstParam(
        params.type
      )
    );
  const notificationCenter =
    await getNotificationCenter();
  const visibleItems =
    activeFilter === "all"
      ? notificationCenter.items
      : notificationCenter.items.filter(
          (item) =>
            item.category ===
            activeFilter
        );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Центр сповіщень
        </h1>

        <p className="mt-1 text-sm leading-5 text-gray-500 sm:text-base">
          Тут зібрано все, що зараз
          потребує вашої уваги.
        </p>
      </div>

      <DevicePushSettings
        vapidPublicKey={
          process.env
            .NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
          ""
        }
      />

      <section className="grid min-w-0 grid-cols-3 gap-2 sm:gap-4">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Всього
          </p>

          <p className="mt-2 text-xl font-bold text-gray-900 sm:text-3xl">
            {
              notificationCenter
                .summary.total
            }
          </p>
        </div>

        <div
          className={`min-w-0 rounded-xl border bg-white p-3 sm:p-5 ${
            notificationCenter
              .summary.critical > 0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            Термінові
          </p>

          <p
            className={`mt-2 text-xl font-bold sm:text-3xl ${
              notificationCenter
                .summary.critical > 0
                ? "text-red-600"
                : "text-gray-700"
            }`}
          >
            {
              notificationCenter
                .summary.critical
            }
          </p>
        </div>

        <div
          className={`min-w-0 rounded-xl border bg-white p-3 sm:p-5 ${
            notificationCenter
              .summary.today > 0
              ? "border-orange-200"
              : ""
          }`}
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            На сьогодні
          </p>

          <p
            className={`mt-2 text-xl font-bold sm:text-3xl ${
              notificationCenter
                .summary.today > 0
                ? "text-orange-600"
                : "text-gray-700"
            }`}
          >
            {
              notificationCenter
                .summary.today
            }
          </p>
        </div>
      </section>

      <nav
        aria-label="Фільтр сповіщень"
        className="flex min-w-0 gap-2 overflow-x-auto pb-1"
      >
        {filters.map((filter) => {
          const count =
            filter.value === "all"
              ? notificationCenter
                  .summary.total
              : notificationCenter.items.filter(
                  (item) =>
                    item.category ===
                    filter.value
                ).length;
          const isActive =
            activeFilter ===
            filter.value;

          return (
            <Link
              key={filter.value}
              href={getFilterHref(
                filter.value
              )}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition sm:px-4 ${
                isActive
                  ? "border-green-600 bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:border-green-300 hover:bg-green-50"
              }`}
            >
              {filter.label}

              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {visibleItems.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-white p-6 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl font-semibold text-green-700">
            ✓
          </div>

          <h2 className="mt-3 text-lg font-semibold text-gray-800">
            {notificationCenter
              .summary.total === 0
              ? "Все гаразд"
              : "У цій категорії все гаразд"}
          </h2>

          <p className="mx-auto mt-1 max-w-xl text-sm leading-5 text-gray-500">
            {notificationCenter
              .summary.total === 0
              ? "Наразі немає подій, які потребують вашої уваги."
              : "Наразі в цій категорії немає подій, які потребують вашої уваги."}
          </p>
        </section>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
          {visibleItems.map(
            (item) => {
              const style =
                getNotificationStyle(
                  item.severity
                );
              const formattedDate =
                formatNotificationDate(
                  item.date
                );

              return (
                <article
                  key={item.key}
                  className={`flex min-w-0 flex-col rounded-xl border bg-white p-4 sm:p-5 ${style.card}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      aria-hidden="true"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${style.icon}`}
                    >
                      {getNotificationIcon(
                        item.type
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <h2 className="break-words font-semibold text-gray-900">
                          {item.title}
                        </h2>

                        {item.detail && (
                          <span
                            className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}
                          >
                            {item.detail}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 break-words text-sm leading-5 text-gray-700">
                        {item.message}
                      </p>

                      {(item.contextLabel ||
                        formattedDate) && (
                        <div className="mt-3 flex min-w-0 flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:flex-wrap sm:gap-x-4">
                          {item.contextLabel && (
                            <span className="break-words">
                              {
                                item.contextLabel
                              }
                            </span>
                          )}

                          {formattedDate && (
                            <span className="shrink-0">
                              {formattedDate}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-4 sm:text-right">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 sm:w-fit"
                    >
                      Відкрити
                    </Link>
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
