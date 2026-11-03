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
    <section className="vc-surface min-w-0 p-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">
          {isObjectContext
            ? "Використання техніки"
            : "Робота з технікою"}
        </h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {isObjectContext
            ? "Робота техніки, зафіксована на цьому об’єкті."
            : "Історія роботи працівника з технікою на об’єктах."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Записів: {total}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed bg-muted/50 p-6 text-center sm:p-5">
          <p className="font-medium text-foreground">
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
                className="min-w-0 rounded-lg border border-border bg-muted/40 p-4 transition hover:border-ring/40 hover:bg-muted/35"
              >
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {formatDateValue(
                        item.reading_date
                      ) ||
                        item.reading_date}
                    </p>
                    {item.equipment_id !==
                    null ? (
                      <Link
                        href={`/equipment/${item.equipment_id}`}
                        className="mt-1 inline-flex min-h-11 max-w-full items-center rounded-sm break-words [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background font-semibold text-primary hover:underline"
                      >
                        {equipmentName}
                      </Link>
                    ) : (
                      <p className="mt-1 break-words [overflow-wrap:anywhere] font-semibold text-foreground">
                        {equipmentName}
                      </p>
                    )}
                  </div>

                  <span className="vc-status-success w-fit max-w-full tabular-nums">
                    {formatDuration(
                      item.delta
                    )}
                  </span>
                </div>

                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                        className="mt-1 inline-flex min-h-11 max-w-full items-center rounded-sm break-words [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background text-sm font-medium text-primary hover:underline"
                      >
                        {employeeName}
                      </Link>
                    ) : (
                      <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
                        {employeeName}
                      </p>
                    )
                  ) : (
                    canViewObjectProfiles &&
                    item.object_id !==
                      null ? (
                      <Link
                        href={`/objects/${item.object_id}`}
                        className="mt-1 inline-flex min-h-11 max-w-full items-center rounded-sm break-words [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background text-sm font-medium text-primary hover:underline"
                      >
                        {objectName}
                      </Link>
                    ) : (
                      <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
                        {objectName}
                      </p>
                    )
                  )}
                </div>

                {item.note && (
                  <div className="mt-3 rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Примітка
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-5 text-muted-foreground">
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
