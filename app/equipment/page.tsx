import {
  redirect,
} from "next/navigation";
import {
  Suspense,
} from "react";

import EquipmentActions from "@/components/equipment/EquipmentActions";
import {
  EquipmentDirectoryFilters,
  EquipmentDirectoryPagination,
  getEquipmentDirectoryPageHref,
} from "@/components/equipment/EquipmentDirectoryNavigation";
import EquipmentList from "@/components/equipment/EquipmentList";
import EquipmentMaintenancePanel from "@/components/equipment/EquipmentMaintenancePanel";
import {
  equipmentCategories,
  equipmentStatuses,
} from "@/constants/equipment";
import {
  canManageEquipment,
} from "@/lib/auth/permissions";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  getEmployees,
} from "@/services/employeeService";
import {
  getEquipmentDirectoryPage,
  getEquipmentDirectoryStats,
} from "@/services/equipmentService";
import {
  getAppSettings,
} from "@/services/settingsService";

import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  Employee,
} from "@/types/employee";
import type {
  EquipmentDirectoryFilters as DirectoryFilters,
} from "@/types/equipmentProfile";

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  category?: string | string[];
  page?: string | string[];
};

type Props = {
  searchParams: Promise<SearchParams>;
};

function getSingleSearchValue(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function resolvePage(
  value: string | undefined
) {
  if (
    !value ||
    !/^\d+$/u.test(value)
  ) {
    return 1;
  }

  const page = Number(value);

  return Number.isSafeInteger(page) &&
    page > 0
    ? page
    : 1;
}

function resolveFilters(
  query: SearchParams
): DirectoryFilters {
  const search =
    getSingleSearchValue(query.q)
      ?.trim()
      .slice(0, 100) || "";
  const rawStatus =
    getSingleSearchValue(
      query.status
    );
  const rawCategory =
    getSingleSearchValue(
      query.category
    );
  const status =
    rawStatus &&
    equipmentStatuses.includes(
      rawStatus as (typeof equipmentStatuses)[number]
    )
      ? rawStatus
      : undefined;
  const category =
    rawCategory &&
    equipmentCategories.includes(
      rawCategory as (typeof equipmentCategories)[number]
    )
      ? rawCategory
      : undefined;

  return {
    search:
      search || undefined,
    status,
    category,
  };
}

function DirectoryLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-pulse space-y-4"
    >
      <span className="sr-only">
        Завантаження техніки…
      </span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-xl border bg-gray-50"
          />
        ))}
      </div>
      <div className="h-80 rounded-xl border bg-gray-50" />
    </div>
  );
}

async function EquipmentDirectoryContent({
  filters,
  page,
  canManage,
  employees,
  currency,
  today,
}: {
  filters: DirectoryFilters;
  page: number;
  canManage: boolean;
  employees: Employee[];
  currency: AppCurrency;
  today: string;
}) {
  const [equipmentPage, stats] =
    await Promise.all([
      getEquipmentDirectoryPage(
        filters,
        page
      ),
      getEquipmentDirectoryStats(
        today
      ),
    ]);

  if (
    page > 1 &&
    equipmentPage.items.length === 0
  ) {
    const lastPage = Math.max(
      1,
      Math.ceil(
        equipmentPage.total /
          equipmentPage.pageSize
      )
    );

    redirect(
      getEquipmentDirectoryPageHref(
        filters,
        lastPage
      )
    );
  }

  const hasFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.category
  );

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          [
            "Усього техніки",
            stats.total,
            "text-gray-900",
          ],
          [
            "Справна та в роботі",
            stats.working,
            "text-green-700",
          ],
          [
            "Потребує ремонту",
            stats.repair,
            stats.repair > 0
              ? "text-orange-600"
              : "text-gray-900",
          ],
          [
            "Техніка потребує ТО",
            stats.maintenanceAttention,
            stats.maintenanceAttention >
              0
              ? "text-red-600"
              : "text-gray-900",
          ],
        ].map(
          ([label, value, className]) => (
            <div
              key={label}
              className="min-w-0 rounded-xl border bg-white p-3 sm:p-5"
            >
              <p className="text-xs leading-4 text-gray-500 sm:text-sm">
                {label}
              </p>
              <p
                className={`mt-2 text-2xl font-bold sm:text-3xl ${className}`}
              >
                {value}
              </p>
            </div>
          )
        )}
      </div>

      <EquipmentList
        equipment={
          equipmentPage.items
        }
        employees={employees}
        total={equipmentPage.total}
        hasFilters={hasFilters}
        canManage={canManage}
        today={today}
      />

      <EquipmentDirectoryPagination
        filters={filters}
        {...equipmentPage}
      />

      {equipmentPage.items.length >
        0 && (
        <EquipmentMaintenancePanel
          equipment={
            equipmentPage.items
          }
          currency={currency}
          canManage={canManage}
          today={today}
        />
      )}
    </div>
  );
}

export default async function EquipmentPage({
  searchParams,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "equipment"
    );
  const query = await searchParams;
  const canManage =
    canManageEquipment(
      currentProfile.role
    );
  const filters =
    resolveFilters(query);
  const page = resolvePage(
    getSingleSearchValue(
      query.page
    )
  );
  const today =
    getKyivDateValue();
  const [employees, settings] =
    await Promise.all([
      canManage
        ? getEmployees()
        : Promise.resolve([]),
      getAppSettings(),
    ]);

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Техніка
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500 sm:text-base sm:leading-6">
            Облік обладнання, стану,
            ремонтів і сервісного
            обслуговування
          </p>
        </div>

        {canManage && (
          <div className="min-w-0">
            <EquipmentActions
              employees={employees}
              currency={
                settings.currency
              }
              today={today}
            />
          </div>
        )}
      </div>

      {!canManage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm">
              👁
            </div>
            <div className="min-w-0">
              <p className="font-medium text-blue-800">
                Режим перегляду
              </p>
              <p className="mt-1 text-sm leading-5 text-blue-700">
                Ти можеш переглядати
                техніку та її стан.
                Додавати, редагувати та
                видаляти техніку може
                лише адміністратор.
              </p>
            </div>
          </div>
        </div>
      )}

      <EquipmentDirectoryFilters
        filters={filters}
      />

      <Suspense
        key={`${filters.search || ""}:${filters.status || ""}:${filters.category || ""}:${page}`}
        fallback={<DirectoryLoading />}
      >
        <EquipmentDirectoryContent
          filters={filters}
          page={page}
          canManage={canManage}
          employees={employees}
          currency={
            settings.currency
          }
          today={today}
        />
      </Suspense>
    </div>
  );
}
