import ReportsDashboard from "@/components/reports/ReportsDashboard";
import ReportExportButtons, {
  type ReportExportGroup,
} from "@/components/reports/ReportExportButtons";
import ReportsFilters from "@/components/reports/ReportsFilters";

import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";

import {
  getReportsData,
  normalizeReportsFilters,
} from "@/services/reportService";

import {
  getAppSettings,
} from "@/services/settingsService";

import type {
  ReportsFilters as ReportsFilterState,
} from "@/types/report";

type SearchParams = {
  from?: string | string[];
  to?: string | string[];
  object?: string | string[];
  employee?: string | string[];
  expense_category?:
    | string
    | string[];
  movement_type?:
    | string
    | string[];
};

type Props = {
  searchParams: Promise<
    SearchParams
  >;
};

function getParam(
  value:
    | string
    | string[]
    | undefined
) {
  return (
    Array.isArray(value)
      ? value[0]
      : value
  )
    ?.trim() || "";
}

function createPeriodExportHref(
  type: string,
  filters: ReportsFilterState
) {
  const params =
    new URLSearchParams({
      type,
      from: filters.dateFrom,
      to: filters.dateTo,
    });

  if (filters.objectId) {
    params.set(
      "object",
      String(filters.objectId)
    );
  }

  if (filters.employeeId) {
    params.set(
      "employee",
      String(
        filters.employeeId
      )
    );
  }

  if (
    filters.expenseCategory
  ) {
    params.set(
      "expense_category",
      filters.expenseCategory
    );
  }

  if (filters.movementType) {
    params.set(
      "movement_type",
      filters.movementType
    );
  }

  return `/reports/export?${params.toString()}`;
}

export const dynamic =
  "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: Props) {
  await requireSectionAccess(
    "reports"
  );

  const params =
    await searchParams;

  const filters =
    normalizeReportsFilters({
      from:
        getParam(params.from),
      to:
        getParam(params.to),
      object:
        getParam(
          params.object
        ),
      employee:
        getParam(
          params.employee
        ),
      expenseCategory:
        getParam(
          params.expense_category
        ),
      movementType:
        getParam(
          params.movement_type
        ),
    });

  const [data, settings] =
    await Promise.all([
      getReportsData(filters),
      getAppSettings(),
    ]);

  const exportGroups = [
    {
      title:
        "Аналітичні звіти",
      description:
        "Дані з урахуванням вибраних фільтрів і періоду.",
      items: [
        {
          title:
            "Витрати по об’єктах",
          href:
            createPeriodExportHref(
              "object-costs",
              data.filters
            ),
          note:
            "За вибраний період",
        },
        {
          title:
            "Робота працівників",
          href:
            createPeriodExportHref(
              "employee-work",
              data.filters
            ),
          note:
            "За вибраний період",
        },
        {
          title:
            "Інші витрати за категоріями",
          href:
            createPeriodExportHref(
              "expense-categories",
              data.filters
            ),
          note:
            "За вибраний період",
        },
        {
          title:
            "Закупівлі за період",
          href:
            createPeriodExportHref(
              "purchases",
              data.filters
            ),
          note:
            "За вибраний період",
        },
        {
          title:
            "Рухи складу за період",
          href:
            createPeriodExportHref(
              "warehouse-movements",
              data.filters
            ),
          note:
            "За вибраний період",
        },
      ],
    },
    {
      title:
        "Операційні дані",
      description:
        "Актуальні довідники та поточний стан системи.",
      items: [
        {
          title: "Об’єкти",
          href:
            "/reports/export?type=objects",
          note:
            "Поточний стан",
        },
        {
          title:
            "Поточний стан складу",
          href:
            "/reports/export?type=warehouse-current",
          note:
            "Поточний стан",
        },
        {
          title: "Техніка",
          href:
            "/reports/export?type=equipment",
          note:
            "Поточний стан",
        },
        {
          title:
            "Обслуговування техніки",
          href:
            "/reports/export?type=equipment-service",
          note:
            "Уся історія",
        },
        {
          title:
            "Працівники",
          href:
            "/reports/export?type=employees",
          note:
            "Поточний стан",
        },
      ],
    },
  ] satisfies ReportExportGroup[];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Звіти
        </h1>

        <p className="mt-1 break-words text-sm leading-5 text-gray-500 sm:text-base">
          Управлінський звіт по
          об’єктах, роботах,
          матеріалах, витратах,
          закупівлях і складу для{" "}
          {settings.company_name}
        </p>
      </div>

      <ReportsFilters
        filters={data.filters}
        objects={
          data.objectOptions
        }
        employees={
          data.employeeOptions
        }
      />

      <ReportsDashboard
        data={data}
      />

      <ReportExportButtons
        groups={exportGroups}
      />
    </div>
  );
}
