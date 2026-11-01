import Link from "next/link";

export type EmployeeTabId =
  | "overview"
  | "tasks"
  | "work"
  | "objects"
  | "equipment"
  | "history";

type PaginationParam =
  | "page"
  | "workPage"
  | "changesPage"
  | "actionsPage";

const employeeTabs: Array<{
  id: EmployeeTabId;
  label: string;
  icon: string;
}> = [
  {
    id: "overview",
    label: "Огляд",
    icon: "◉",
  },
  {
    id: "tasks",
    label: "Завдання",
    icon: "✓",
  },
  {
    id: "work",
    label: "Роботи",
    icon: "📝",
  },
  {
    id: "objects",
    label: "Об’єкти",
    icon: "🏡",
  },
  {
    id: "equipment",
    label: "Техніка",
    icon: "🛠",
  },
  {
    id: "history",
    label: "Історія",
    icon: "🕘",
  },
];

export const EMPLOYEE_TAB_IDS =
  employeeTabs.map((tab) => tab.id);

export function EmployeePassportTabs({
  employeeId,
  activeTab,
}: {
  employeeId: number;
  activeTab: EmployeeTabId;
}) {
  return (
    <nav
      aria-label="Розділи паспорта працівника"
      className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:px-0"
    >
      <div className="vc-surface flex min-w-max gap-1.5 p-1.5">
        {employeeTabs.map((tab) => {
          const isActive =
            activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={`/employees/${employeeId}?tab=${tab.id}`}
              scroll={false}
              aria-current={
                isActive
                  ? "page"
                  : undefined
              }
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 sm:px-4 ${
                isActive
                  ? "bg-green-700 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <span aria-hidden="true">
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function getPageHref(
  employeeId: number,
  tab: EmployeeTabId,
  parameter: PaginationParam,
  page: number,
  preservedPage?: number
) {
  const params =
    new URLSearchParams({ tab });

  if (page > 1) {
    params.set(
      parameter,
      String(page)
    );
  }

  if (
    tab === "equipment" &&
    preservedPage &&
    preservedPage > 1
  ) {
    params.set(
      parameter === "workPage"
        ? "page"
        : "workPage",
      String(preservedPage)
    );
  }

  if (
    tab === "history" &&
    preservedPage &&
    preservedPage > 1
  ) {
    params.set(
      parameter === "changesPage"
        ? "actionsPage"
        : "changesPage",
      String(preservedPage)
    );
  }

  return `/employees/${employeeId}?${params.toString()}`;
}

export function EmployeeTabPagination({
  employeeId,
  tab,
  parameter = "page",
  page,
  pageSize,
  total,
  hasPreviousPage,
  hasNextPage,
  preservedPage,
}: {
  employeeId: number;
  tab: EmployeeTabId;
  parameter?: PaginationParam;
  page: number;
  pageSize: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  preservedPage?: number;
}) {
  if (
    !hasPreviousPage &&
    !hasNextPage
  ) {
    return null;
  }

  const firstItemIndex =
    (page - 1) * pageSize;
  const hasVisibleItems =
    total > 0 &&
    firstItemIndex < total;
  const from = hasVisibleItems
    ? firstItemIndex + 1
    : 0;
  const to = hasVisibleItems
    ? Math.min(
        page * pageSize,
        total
      )
    : 0;

  return (
    <nav
      aria-label="Сторінки розділу працівника"
      className="vc-surface mt-4 flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-center text-xs text-gray-500 sm:text-left sm:text-sm">
        {hasVisibleItems
          ? `Показано ${from}–${to} із ${total}`
          : "На цій сторінці записів немає"}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        {hasPreviousPage ? (
          <Link
            href={getPageHref(
              employeeId,
              tab,
              parameter,
              page - 1,
              preservedPage
            )}
            scroll={false}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            ← Назад
          </Link>
        ) : (
          <span />
        )}

        {hasNextPage && (
          <Link
            href={getPageHref(
              employeeId,
              tab,
              parameter,
              page + 1,
              preservedPage
            )}
            scroll={false}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            Далі →
          </Link>
        )}
      </div>
    </nav>
  );
}
