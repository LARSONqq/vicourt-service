import Link from "next/link";

import DevicePushSettings from "@/components/notifications/DevicePushSettings";
import AutomaticPushSettings from "@/components/notifications/AutomaticPushSettings";

import {
  canAccessSection,
  canManageObjects,
  isWorker,
} from "@/lib/auth/permissions";
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
import {
  getPushNotificationPreferences,
} from "@/services/pushNotificationPreferenceService";

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

type NotificationGroup = {
  key: "urgent" | "actionable" | "informational";
  label: string;
  description: string;
  items: NotificationItem[];
};

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
  {
    value: "equipment",
    label: "Техніка",
  },
  {
    value: "finance",
    label: "Фінанси",
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
  value: string,
  availableFilters = filters
): NotificationFilter {
  return availableFilters.some(
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

    case "equipment_maintenance_today":
    case "equipment_maintenance_overdue":
    case "equipment_maintenance_usage_due":
      return "⚙";

    case "client_payment_due_today":
    case "client_payment_overdue":
      return "₴";
  }
}

function getNotificationStyle(
  severity: NotificationItem["severity"]
) {
  switch (severity) {
    case "critical":
      return {
        card: "vc-alert-danger",
        icon: "vc-status-danger",
        badge: "vc-status-danger",
      };

    case "warning":
      return {
        card: "vc-alert-warning",
        icon: "vc-status-warning",
        badge: "vc-status-warning",
      };

    case "info":
      return {
        card: "vc-alert-info",
        icon: "vc-status-info",
        badge: "vc-status-info",
      };
  }
}

function groupNotifications(
  items: NotificationItem[]
): NotificationGroup[] {
  const urgent = items.filter(
    (item) =>
      item.timing === "overdue" ||
      item.severity === "critical"
  );
  const actionable = items.filter(
    (item) =>
      !urgent.includes(item) &&
      (item.timing === "today" ||
        item.severity === "warning")
  );
  const informational = items.filter(
    (item) =>
      !urgent.includes(item) &&
      !actionable.includes(item)
  );

  const groups: NotificationGroup[] = [
    {
      key: "urgent",
      label: "Термінові та прострочені",
      description: "Потребують першочергової уваги",
      items: urgent,
    },
    {
      key: "actionable",
      label: "Сьогодні та до виконання",
      description: "Актуальні операційні дії",
      items: actionable,
    },
    {
      key: "informational",
      label: "Інформаційні",
      description: "Решта поточних повідомлень",
      items: informational,
    },
  ];

  return groups.filter(
    (group) => group.items.length > 0
  );
}

export const dynamic =
  "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: Props) {
  const profile =
    await requireSectionAccess(
      "notifications"
    );

  const params =
    await searchParams;
  const visibleFilters =
    filters.filter(
      (filter) =>
        filter.value !== "purchases" ||
        canAccessSection(
          profile.role,
          "purchases"
        )
    ).filter(
      (filter) =>
        filter.value !== "finance" ||
        canManageObjects(
          profile.role
        )
    );
  const activeFilter =
    parseFilter(
      getFirstParam(
        params.type
      ),
      visibleFilters
    );
  const [
    notificationCenter,
    pushPreferences,
  ] = await Promise.all([
    getNotificationCenter(),
    getPushNotificationPreferences(
      profile.id
    ),
  ]);
  const visibleItems =
    activeFilter === "all"
      ? notificationCenter.items
      : notificationCenter.items.filter(
          (item) =>
            item.category ===
            activeFilter
        );
  const notificationGroups =
    groupNotifications(visibleItems);

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

      <section className="grid min-w-0 grid-cols-3 divide-x rounded-lg border border-border bg-card">
        <div className="min-w-0 px-3 py-3 sm:px-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Всього
          </p>

          <p className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
            {
              notificationCenter
                .summary.total
            }
          </p>
        </div>

        <div
          className="min-w-0 px-3 py-3 sm:px-4"
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            Термінові
          </p>

          <p
            className={`mt-1 text-xl font-semibold sm:text-2xl ${
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
          className="min-w-0 px-3 py-3 sm:px-4"
        >
          <p className="text-xs text-gray-500 sm:text-sm">
            На сьогодні
          </p>

          <p
            className={`mt-1 text-xl font-semibold sm:text-2xl ${
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
        {visibleFilters.map((filter) => {
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
                  ? "vc-tab-active"
                  : "bg-white text-gray-700 hover:border-green-300 hover:bg-green-50"
              }`}
            >
              {filter.label}

              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive
                    ? "bg-background/25 text-inherit"
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
        <div className="min-w-0 space-y-6">
          {notificationGroups.map((group) => (
            <section key={group.key} className="min-w-0">
              <div className="mb-2 flex min-w-0 items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground">
                    {group.label}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {group.description}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {group.items.map((item) => {
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
                  className={`relative flex min-w-0 flex-col border-b border-border p-4 last:border-b-0 sm:p-5 ${style.card}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      aria-hidden="true"
                      className={`mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full text-[0px] ${style.icon}`}
                    >
                      {getNotificationIcon(
                        item.type
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <h3 className="break-words font-semibold text-foreground">
                          {item.title}
                        </h3>

                        {item.detail && (
                          <span
                            className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}
                          >
                            {item.detail}
                          </span>
                        )}
                      </div>

                      {(item.contextLabel ||
                        formattedDate) && (
                        <div className="mt-1.5 flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
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

                      <details className="group mt-2">
                        <summary className="w-fit cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                          <span className="group-open:hidden">Деталі ↓</span>
                          <span className="hidden group-open:inline">Сховати ↑</span>
                        </summary>
                        <p className="mt-2 break-words text-sm leading-5 text-muted-foreground">
                          {item.message}
                        </p>
                      </details>
                    </div>
                  </div>

                  <div className="mt-3 pl-5 sm:text-right">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted sm:w-fit"
                    >
                      Відкрити
                    </Link>
                  </div>
                </article>
              );
              })}
              </div>
            </section>
          ))}
        </div>
      )}

      <details className="group rounded-lg border border-border bg-muted/30">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span>
            Налаштування сповіщень
            <span className="ml-2 font-normal text-muted-foreground">
              Push і автоматичні нагадування
            </span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground transition group-open:rotate-180">↓</span>
        </summary>

        <div className="flex min-w-0 flex-col items-stretch gap-4 border-t border-border p-4 xl:flex-row xl:items-start">
          <div className="min-w-0 xl:max-w-md xl:shrink-0">
            <DevicePushSettings
              vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
            />
          </div>
          <div className="min-w-0 xl:flex-1">
            <AutomaticPushSettings
              initialPreferences={pushPreferences}
              showLowStock={!isWorker(profile.role)}
              showEquipmentMaintenance={!isWorker(profile.role)}
              showClientPayments={!isWorker(profile.role)}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
