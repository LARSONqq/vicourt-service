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

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const presentation =
          getActivityPresentation(
            log,
            existingObjects
          );

        return (
          <article
            key={log.id}
            className={`min-w-0 rounded-lg border border-border bg-card ${
              compact
                ? "p-3 sm:p-4"
                : "p-4 sm:p-5"
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md !p-0 text-sm ${getCategoryStyle(
                  presentation.category
                )}`}
              >
                {presentation.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words [overflow-wrap:anywhere] font-semibold text-foreground">
                      {presentation.label}
                    </p>

                    <p className="mt-1 break-words [overflow-wrap:anywhere] text-xs text-muted-foreground sm:text-sm">
                      {formatActivityTimestamp(
                        log.created_at
                      )}
                      <span aria-hidden="true">
                        {" · "}
                      </span>
                      <span>
                        Хто: {presentation.actorName}
                      </span>
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

                <p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-foreground">
                  {presentation.description}
                </p>

                {presentation.details.length > 0 && (
                  <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 rounded-lg bg-muted p-3 text-sm sm:grid-cols-2">
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
            </div>
          </article>
        );
      })}
    </div>
  );
}
