import Link from "next/link";

import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  EquipmentWorkSessionListItem,
} from "@/types/equipmentUsage";

type Props = {
  items: EquipmentWorkSessionListItem[];
  total: number;
  context: "object" | "employee";
  canViewEmployeeProfiles?: boolean;
  canViewObjectProfiles?: boolean;
};

function formatDuration(
  value: number | null
) {
  const duration = Number(value);

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return "—";
  }

  return `+${new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 3,
    }
  ).format(duration)} год`;
}

export default function EquipmentWorkSessionList({
  items,
  total,
  context,
  canViewEmployeeProfiles = false,
  canViewObjectProfiles = false,
}: Props) {
  const isObjectContext =
    context === "object";

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          {isObjectContext
            ? "Використання техніки"
            : "Робота з технікою"}
        </h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">
          {isObjectContext
            ? "Робота техніки, зафіксована на цьому об’єкті."
            : "Історія роботи працівника з технікою на об’єктах."}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Записів: {total}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
          <p className="font-medium text-gray-700">
            {isObjectContext
              ? "На цьому об’єкті ще немає записів роботи техніки."
              : "У цього працівника ще немає записів роботи з технікою."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
          {items.map((item) => {
            const equipmentName =
              item.equipment_name_snapshot ||
              "Техніку не вказано";
            const employeeName =
              item.employee_name_snapshot ||
              "Працівника не вказано";
            const objectName =
              item.object_name_snapshot ||
              "Об’єкт не вказано";

            return (
              <article
                key={item.id}
                className="min-w-0 rounded-xl border p-4"
              >
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">
                      {formatDateValue(
                        item.reading_date
                      ) ||
                        item.reading_date}
                    </p>
                    {item.equipment_id !==
                    null ? (
                      <Link
                        href={`/equipment/${item.equipment_id}`}
                        className="mt-1 inline-block break-words font-semibold text-green-700 hover:underline"
                      >
                        {equipmentName}
                      </Link>
                    ) : (
                      <p className="mt-1 break-words font-semibold text-gray-900">
                        {equipmentName}
                      </p>
                    )}
                  </div>

                  <span className="w-fit shrink-0 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                    {formatDuration(
                      item.delta
                    )}
                  </span>
                </div>

                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {isObjectContext
                      ? "Працівник"
                      : "Об’єкт"}
                  </p>
                  {isObjectContext ? (
                    canViewEmployeeProfiles &&
                    item.employee_id !==
                      null ? (
                      <Link
                        href={`/employees/${item.employee_id}`}
                        className="mt-1 inline-block break-words text-sm font-medium text-green-700 hover:underline"
                      >
                        {employeeName}
                      </Link>
                    ) : (
                      <p className="mt-1 break-words text-sm font-medium text-gray-700">
                        {employeeName}
                      </p>
                    )
                  ) : (
                    canViewObjectProfiles &&
                    item.object_id !==
                      null ? (
                      <Link
                        href={`/objects/${item.object_id}`}
                        className="mt-1 inline-block break-words text-sm font-medium text-green-700 hover:underline"
                      >
                        {objectName}
                      </Link>
                    ) : (
                      <p className="mt-1 break-words text-sm font-medium text-gray-700">
                        {objectName}
                      </p>
                    )
                  )}
                </div>

                {item.note && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Примітка
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-gray-600">
                      {item.note}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
