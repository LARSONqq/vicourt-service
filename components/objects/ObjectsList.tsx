"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ObjectItem } from "@/types/object";

type Props = {
  objects: ObjectItem[];
};

function getStatusStyle(status: string | null) {
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

export default function ObjectsList({ objects }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Усі");

  const statuses = useMemo(() => {
    const objectStatuses = objects
      .map((object) => object.status)
      .filter((value): value is string => Boolean(value));

    return ["Усі", ...Array.from(new Set(objectStatuses))];
  }, [objects]);

  const filteredObjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return objects.filter((object) => {
      const matchesStatus =
        status === "Усі" || object.status === status;

      const searchableText = [
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
        searchableText.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [objects, search, status]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1fr_220px]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Пошук за назвою, замовником або адресою"
          className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-green-600"
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-gray-500">
        Знайдено об’єктів: {filteredObjects.length}
      </p>

      {filteredObjects.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">
            Об’єктів за цими параметрами не знайдено.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredObjects.map((object) => (
            <Link
              key={object.id}
              href={`/objects/${object.id}`}
              className="block rounded-xl border bg-white p-5 transition hover:border-green-300 hover:shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {object.name}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {object.customer || "Замовника не вказано"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {object.address || "Адресу не вказано"}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusStyle(
                      object.status
                    )}`}
                  >
                    {object.status || "Без статусу"}
                  </span>

                  <p className="text-sm text-gray-500">
                    {object.manager || "Відповідального не вказано"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
