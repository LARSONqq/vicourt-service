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
      return "bg-green-50 text-green-700";
    case "tasks":
      return "bg-blue-50 text-blue-700";
    case "warehouse":
      return "bg-amber-50 text-amber-700";
    case "purchases":
      return "bg-cyan-50 text-cyan-700";
    case "finance":
      return "bg-emerald-50 text-emerald-700";
    case "equipment":
      return "bg-slate-100 text-slate-700";
    case "supervision":
      return "bg-rose-50 text-rose-700";
    case "documents":
      return "bg-violet-50 text-violet-700";
    case "employees":
      return "bg-indigo-50 text-indigo-700";
    default:
      return "bg-gray-100 text-gray-700";
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
    <p className="min-w-0 break-words text-sm text-gray-600">
      <span className="text-gray-400">
        {label}:{" "}
      </span>

      {href ? (
        <Link
          href={href}
          className="font-medium text-green-700 hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="font-medium text-gray-700">
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
            className={`min-w-0 rounded-xl border bg-white ${
              compact
                ? "p-3 sm:p-4"
                : "p-4 sm:p-5"
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${getCategoryStyle(
                  presentation.category
                )}`}
              >
                {presentation.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-gray-900">
                      {presentation.label}
                    </p>

                    <p className="mt-1 text-xs text-gray-500 sm:text-sm">
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

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
                  {presentation.description}
                </p>

                {presentation.details.length > 0 && (
                  <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
                    {presentation.details.map(
                      (detail, index) => (
                        <div
                          key={`${detail.label}-${index}`}
                          className="min-w-0"
                        >
                          <dt className="text-xs font-medium text-gray-400">
                            {detail.label}
                          </dt>
                          <dd className="mt-0.5 break-words text-gray-700">
                            {detail.value ?? (
                              <>
                                <span className="text-gray-500">
                                  {detail.previousValue}
                                </span>
                                <span
                                  aria-label="змінено на"
                                  className="mx-1.5 text-gray-400"
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
                        className="w-fit text-sm font-medium text-green-700 hover:underline"
                      >
                        Відкрити розділ →
                      </Link>
                    )}
                </div>

                {!presentation.isKnownEvent && (
                  <p className="mt-2 break-all text-xs text-gray-400">
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
