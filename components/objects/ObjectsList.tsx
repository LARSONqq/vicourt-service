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
      return "bg-blue-100 text-blue-700";

    case "В роботі":
      return "bg-green-100 text-green-700";

    case "На постійному обслуговуванні":
      return "bg-purple-100 text-purple-700";

    case "Під періодичним наглядом":
      return "bg-rose-100 text-rose-700";

    case "Призупинено":
      return "bg-yellow-100 text-yellow-700";

    case "Завершено":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

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
      <p className="break-words text-sm font-medium text-red-600">
        Огляд прострочено на {state.overdueDays} дн.
      </p>
    );
  }

  if (state.kind === "today") {
    return (
      <p className="break-words text-sm font-medium text-orange-600">
        Огляд сьогодні
      </p>
    );
  }

  return (
    <p className="break-words text-sm text-rose-700">
      Наступний огляд: {formatDateValue(
        object.next_supervision_date
      ) || "не заплановано"}
    </p>
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

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* FILTERS */}
      <div className="vc-surface grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-[1fr_240px]">
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
        <p className="text-sm text-gray-500">
          Знайдено:{" "}
          <span className="font-medium text-gray-700">
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
            className="inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            Скинути фільтр
          </button>
        )}
      </div>

      {/* EMPTY */}
      {filteredObjects.length ===
      0 ? (
        <div className="vc-surface p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            ⌕
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Нічого не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
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
                className="vc-surface group block min-w-0 p-4 transition hover:border-green-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 active:bg-gray-50 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* LEFT */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start gap-2 sm:block">
                      <h2 className="min-w-0 break-words text-base font-semibold text-gray-950 transition group-hover:text-green-800 sm:text-lg">
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

                    <div className="mt-2 space-y-1.5">
                      <p className="break-words text-sm text-gray-600">
                        <span className="text-gray-400">
                          Замовник:{" "}
                        </span>

                        {object.customer ||
                          "Не вказано"}
                      </p>

                      <p className="break-words text-sm text-gray-600">
                        <span className="text-gray-400">
                          Адреса:{" "}
                        </span>

                        {object.address ||
                          "Не вказано"}
                      </p>

                      {object.phone && (
                        <p className="break-words text-sm text-gray-600">
                          <span className="text-gray-400">Телефон: </span>
                          {object.phone}
                        </p>
                      )}

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
                      <p className="text-xs text-gray-400 sm:text-right">
                        Відповідальний
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-gray-700 sm:max-w-[220px] sm:text-right">
                        {object.manager ||
                          "Не вказано"}
                      </p>
                    </div>

                    <span aria-hidden="true" className="shrink-0 text-lg text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-green-700 sm:hidden">
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
