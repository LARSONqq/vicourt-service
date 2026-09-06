import {
  Suspense,
} from "react";

import EmployeeActions from "@/components/employees/EmployeeActions";
import {
  EmployeeDirectoryFilters,
  EmployeeDirectoryPagination,
} from "@/components/employees/EmployeeDirectoryNavigation";
import EmployeeList from "@/components/employees/EmployeeList";
import {
  employeeStatuses,
  employmentTypes,
} from "@/constants/employees";
import {
  canManageEmployees,
} from "@/lib/auth/permissions";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  getEmployeeDirectoryWorkloads,
} from "@/services/employeeDetailService";
import {
  getManagementEmployeeDirectoryStats,
  getManagementEmployeesPage,
} from "@/services/employeeService";

import type {
  EmployeeStatus,
  EmploymentType,
} from "@/types/employee";
import type {
  EmployeeDirectoryFilters as DirectoryFilters,
  EmployeeDirectoryItem,
} from "@/types/employeeProfile";

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  type?: string | string[];
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
  if (!value || !/^\d+$/u.test(value)) {
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
  const rawSearch =
    getSingleSearchValue(query.q)
      ?.trim()
      .slice(0, 100) || "";
  const rawStatus =
    getSingleSearchValue(
      query.status
    );
  const rawEmploymentType =
    getSingleSearchValue(query.type);
  const status =
    rawStatus &&
    employeeStatuses.includes(
      rawStatus as EmployeeStatus
    )
      ? (rawStatus as EmployeeStatus)
      : undefined;
  const employmentType =
    rawEmploymentType &&
    employmentTypes.includes(
      rawEmploymentType as EmploymentType
    )
      ? (rawEmploymentType as EmploymentType)
      : undefined;

  return {
    search: rawSearch || undefined,
    status,
    employmentType,
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
        Завантаження працівників…
      </span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <div
              key={index}
              className="h-24 rounded-xl border bg-gray-50"
            />
          )
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 3 }).map(
          (_, index) => (
            <div
              key={index}
              className="h-64 rounded-xl border bg-gray-50"
            />
          )
        )}
      </div>
    </div>
  );
}

async function EmployeeDirectoryContent({
  filters,
  page,
  canManage,
}: {
  filters: DirectoryFilters;
  page: number;
  canManage: boolean;
}) {
  const [employeePage, stats] =
    await Promise.all([
      getManagementEmployeesPage(
        filters,
        page,
        canManage
      ),
      getManagementEmployeeDirectoryStats(),
    ]);
  const workloads =
    await getEmployeeDirectoryWorkloads(
      employeePage.items.map(
        (employee) => employee.id
      )
    );
  const employees: EmployeeDirectoryItem[] =
    employeePage.items;
  const hasFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.employmentType
  );

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          ["Усього працівників", stats.total, "text-gray-900"],
          ["Активні", stats.active, "text-green-700"],
          ["Тимчасово відсутні", stats.unavailable, stats.unavailable > 0 ? "text-orange-600" : "text-gray-900"],
          ["Підрядники", stats.contractors, "text-blue-700"],
        ].map(([label, value, className]) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border bg-white p-3 sm:p-5"
          >
            <p className="text-xs leading-4 text-gray-500 sm:text-sm">
              {label}
            </p>
            <p className={`mt-2 text-2xl font-bold sm:text-3xl ${className}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <EmployeeList
        employees={employees}
        workloads={workloads}
        total={employeePage.total}
        hasFilters={hasFilters}
        canManage={canManage}
      />

      <EmployeeDirectoryPagination
        filters={filters}
        {...employeePage}
      />
    </div>
  );
}

export default async function EmployeesPage({
  searchParams,
}: Props) {
  const currentProfile =
    await requireSectionAccess(
      "employees"
    );
  const query = await searchParams;
  const canManage = canManageEmployees(
    currentProfile.role
  );
  const filters = resolveFilters(query);
  const page = resolvePage(
    getSingleSearchValue(query.page)
  );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Працівники
          </h1>
          <p className="mt-1 text-sm leading-5 text-gray-500 sm:text-base">
            Команда, контакти, посади та статуси роботи
          </p>
        </div>
        {canManage && (
          <div className="min-w-0">
            <EmployeeActions />
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
                Ти можеш переглядати працівників та їхню інформацію. Додавати, редагувати або видаляти працівників може лише адміністратор.
              </p>
            </div>
          </div>
        </div>
      )}

      <EmployeeDirectoryFilters
        filters={filters}
      />

      <Suspense
        key={`${filters.search || ""}:${filters.status || ""}:${filters.employmentType || ""}:${page}`}
        fallback={<DirectoryLoading />}
      >
        <EmployeeDirectoryContent
          filters={filters}
          page={page}
          canManage={canManage}
        />
      </Suspense>
    </div>
  );
}
