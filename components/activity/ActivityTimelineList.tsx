import Link from "next/link";

import {
  formatActivityTimestamp,
  getActivityPresentation,
} from "@/lib/activityLogPresentation";

import type {
  ActivityCategory,
  ActivityLog,
} from "@/types/activityLog";

type Props = {
  logs: ActivityLog[];
  existingObjectIds: number[];
  compact?: boolean;
};

function getActivityDayKey(
  value: string
) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Kyiv",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
}

function formatActivityDay(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Без дати";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getCategoryStyle(
  category: ActivityCategory
) {
  switch (category) {
    case "objects":
      return "vc-status-success";
    case "tasks":
      return "vc-status-info";
    case "warehouse":
      return "vc-status-warning";
    case "purchases":
      return "vc-status-info";
    case "finance":
      return "vc-status-success";
    case "equipment":
      return "vc-status-neutral";
    case "supervision":
      return "vc-status-warning";
    case "documents":
      return "vc-status-info";
    case "employees":
      return "vc-status-info";
    default:
      return "vc-status-neutral";
  }
}

function EntityValue({
  label,
  name,
  href,
}: {
  label: string;
  name: string;
  href: string | null;
}) {
  return (
    <p className="min-w-0 break-words [overflow-wrap:anywhere] text-sm text-muted-foreground">
      <span className="text-muted-foreground">
        {label}:{" "}
      </span>

      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-11 max-w-full items-center rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {name}
        </Link>
      ) : (
        <span className="font-medium text-foreground">
          {name}
        </span>
      )}
    </p>
  );
}

export default function ActivityTimelineList({
  logs,
  existingObjectIds,
  compact = false,
}: Props) {
  const existingObjects =
    new Set(existingObjectIds);
  const groupedLogs = logs.reduce<
    Array<{
      key: string;
      label: string;
      logs: ActivityLog[];
    }>
  >((groups, log) => {
    const key = getActivityDayKey(
      log.created_at
    );
    const current =
      groups[groups.length - 1];

    if (current?.key === key) {
      current.logs.push(log);
    } else {
      groups.push({
        key,
        label: formatActivityDay(
          log.created_at
        ),
        logs: [log],
      });
    }

    return groups;
  }, []);

  return (
    <div className="space-y-6">
      {groupedLogs.map((group) => (
        <section key={group.key}>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-semibold capitalize text-foreground">
              {group.label}
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {group.logs.length}
            </span>
          </div>

          <div className="relative space-y-0 before:absolute before:bottom-5 before:left-[7px] before:top-5 before:w-px before:bg-border">
            {group.logs.map((log) => {
        const presentation =
          getActivityPresentation(
            log,
            existingObjects
          );

        return (
          <article
            key={log.id}
            className={`relative min-w-0 pl-7 ${
              compact
                ? "pb-4"
                : "pb-5"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute left-0 top-5 z-10 h-[15px] w-[15px] rounded-full border-4 border-background ${getCategoryStyle(
                presentation.category
              )}`}
            />

            <div className="min-w-0 rounded-lg border border-border bg-card p-4 sm:px-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words [overflow-wrap:anywhere] text-xs text-muted-foreground sm:text-sm">
                      {formatActivityTimestamp(
                        log.created_at
                      )}
                      <span aria-hidden="true">
                        {" · "}
                      </span>
                      <span className="font-medium text-foreground">
                        {presentation.actorName}
                      </span>
                    </p>

                    <p className="mt-1 break-words [overflow-wrap:anywhere] font-semibold text-foreground">
                      {presentation.label}
                    </p>
                  </div>

                  <span
                    className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryStyle(
                      presentation.category
                    )}`}
                  >
                    {presentation.categoryLabel}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-5 text-muted-foreground">
                  {presentation.description}
                </p>

                {presentation.details.length > 0 && (
                  <details className="group mt-3 rounded-md border border-border bg-muted/40">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <span>Деталі змін ({presentation.details.length})</span>
                      <span aria-hidden="true" className="transition group-open:rotate-180">↓</span>
                    </summary>
                    <dl className="grid min-w-0 grid-cols-1 gap-2 border-t border-border p-3 text-sm sm:grid-cols-2">
                    {presentation.details.map(
                      (detail, index) => (
                        <div
                          key={`${detail.label}-${index}`}
                          className="min-w-0"
                        >
                          <dt className="text-xs font-medium text-muted-foreground">
                            {detail.label}
                          </dt>
                          <dd className="mt-0.5 break-words [overflow-wrap:anywhere] text-foreground">
                            {detail.value ?? (
                              <>
                                <span className="text-muted-foreground">
                                  {detail.previousValue}
                                </span>
                                <span
                                  aria-label="змінено на"
                                  className="mx-1.5 text-muted-foreground"
                                >
                                  →
                                </span>
                                <span className="font-medium">
                                  {detail.newValue}
                                </span>
                              </>
                            )}
                          </dd>
                        </div>
                      )
                    )}
                    </dl>
                  </details>
                )}

                <div className="mt-3 flex min-w-0 flex-col gap-1.5 border-t pt-3 sm:flex-row sm:flex-wrap sm:gap-x-5">
                  {presentation.object && (
                    <EntityValue
                      {...presentation.object}
                    />
                  )}

                  {presentation.entity &&
                    presentation.entity.name !==
                      presentation.object?.name && (
                      <EntityValue
                        {...presentation.entity}
                      />
                    )}

                  {presentation.sectionHref &&
                    !presentation.entity?.href && (
                      <Link
                        href={presentation.sectionHref}
                        className="inline-flex min-h-11 max-w-full items-center rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Відкрити розділ →
                      </Link>
                    )}
                </div>

                {!presentation.isKnownEvent && (
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    Тип події: {log.action}
                  </p>
                )}
            </div>
          </article>
        );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
