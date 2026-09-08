import Link from "next/link";

import {
  formatEquipmentUsage,
  getEquipmentDateMaintenanceLabel,
  getEquipmentMaintenanceOverallKind,
  getEquipmentMaintenanceOverallLabel,
  getEquipmentUsageMaintenanceLabel,
  getEquipmentUsageTypeLabel,
} from "@/lib/equipmentMaintenance";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  EquipmentOverviewPreview,
} from "@/types/equipmentProfile";
import type {
  ReactNode,
} from "react";

type Props = {
  overview: EquipmentOverviewPreview;
  currency: AppCurrency;
};

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatDate(
  value: string | null
) {
  return (
    formatDateValue(value) ||
    "Не вказано"
  );
}

function getMaintenanceClasses(
  kind: ReturnType<
    typeof getEquipmentMaintenanceOverallKind
  >
) {
  switch (kind) {
    case "overdue":
    case "due":
      return "border-red-200 bg-red-50 text-red-700";
    case "today":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "scheduled":
      return "border-green-200 bg-green-50 text-green-700";
    case "unconfigured":
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function KpiCard({
  label,
  value,
  detail,
  children,
  className = "",
}: {
  label: string;
  value: string;
  detail?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`min-w-0 rounded-xl border bg-white p-4 sm:p-5 ${className}`}
    >
      <p className="text-xs font-medium text-gray-500 sm:text-sm">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-bold text-gray-900 sm:text-2xl">
        {value}
      </p>
      {detail && (
        <p className="mt-1.5 break-words text-xs leading-5 text-gray-500 sm:text-sm">
          {detail}
        </p>
      )}
      {children}
    </article>
  );
}

export default function EquipmentOverview({
  overview,
  currency,
}: Props) {
  const {
    equipment,
    maintenance,
    kpis,
  } = overview;
  const evaluation =
    maintenance.evaluation;
  const maintenanceKind =
    getEquipmentMaintenanceOverallKind(
      evaluation
    );
  const usageEnabled =
    equipment.usage_type !== "none";
  const nextThreshold = usageEnabled
    ? formatEquipmentUsage(
        equipment.next_maintenance_usage,
        equipment.usage_type
      )
    : "Не налаштовано";
  const hasUsageThreshold =
    usageEnabled &&
    equipment.next_maintenance_usage !==
      null;
  const lastService =
    kpis.lastService;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <section className="min-w-0">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Огляд
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            Поточний стан, напрацювання та готовність до технічного обслуговування.
          </p>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Стан планового ТО"
            value={getEquipmentMaintenanceOverallLabel(
              evaluation
            )}
            detail={getEquipmentDateMaintenanceLabel(
              equipment,
              maintenance.today
            )}
            className={getMaintenanceClasses(
              maintenanceKind
            )}
          >
            {usageEnabled && (
              <p className="mt-2 break-words text-xs leading-5 opacity-80 sm:text-sm">
                {getEquipmentUsageMaintenanceLabel(
                  equipment
                )}
              </p>
            )}
          </KpiCard>

          <KpiCard
            label="Поточне напрацювання"
            value={
              usageEnabled
                ? formatEquipmentUsage(
                    equipment.current_usage,
                    equipment.usage_type
                  )
                : "Не ведеться"
            }
            detail={getEquipmentUsageTypeLabel(
              equipment.usage_type
            )}
          />

          <KpiCard
            label="Наступне ТО"
            value={
              equipment.next_service_date
                ? formatDate(
                    equipment.next_service_date
                  )
                : hasUsageThreshold
                  ? nextThreshold
                  : "Не заплановано"
            }
            detail={
              equipment.next_service_date &&
              hasUsageThreshold
                ? `За напрацюванням: ${nextThreshold}`
                : hasUsageThreshold
                  ? "ТО за напрацюванням"
                  : "Дата й поріг напрацювання не задані"
            }
          />

          <KpiCard
            label="Активні завдання"
            value={String(
              kpis.openTasks
            )}
            detail={
              kpis.overdueTasks > 0
                ? `Прострочено: ${kpis.overdueTasks}`
                : "Прострочених завдань немає"
            }
          >
            {kpis.activeMaintenanceTask && (
              <Link
                href="/task"
                className="mt-3 inline-flex break-words text-sm font-medium text-green-700 hover:underline"
              >
                Відкрити завдання ТО →
              </Link>
            )}
          </KpiCard>

          <KpiCard
            label="Записи обслуговування"
            value={String(
              kpis.serviceCount
            )}
            detail="Активні, без анульованих записів"
          />

          <KpiCard
            label="Останнє обслуговування"
            value={
              lastService
                ? formatDate(
                    lastService.service_date
                  )
                : "Ще не було"
            }
            detail={
              lastService
                ? lastService.service_type
                : "Активних сервісних записів немає"
            }
          />

          {kpis.serviceCosts && (
            <>
              <KpiCard
                label="Витрати на сервіс"
                value={formatMoney(
                  kpis.serviceCosts.total,
                  currency
                )}
                detail="Неанульовані записи за весь час"
              />
              <KpiCard
                label={`Витрати за ${kpis.serviceCosts.yearStart.slice(
                  0,
                  4
                )} рік`}
                value={formatMoney(
                  kpis.serviceCosts.currentYear,
                  currency
                )}
                detail="Неанульовані записи поточного року"
              />
            </>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Основна інформація
        </h2>

        <dl className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">
              Дата придбання
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-gray-800">
              {formatDate(
                equipment.purchase_date
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">
              Періодичність за датою
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-gray-800">
              {equipment.maintenance_interval_days
                ? `Кожні ${equipment.maintenance_interval_days} днів`
                : "Не налаштовано"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">
              Останнє планове ТО
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-gray-800">
              {formatDate(
                equipment.last_maintenance_date
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">
              Періодичність за напрацюванням
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-gray-800">
              {usageEnabled
                ? formatEquipmentUsage(
                    equipment.maintenance_interval_usage,
                    equipment.usage_type
                  )
                : "Не використовується"}
            </dd>
          </div>
        </dl>

        {equipment.notes && (
          <div className="mt-5 border-t pt-4">
            <p className="text-xs text-gray-500">
              Примітки
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
              {equipment.notes}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
