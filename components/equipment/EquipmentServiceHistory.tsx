"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { voidEquipmentServiceRecord } from "@/app/actions/equipmentServiceActions";
import { formatEquipmentUsage } from "@/lib/equipmentMaintenance";

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

function VoidRecordAction({
  recordId,
}: {
  recordId: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await voidEquipmentServiceRecord(
        recordId,
        String(
          formData.get("void_reason") ?? ""
        )
      );
      setIsOpen(false);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося анулювати запис."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:w-auto"
      >
        Анулювати
      </button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-2"
    >
      <label className="block min-w-0 text-xs font-medium text-gray-700">
        Причина анулювання
        <textarea
          name="void_reason"
          rows={2}
          required
          maxLength={1000}
          className="mt-1 w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-10 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Збереження…" : "Підтвердити"}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => setIsOpen(false)}
          className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
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
        record.voided_at
          ? sum
          : sum + Number(record.cost || 0),
      0
    );

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      {/* HEADER */}
      <div className="flex min-w-0 flex-col gap-3 border-b p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Історія обслуговування
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Ремонти, діагностика та
            планові роботи
          </p>
        </div>

        <div className="min-w-0 rounded-lg bg-green-50 px-3 py-2 md:bg-transparent md:p-0 md:text-right">
          <p className="text-xs text-gray-500 sm:text-sm">
            Загальні витрати
          </p>

          <p className="mt-1 break-words font-semibold text-green-700">
            {formatMoney(
              totalCost,
              currency
            )}
          </p>
        </div>
      </div>

      {/* EMPTY */}
      {safeRecords.length ===
      0 ? (
        <div className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            🔧
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Записів поки немає
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Історія ремонтів та
            обслуговування з’явиться
            тут.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="space-y-3 p-3 md:hidden">
            {safeRecords.map(
              (record) => (
                <article
                  key={
                    record.id
                  }
                  className="min-w-0 rounded-xl border bg-white p-4"
                >
                  {/* TOP */}
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900">
                        {record
                          .equipment
                          ?.name ||
                          "Техніку видалено"}
                      </p>

                      {record
                        .equipment
                        ?.inventory_number && (
                        <p className="mt-1 break-all text-xs text-gray-500">
                          {
                            record
                              .equipment
                              .inventory_number
                          }
                        </p>
                      )}
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${getTypeClasses(
                        record.service_type
                      )}`}
                    >
                      {
                        record.service_type
                      }
                    </span>
                  </div>

                  {record.voided_at && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <p className="font-semibold">Анульовано</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
                        {record.void_reason || "Причину не вказано"}
                      </p>
                    </div>
                  )}

                  {/* DATE + COST */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        Дата
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {formatDate(
                          record.service_date
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-xs text-gray-500">
                        Вартість
                      </p>

                      <p className="mt-1 break-words text-sm font-semibold text-green-700">
                        {formatMoney(
                          Number(
                            record.cost
                          ),
                          currency
                        )}
                      </p>
                    </div>
                  </div>

                  {/* DETAILS */}
                  <div className="mt-4 space-y-4 border-t pt-4">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        Хто виконав
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-gray-800">
                        {record.performed_by ||
                          "Не вказано"}
                      </p>
                    </div>

                    {record.usage_type_snapshot && (
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Показник напрацювання
                        </p>
                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {formatEquipmentUsage(
                            record.usage_reading,
                            record.usage_type_snapshot
                          )}
                        </p>
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        Опис робіт
                      </p>

                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-gray-700">
                        {record.description ||
                          "Без опису"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        Наступний сервіс
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {formatDate(
                          record.next_service_date
                        )}
                      </p>
                    </div>
                  </div>

                  {/* VOID */}
                  {canManage && !record.voided_at && (
                    <div className="mt-4 border-t pt-4">
                      <VoidRecordAction recordId={record.id} />
                    </div>
                  )}
                </article>
              )
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
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

                  <th className="p-4">
                    Напрацювання
                  </th>

                  <th className="p-4">
                    Стан
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
                      key={
                        record.id
                      }
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
                        <p className="max-w-sm whitespace-pre-wrap break-words">
                          {record.description ||
                            "Без опису"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap p-4 text-gray-600">
                        {formatDate(
                          record.next_service_date
                        )}
                      </td>

                      <td className="whitespace-nowrap p-4 text-gray-600">
                        {record.usage_type_snapshot
                          ? formatEquipmentUsage(
                              record.usage_reading,
                              record.usage_type_snapshot
                            )
                          : "—"}
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${record.voided_at ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                          {record.voided_at ? "Анульовано" : "Активний"}
                        </span>
                        {record.voided_at && record.void_reason && (
                          <p className="mt-2 max-w-xs whitespace-pre-wrap break-words text-xs text-gray-500">
                            {record.void_reason}
                          </p>
                        )}
                      </td>

                      {canManage && (
                        <td className="p-4">
                          {!record.voided_at ? (
                            <VoidRecordAction recordId={record.id} />
                          ) : (
                            <span className="text-xs text-gray-400">Без дій</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
