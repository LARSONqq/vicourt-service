import ReportsDashboard from "@/components/reports/ReportsDashboard";
import ReportExportButtons, {
  type ReportExportGroup,
} from "@/components/reports/ReportExportButtons";
import ReportsFilters from "@/components/reports/ReportsFilters";
import ReportsSectionNavigation from "@/components/reports/ReportsSectionNavigation";

import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  createReportExportSearchParams,
} from "@/lib/reportExportParams";
import {
  normalizeReportsSection,
} from "@/lib/reportSections";

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
  section?: string | string[];
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
    createReportExportSearchParams(
      filters
    );

  params.set("type", type);

  return `/reports/export?${params.toString()}`;
}

function createExcelExportHref(
  filters: ReportsFilterState
) {
  const params =
    createReportExportSearchParams(
      filters
    );

  return `/reports/export/excel?${params.toString()}`;
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
  const section =
    normalizeReportsSection(
      getParam(params.section)
    );

  const settings =
    await getAppSettings();
  let data = null;

  try {
    data = await getReportsData(
      filters,
      [section]
    );
  } catch (error) {
    console.error(
      "Не вдалося завантажити розділ звітів:",
      error instanceof Error
        ? error.message
        : error
    );
  }

  const exportGroups = [
    {
      title:
        "Аналітичні звіти",
      description:
        "Дані з урахуванням вибраних фільтрів і періоду.",
      items: [
        {
          title:
            "Підсумок за період",
          href:
            createPeriodExportHref(
              "summary",
              filters
            ),
          note:
            "KPI та метод обліку матеріалів",
        },
        {
          title:
            "Витрати по об’єктах",
          href:
            createPeriodExportHref(
              "object-costs",
              filters
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
              filters
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
              filters
            ),
          note:
            "За вибраний період",
        },
        {
          title:
            "Платежі клієнтів",
          href:
            createPeriodExportHref(
              "client-payments",
              filters
            ),
          note:
            "За вибраний період",
        },
        {
          title: "Графік оплат",
          href:
            createPeriodExportHref(
              "payment-schedule",
              filters
            ),
          note:
            "За датою платежу",
        },
        {
          title:
            "Закупівлі за період",
          href:
            createPeriodExportHref(
              "purchases",
              filters
            ),
          note:
            "За вибраний період",
        },
        {
          title:
            "Рух матеріалів за період",
          href:
            createPeriodExportHref(
              "warehouse-movements",
              filters
            ),
          note:
            "Ledger, snapshots і метод обліку",
        },
        {
          title:
            "Витрати на техніку",
          href:
            createPeriodExportHref(
              "equipment-costs",
              filters
            ),
          note:
            "ТО, ремонти та інший сервіс",
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
            "Уся історія, включно з анульованими",
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
        filters={filters}
        objects={
          data?.objectOptions || []
        }
        employees={
          data?.employeeOptions || []
        }
        section={section}
      />

      <ReportsSectionNavigation
        activeSection={section}
        filters={filters}
      />

      {data ? (
        <ReportsDashboard
          data={data}
          section={section}
        />
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          <h2 className="font-semibold">
            Не вдалося завантажити цей розділ звітів
          </h2>
          <p className="mt-1">
            Спробуй оновити сторінку. Інші розділи звітів залишаються доступними через навігацію вище.
          </p>
        </section>
      )}

      {data && (
      <ReportExportButtons
        excelExport={{
          title:
            "Завантажити Excel",
          href:
            createExcelExportHref(
              filters
            ),
          note:
            "Один файл із 11 вкладками",
        }}
        groups={exportGroups}
      />
      )}
    </div>
  );
}
