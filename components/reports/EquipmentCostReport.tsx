import type {
  ReportsData,
} from "@/types/report";

type Props = {
  data: ReportsData;
};

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

export default function EquipmentCostReport({
  data,
}: Props) {
  const summary =
    data.equipmentCostSummary;

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Витрати на техніку
        </h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">
          Фактична вартість неанульованих ТО, ремонтів, діагностики та запчастин.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 border-b p-3 sm:grid-cols-3 sm:p-5">
        <div className="rounded-lg bg-green-50 p-3">
          <p className="text-xs text-green-700/70">Планове ТО за період</p>
          <p className="mt-1 break-words font-semibold text-green-700">
            {formatMoney(
              summary.periodPlannedMaintenanceCost
            )}
          </p>
        </div>
        <div className="rounded-lg bg-orange-50 p-3">
          <p className="text-xs text-orange-700/70">Ремонти та інше за період</p>
          <p className="mt-1 break-words font-semibold text-orange-700">
            {formatMoney(
              summary.periodOtherServiceCost
            )}
          </p>
        </div>
        <div className="rounded-lg bg-gray-900 p-3 text-white">
          <p className="text-xs text-gray-300">Разом за період</p>
          <p className="mt-1 break-words font-semibold">
            {formatMoney(
              summary.periodTotalCost
            )}
          </p>
        </div>
      </div>

      {data.equipmentCosts.length === 0 ? (
        <p className="p-5 text-sm text-gray-500">
          Сервісних витрат на техніку ще немає.
        </p>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {data.equipmentCosts.map((item) => (
              <article
                key={item.equipmentId}
                className="min-w-0 rounded-xl border p-4"
              >
                <p className="break-words font-semibold text-gray-900">
                  {item.equipmentName}
                </p>
                {item.inventoryNumber && (
                  <p className="mt-1 break-all text-xs text-gray-500">
                    {item.inventoryNumber}
                  </p>
                )}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">ТО за період</dt>
                    <dd className="mt-1 font-semibold text-green-700">
                      {formatMoney(item.periodPlannedMaintenanceCost)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Ремонти/інше</dt>
                    <dd className="mt-1 font-semibold text-orange-700">
                      {formatMoney(item.periodOtherServiceCost)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Разом за період</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {formatMoney(item.periodTotalCost)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">За весь час</dt>
                    <dd className="mt-1 font-semibold text-gray-900">
                      {formatMoney(item.lifetimeTotalCost)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="p-4 font-medium">Техніка</th>
                  <th className="p-4 font-medium">ТО за період</th>
                  <th className="p-4 font-medium">Ремонти/інше</th>
                  <th className="p-4 font-medium">Разом за період</th>
                  <th className="p-4 font-medium">За весь час</th>
                </tr>
              </thead>
              <tbody>
                {data.equipmentCosts.map((item) => (
                  <tr key={item.equipmentId} className="border-t">
                    <td className="p-4">
                      <p className="break-words font-semibold text-gray-900">
                        {item.equipmentName}
                      </p>
                      {item.inventoryNumber && (
                        <p className="mt-1 text-xs text-gray-500">
                          {item.inventoryNumber}
                        </p>
                      )}
                    </td>
                    <td className="p-4 font-medium text-green-700">
                      {formatMoney(item.periodPlannedMaintenanceCost)}
                    </td>
                    <td className="p-4 font-medium text-orange-700">
                      {formatMoney(item.periodOtherServiceCost)}
                    </td>
                    <td className="p-4 font-semibold text-gray-900">
                      {formatMoney(item.periodTotalCost)}
                    </td>
                    <td className="p-4 font-semibold text-gray-900">
                      {formatMoney(item.lifetimeTotalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="border-t px-4 py-3 text-xs leading-5 text-gray-500 sm:px-5">
        За весь час: планове ТО — {formatMoney(summary.lifetimePlannedMaintenanceCost)}, ремонти та інше — {formatMoney(summary.lifetimeOtherServiceCost)}, разом — {formatMoney(summary.lifetimeTotalCost)}.
      </p>
    </section>
  );
}
