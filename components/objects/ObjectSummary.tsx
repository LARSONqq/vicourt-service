type Props = {
  activeTasks: number;
  materialsCount: number;
  totalHours: number;
  photosCount: number;
  materialsCost: number;
  laborCost: number;
};

function formatMoney(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(safeValue);
}

function formatHours(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 2,
    }
  ).format(safeValue);
}

export default function ObjectSummary({
  activeTasks,
  materialsCount,
  totalHours,
  photosCount,
  materialsCost,
  laborCost,
}: Props) {
  const totalCost =
    materialsCost +
    laborCost;

  return (
    <div className="min-w-0 space-y-4">
      {/* GENERAL SUMMARY */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Активні завдання
          </p>

          <p className="mt-2 text-2xl font-bold text-yellow-600">
            {activeTasks}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Матеріали
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {materialsCount}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Відпрацьовано годин
          </p>

          <p className="mt-2 break-words text-2xl font-bold text-green-600">
            {formatHours(
              totalHours
            )}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
          <p className="text-xs text-gray-500 sm:text-sm">
            Фотографії
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {photosCount}
          </p>
        </div>
      </div>

      {/* FINANCIAL SUMMARY */}
      <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Фінансовий підсумок
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Автоматичний розрахунок
            матеріалів та виконаних
            робіт
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 p-3 sm:grid-cols-3 sm:p-5">
          <div className="min-w-0 rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Матеріали
            </p>

            <p className="mt-2 break-words text-xl font-bold text-gray-900 sm:text-2xl">
              {formatMoney(
                materialsCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-gray-500">
              За кількістю та
              зафіксованою ціною
            </p>
          </div>

          <div className="min-w-0 rounded-xl bg-green-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-green-600">
              Виконані роботи
            </p>

            <p className="mt-2 break-words text-xl font-bold text-green-700 sm:text-2xl">
              {formatMoney(
                laborCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-green-700/70">
              Години × ставка
              працівника
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-green-200 bg-green-600 p-4 text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-green-100">
              Загальні витрати
            </p>

            <p className="mt-2 break-words text-xl font-bold sm:text-2xl">
              {formatMoney(
                totalCost
              )}
            </p>

            <p className="mt-1 text-xs leading-4 text-green-100">
              Матеріали + роботи
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}