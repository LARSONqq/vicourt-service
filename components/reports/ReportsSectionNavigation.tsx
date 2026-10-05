import Link from "next/link";

import {
  createReportExportSearchParams,
} from "@/lib/reportExportParams";

import type {
  ReportsFilters,
  ReportsSection,
} from "@/types/report";

type Props = {
  activeSection: ReportsSection;
  filters: ReportsFilters;
};

const sectionItems: Array<{
  value: ReportsSection;
  label: string;
}> = [
  {
    value: "overview",
    label: "Огляд",
  },
  {
    value: "objects",
    label: "Об’єкти",
  },
  {
    value: "workforce",
    label: "Команда",
  },
  {
    value: "cashflow",
    label: "Фінанси",
  },
  {
    value: "warehouse",
    label: "Склад",
  },
  {
    value: "equipment",
    label: "Техніка",
  },
];

function createSectionHref(
  section: ReportsSection,
  filters: ReportsFilters
) {
  const params =
    createReportExportSearchParams(
      filters
    );

  params.set("section", section);

  return `/reports?${params.toString()}`;
}

export default function ReportsSectionNavigation({
  activeSection,
  filters,
}: Props) {
  return (
    <nav
      aria-label="Розділи звітів"
      className="min-w-0 overflow-x-auto rounded-xl border bg-white p-1.5"
    >
      <div className="flex min-w-max gap-1">
        {sectionItems.map(
          (item) => {
            const isActive =
              item.value ===
              activeSection;

            return (
              <Link
                key={item.value}
                href={createSectionHref(
                  item.value,
                  filters
                )}
                aria-current={
                  isActive
                    ? "page"
                    : undefined
                }
                className={`flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          }
        )}
      </div>
    </nav>
  );
}
