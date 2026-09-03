import type {
  ReportMaterialAccountingMethod,
  ReportsData,
} from "@/types/report";

type Props = {
  data: ReportsData;
};

const accountingMethodLabels: Record<
  ReportMaterialAccountingMethod,
  string
> = {
  exact_ledger: "Точний Ledger",
  legacy_approximation:
    "Legacy / приблизно",
  opening_snapshot:
    "Початковий знімок",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 3,
    }
  ).format(value);
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return "Невідома дата";
  }

  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      timeZone: "Europe/Kyiv",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  )
    .format(parsed)
    .replace(",", "");
}

export default function MaterialLedgerReport({
  data,
}: Props) {
  const accounting =
    data.materialAccounting;
  const visibleMovements =
    data.warehouseMovementExportRows.slice(
      0,
      50
    );
  const isExact =
    accounting.periodMode === "exact";

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Рух матеріалів за період
        </h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">
          Історична кількість і вартість із canonical ledger. У таблиці показано до 50 останніх рухів; CSV та Excel містять усю вибірку.
        </p>
      </div>

      <div
        className={`border-b p-4 text-sm leading-6 sm:px-5 ${
          isExact
            ? "border-green-100 bg-green-50 text-green-800"
            : "border-amber-100 bg-amber-50 text-amber-900"
        }`}
      >
        <p className="font-semibold">
          {isExact
            ? "Матеріальні витрати за період розраховані точно за Ledger."
            : accounting.periodMode ===
                "mixed"
              ? "Період містить legacy- та exact-частини."
              : "Період передує точному Ledger-обліку."}
        </p>
        {accounting.exactFromDate && (
          <p className="mt-1">
            Точний облік діє з {accounting.exactFromDate.split("-").reverse().join(".")}.
          </p>
        )}
        {accounting.limitation && (
          <p className="mt-1">
            {accounting.limitation}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 border-b p-4 sm:grid-cols-3 sm:p-5">
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">
            {accounting.periodMode ===
            "mixed"
              ? "Підтверджено після cutover"
              : "Матеріали за період"}
          </p>
          <p className="mt-1 break-words text-xl font-bold text-gray-900">
            {formatMoney(
              accounting.periodTotal
            )}
          </p>
        </div>
        <div className="rounded-xl bg-green-50 p-4">
          <p className="text-xs text-green-700/70">
            Exact Ledger
          </p>
          <p className="mt-1 break-words text-xl font-bold text-green-700">
            {formatMoney(
              accounting.exactCost
            )}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-xs text-amber-700/70">
            Legacy approximation
          </p>
          <p className="mt-1 break-words text-xl font-bold text-amber-700">
            {accounting.legacyApproximateCost ===
            null
              ? "Не розраховано"
              : formatMoney(
                  accounting.legacyApproximateCost
                )}
          </p>
        </div>
      </div>

      {visibleMovements.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500 sm:p-8">
          За вибраний період рухів матеріалів немає.
        </div>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {visibleMovements.map(
              (movement) => (
                <article
                  key={movement.id}
                  className="min-w-0 rounded-xl border p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900">
                        {movement.itemName}
                      </p>
                      <p className="mt-1 break-words text-xs text-gray-500">
                        {movement.movementLabel}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDate(
                        movement.createdAt
                      )}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">
                        Кількість
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatNumber(
                          movement.quantity
                        )} {movement.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">
                        Історична сума
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatMoney(
                          movement.totalValue
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">
                        Об’єкт
                      </dt>
                      <dd className="mt-1 break-words font-medium">
                        {movement.objectName ||
                          "Склад"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">
                        Метод
                      </dt>
                      <dd className="mt-1 font-medium">
                        {
                          accountingMethodLabels[
                            movement.accountingMethod
                          ]
                        }
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 break-words text-xs leading-5 text-gray-500">
                    {movement.performedBy ||
                      "Система"} · {movement.source}
                  </p>
                </article>
              )
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1160px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  {[
                    "Дата",
                    "Матеріал",
                    "Рух",
                    "Кількість",
                    "Історична ціна",
                    "Сума",
                    "Об’єкт",
                    "Виконавець / джерело",
                    "Метод",
                  ].map((label) => (
                    <th
                      key={label}
                      className="p-4 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleMovements.map(
                  (movement) => (
                    <tr
                      key={movement.id}
                      className="border-t align-top"
                    >
                      <td className="whitespace-nowrap p-4 text-gray-600">
                        {formatDate(
                          movement.createdAt
                        )}
                      </td>
                      <td className="max-w-xs break-words p-4 font-semibold text-gray-900">
                        {movement.itemName}
                      </td>
                      <td className="p-4 text-gray-700">
                        {movement.movementLabel}
                      </td>
                      <td className="whitespace-nowrap p-4">
                        {formatNumber(
                          movement.quantity
                        )} {movement.unit}
                      </td>
                      <td className="whitespace-nowrap p-4">
                        {formatMoney(
                          movement.unitPrice
                        )}
                      </td>
                      <td className="whitespace-nowrap p-4 font-semibold">
                        {formatMoney(
                          movement.totalValue
                        )}
                      </td>
                      <td className="max-w-xs break-words p-4">
                        {movement.objectName ||
                          "Склад"}
                      </td>
                      <td className="max-w-xs break-words p-4 text-gray-600">
                        {movement.performedBy ||
                          "Система"}
                        <p className="mt-1 text-xs text-gray-500">
                          {movement.source}
                        </p>
                      </td>
                      <td className="p-4 text-gray-600">
                        {
                          accountingMethodLabels[
                            movement.accountingMethod
                          ]
                        }
                      </td>
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
