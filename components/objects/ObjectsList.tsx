"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import {
  formatDateValue,
} from "@/lib/kyivDate";
import {
  getObjectSupervisionState,
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import { ObjectItem } from "@/types/object";

type Props = {
  objects: ObjectItem[];
  today: string;
};

const standardStatuses = [
  "Новий",
  "В роботі",
  "На постійному обслуговуванні",
  "Під періодичним наглядом",
  "Призупинено",
  "Завершено",
];

function getStatusStyle(
  status: string | null
) {
  switch (status) {
    case "Новий":
      return "vc-status-info";

    case "В роботі":
      return "vc-status-success";

    case "На постійному обслуговуванні":
      return "vc-status-info";

    case "Під періодичним наглядом":
      return "vc-status-warning";

    case "Призупинено":
      return "vc-status-warning";

    case "Завершено":
      return "vc-status-neutral";

    default:
      return "vc-status-neutral";
  }
}

const statusSegmentStyles: Record<string, string> = {
  "Новий": "bg-[var(--vc-info-text)]",
  "В роботі": "bg-[var(--vc-success-text)]",
  "На постійному обслуговуванні": "bg-primary",
  "Під періодичним наглядом": "bg-[var(--vc-warning-text)]",
  "Призупинено": "bg-[var(--vc-danger-text)]",
  "Завершено": "bg-muted-foreground",
};

function ObjectSupervisionNote({
  object,
  today,
}: {
  object: ObjectItem;
  today: string;
}) {
  if (
    object.status !==
    PERIODIC_SUPERVISION_STATUS
  ) {
    return null;
  }

  const state =
    getObjectSupervisionState(
      object.next_supervision_date,
      today
    );

  if (state.kind === "overdue") {
    return (
      <span className="vc-status-danger inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium">
        Огляд прострочено · {state.overdueDays} дн.
      </span>
    );
  }

  if (state.kind === "today") {
    return (
      <span className="vc-status-warning inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium">
        Огляд сьогодні
      </span>
    );
  }

  return (
    <span className="vc-status-warning inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium">
      Огляд · {formatDateValue(
        object.next_supervision_date
      ) || "не заплановано"}
    </span>
  );
}

export default function ObjectsList({
  objects,
  today,
}: Props) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("Усі");

  const statuses =
    useMemo(() => {
      const objectStatuses =
        objects
          .map(
            (object) =>
              object.status
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          );

      return [
        "Усі",
        ...Array.from(
          new Set(
            [
              ...standardStatuses,
              ...objectStatuses,
            ]
          )
        ),
      ];
    }, [objects]);

  const filteredObjects =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return objects.filter(
        (object) => {
          const matchesStatus =
            status === "Усі" ||
            object.status ===
              status;

          const searchableText =
            [
              object.name,
              object.customer,
              object.phone,
              object.address,
              object.manager,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchableText.includes(
              normalizedSearch
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      objects,
      search,
      status,
    ]);

  const statusDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    objects.forEach((object) => {
      const objectStatus = object.status || "Без статусу";
      counts.set(objectStatus, (counts.get(objectStatus) || 0) + 1);
    });

    return Array.from(counts, ([label, count]) => ({ label, count }))
      .sort((first, second) => {
        const firstIndex = standardStatuses.indexOf(first.label);
        const secondIndex = standardStatuses.indexOf(second.label);
        return (firstIndex < 0 ? standardStatuses.length : firstIndex) -
          (secondIndex < 0 ? standardStatuses.length : secondIndex);
      });
  }, [objects]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {objects.length > 0 && (
        <section className="vc-surface space-y-2.5 p-3 sm:p-4" aria-label="Розподіл об’єктів за статусом">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Статуси об’єктів</h2>
            <span className="text-xs text-muted-foreground">Усього {objects.length}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {statusDistribution.map(({ label, count }) => (
              <span
                key={label}
                className={statusSegmentStyles[label] || "bg-muted-foreground"}
                style={{ width: `${(count / objects.length) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {statusDistribution.map(({ label, count }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${statusSegmentStyles[label] || "bg-muted-foreground"}`} aria-hidden="true" />
                {label} <strong className="font-semibold text-foreground">{count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* FILTERS */}
      <div className="vc-surface grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук об’єкта..."
          aria-label="Пошук об’єкта"
          className="vc-field min-h-11 min-w-0 px-4 py-3 sm:text-base"
        />

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          aria-label="Фільтр за статусом"
          className="vc-field min-h-11 px-4 py-3 sm:text-base"
        >
          {statuses.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}
        </select>
      </div>

      {/* COUNT */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Знайдено:{" "}
          <span className="font-semibold text-foreground">
            {
              filteredObjects.length
            }
          </span>
        </p>

        {status !== "Усі" && (
          <button
            type="button"
            onClick={() =>
              setStatus("Усі")
            }
            className="inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Скинути фільтр
          </button>
        )}
      </div>

      {/* EMPTY */}
      {filteredObjects.length ===
      0 ? (
        <div className="vc-surface p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            ⌕
          </div>

          <p className="mt-3 font-medium text-foreground">
            Нічого не знайдено
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Спробуйте змінити пошук або
            статус.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredObjects.map(
            (object) => (
              <Link
                key={object.id}
                href={`/objects/${object.id}`}
                className="vc-surface group block min-w-0 p-4 transition hover:border-primary/35 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-muted/60 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* LEFT */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start gap-2 sm:block">
                      <h2 className="min-w-0 break-words text-base font-semibold text-foreground transition group-hover:text-primary sm:text-lg">
                        {
                          object.name
                        }
                      </h2>

                      <span
                        className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:hidden ${getStatusStyle(
                          object.status
                        )}`}
                      >
                        {object.status ||
                          "Без статусу"}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5 text-sm">
                      <p className="break-words font-medium text-foreground">
                        {object.customer || "Замовника не вказано"}
                      </p>

                      <p className="break-words text-muted-foreground">
                        {object.address || "Адресу не вказано"}
                      </p>

                      {object.phone && <p className="break-words text-foreground">{object.phone}</p>}

                      <ObjectSupervisionNote
                        object={object}
                        today={today}
                      />
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="flex min-w-0 items-end justify-between gap-3 border-t pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <span
                      className={`hidden w-fit rounded-full px-3 py-1 text-sm font-medium sm:inline-flex ${getStatusStyle(
                        object.status
                      )}`}
                    >
                      {object.status ||
                        "Без статусу"}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground sm:text-right">
                        Відповідальний
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-foreground sm:max-w-[220px] sm:text-right">
                        {object.manager ||
                          "Не вказано"}
                      </p>
                    </div>

                    <span aria-hidden="true" className="shrink-0 text-lg text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary sm:hidden">
                      ›
                    </span>
                  </div>
                </div>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
