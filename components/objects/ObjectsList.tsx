"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import { ObjectItem } from "@/types/object";

type Props = {
  objects: ObjectItem[];
};

function getStatusStyle(
  status: string | null
) {
  switch (status) {
    case "Новий":
      return "bg-blue-100 text-blue-700";

    case "В роботі":
      return "bg-green-100 text-green-700";

    case "Призупинено":
      return "bg-yellow-100 text-yellow-700";

    case "Завершено":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function ObjectsList({
  objects,
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
            objectStatuses
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
      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:p-4 md:grid-cols-[1fr_220px]">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук об’єкта..."
          className="min-h-11 w-full min-w-0 rounded-lg border px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-green-600 sm:text-base"
        />

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="min-h-11 w-full rounded-lg border bg-white px-4 py-3 text-sm outline-none transition focus:border-green-600 sm:text-base"
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
            className="text-xs font-medium text-green-700 hover:underline"
          >
            Скинути фільтр
          </button>
        )}
      </div>

      {/* EMPTY */}
      {filteredObjects.length ===
      0 ? (
        <div className="rounded-xl border bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            ⌕
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Нічого не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити пошук або
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
                className="block min-w-0 rounded-xl border bg-white p-4 transition active:bg-gray-50 sm:p-5 sm:hover:border-green-300 sm:hover:shadow-sm"
              >
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* LEFT */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start gap-2 sm:block">
                      <h2 className="min-w-0 break-words text-base font-semibold text-gray-900 sm:text-lg">
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

                    <span className="shrink-0 text-lg text-gray-300 sm:hidden">
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