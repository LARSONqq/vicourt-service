"use client";

import { deleteEquipmentServiceRecord } from "@/app/actions/equipmentServiceActions";

import type { AppCurrency } from "@/types/appSettings";
import type { EquipmentServiceRecord } from "@/types/equipmentServiceRecord";

type Props = {
  records: EquipmentServiceRecord[];
  currency: AppCurrency;
  canManage?: boolean;
};

function formatDate(
  date: string | null
) {
  if (!date) {
    return "Не вказано";
  }

  const datePart =
    date.slice(0, 10);

  const [
    year,
    month,
    day,
  ] = datePart.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return "Не вказано";
  }

  return `${day}.${month}.${year}`;
}

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  const symbols: Record<
    string,
    string
  > = {
    UAH: "₴",
    USD: "$",
    EUR: "€",
  };

  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const negative =
    safeValue < 0;

  const absoluteValue =
    Math.abs(safeValue);

  const [
    wholePart,
    decimalPart,
  ] = absoluteValue
    .toFixed(2)
    .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  const symbol =
    symbols[currency] ||
    currency;

  return `${
    negative ? "−" : ""
  }${formattedWhole},${decimalPart} ${symbol}`;
}

function getTypeClasses(
  type: string
) {
  switch (type) {
    case "Планове обслуговування":
      return "bg-green-50 text-green-700";

    case "Ремонт":
      return "bg-red-50 text-red-700";

    case "Заміна запчастин":
      return "bg-orange-50 text-orange-700";

    case "Діагностика":
      return "bg-blue-50 text-blue-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function EquipmentServiceHistory({
  records,
  currency,
  canManage = false,
}: Props) {
  const safeRecords =
    Array.isArray(records)
      ? records
      : [];

  const totalCost =
    safeRecords.reduce(
      (sum, record) =>
        sum +
        Number(
          record.cost || 0
        ),
      0
    );

  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Історія обслуговування
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Ремонти, діагностика та
            планові роботи
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-sm text-gray-500">
            Загальні витрати
          </p>

          <p className="font-semibold text-green-700">
            {formatMoney(
              totalCost,
              currency
            )}
          </p>
        </div>
      </div>

      {safeRecords.length ===
      0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-500">
            Записів обслуговування
            поки що немає.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className={`w-full ${
              canManage
                ? "min-w-[1150px]"
                : "min-w-[1000px]"
            }`}
          >
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-4">
                  Дата
                </th>

                <th className="p-4">
                  Техніка
                </th>

                <th className="p-4">
                  Тип
                </th>

                <th className="p-4">
                  Вартість
                </th>

                <th className="p-4">
                  Хто виконав
                </th>

                <th className="p-4">
                  Опис
                </th>

                <th className="p-4">
                  Наступний сервіс
                </th>

                {canManage && (
                  <th className="p-4 text-right">
                    Дії
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {safeRecords.map(
                (record) => (
                  <tr
                    key={record.id}
                    className="border-t"
                  >
                    <td className="whitespace-nowrap p-4 text-gray-600">
                      {formatDate(
                        record.service_date
                      )}
                    </td>

                    <td className="p-4">
                      <p className="font-medium">
                        {record
                          .equipment
                          ?.name ||
                          "Техніку видалено"}
                      </p>

                      {record
                        .equipment
                        ?.inventory_number && (
                        <p className="mt-1 text-xs text-gray-500">
                          {
                            record
                              .equipment
                              .inventory_number
                          }
                        </p>
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getTypeClasses(
                          record.service_type
                        )}`}
                      >
                        {
                          record.service_type
                        }
                      </span>
                    </td>

                    <td className="p-4 font-medium">
                      {formatMoney(
                        Number(
                          record.cost
                        ),
                        currency
                      )}
                    </td>

                    <td className="p-4 text-gray-600">
                      {record.performed_by ||
                        "Не вказано"}
                    </td>

                    <td className="p-4 text-gray-600">
                      <p className="max-w-sm whitespace-pre-wrap">
                        {record.description ||
                          "Без опису"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap p-4 text-gray-600">
                      {formatDate(
                        record.next_service_date
                      )}
                    </td>

                    {canManage && (
                      <td className="p-4">
                        <form
                          action={deleteEquipmentServiceRecord.bind(
                            null,
                            record.id
                          )}
                          onSubmit={(
                            event
                          ) => {
                            const confirmed =
                              window.confirm(
                                "Видалити цей запис обслуговування?"
                              );

                            if (
                              !confirmed
                            ) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Видалити
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}