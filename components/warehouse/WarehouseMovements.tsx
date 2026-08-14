"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import type { WarehouseMovement } from "@/types/warehouseMovement";

type Props = {
  movements?: WarehouseMovement[];
};

function formatDate(date: string) {
  const parsedDate = new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "Невідома дата";
  }

  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(parsedDate);
}

export default function WarehouseMovements({
  movements = [],
}: Props) {
  const safeMovements =
    Array.isArray(movements)
      ? movements
      : [];

  const [search, setSearch] =
    useState("");

  const [
    movementType,
    setMovementType,
  ] = useState("Усі");

  const [
    selectedObjectId,
    setSelectedObjectId,
  ] = useState("Усі");

  const objectOptions = useMemo(() => {
    const objects = new Map<
      number,
      string
    >();

    safeMovements.forEach(
      (movement) => {
        if (movement.object) {
          objects.set(
            movement.object.id,
            movement.object.name
          );
        }
      }
    );

    return Array.from(
      objects.entries()
    )
      .map(([id, name]) => ({
        id,
        name,
      }))
      .sort((first, second) =>
        first.name.localeCompare(
          second.name,
          "uk"
        )
      );
  }, [safeMovements]);

  const filteredMovements =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return safeMovements.filter(
        (movement) => {
          const searchableText = [
            movement.item?.name,
            movement.object?.name,
            movement.note,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchableText.includes(
              normalizedSearch
            );

          const matchesType =
            movementType === "Усі" ||
            movement.movement_type ===
              movementType;

          const matchesObject =
            selectedObjectId ===
              "Усі" ||
            (selectedObjectId ===
              "Без об’єкта" &&
              !movement.object) ||
            String(
              movement.object?.id
            ) === selectedObjectId;

          return (
            matchesSearch &&
            matchesType &&
            matchesObject
          );
        }
      );
    }, [
      safeMovements,
      search,
      movementType,
      selectedObjectId,
    ]);

  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-5">
        <h2 className="text-xl font-semibold">
          Історія руху товарів
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Приходи та списання
          матеріалів
        </p>
      </div>

      {safeMovements.length > 0 && (
        <div className="grid grid-cols-1 gap-3 border-b bg-gray-50 p-4 lg:grid-cols-[1fr_220px_260px]">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Пошук за матеріалом, об’єктом або приміткою"
            className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-green-600"
          />

          <select
            value={movementType}
            onChange={(event) =>
              setMovementType(
                event.target.value
              )
            }
            className="w-full rounded-lg border bg-white px-4 py-3"
          >
            <option value="Усі">
              Усі операції
            </option>

            <option value="Прихід">
              Тільки приходи
            </option>

            <option value="Списання">
              Тільки списання
            </option>
          </select>

          <select
            value={selectedObjectId}
            onChange={(event) =>
              setSelectedObjectId(
                event.target.value
              )
            }
            className="w-full rounded-lg border bg-white px-4 py-3"
          >
            <option value="Усі">
              Усі об’єкти
            </option>

            <option value="Без об’єкта">
              Без прив’язки до
              об’єкта
            </option>

            {objectOptions.map(
              (object) => (
                <option
                  key={object.id}
                  value={object.id}
                >
                  {object.name}
                </option>
              )
            )}
          </select>
        </div>
      )}

      {safeMovements.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-500">
            Операцій зі складом поки
            що немає.
          </p>
        </div>
      ) : filteredMovements.length ===
        0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-500">
            Операцій за вибраними
            фільтрами не знайдено.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b px-5 py-3">
            <p className="text-sm text-gray-500">
              Показано операцій:{" "}
              {filteredMovements.length}{" "}
              із {safeMovements.length}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-4">
                    Дата
                  </th>

                  <th className="p-4">
                    Операція
                  </th>

                  <th className="p-4">
                    Матеріал
                  </th>

                  <th className="p-4">
                    Кількість
                  </th>

                  <th className="p-4">
                    Об’єкт
                  </th>

                  <th className="p-4">
                    Примітка
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredMovements.map(
                  (movement) => {
                    const isIncome =
                      movement.movement_type ===
                      "Прихід";

                    return (
                      <tr
                        key={
                          movement.id
                        }
                        className="border-t"
                      >
                        <td className="whitespace-nowrap p-4 text-sm text-gray-500">
                          {formatDate(
                            movement.created_at
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-medium ${
                              isIncome
                                ? "bg-green-50 text-green-700"
                                : "bg-orange-50 text-orange-700"
                            }`}
                          >
                            {
                              movement.movement_type
                            }
                          </span>
                        </td>

                        <td className="p-4 font-medium">
                          {movement.item
                            ?.name ||
                            "Позицію видалено"}
                        </td>

                        <td
                          className={`p-4 font-semibold ${
                            isIncome
                              ? "text-green-700"
                              : "text-orange-700"
                          }`}
                        >
                          {isIncome
                            ? "+"
                            : "−"}
                          {Number(
                            movement.quantity
                          )}{" "}
                          {movement.item
                            ?.unit || ""}
                        </td>

                        <td className="p-4">
                          {movement.object ? (
                            <Link
                              href={`/objects/${movement.object.id}`}
                              className="font-medium text-green-700 hover:underline"
                            >
                              {
                                movement
                                  .object
                                  .name
                              }
                            </Link>
                          ) : (
                            <span className="text-gray-400">
                              Не прив’язано
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-gray-600">
                          {movement.note ||
                            "Без примітки"}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}