import Link from "next/link";

import type {
  EquipmentTabId,
} from "@/components/equipment/EquipmentPassportSections";

type PaginatedEquipmentTab = Exclude<
  EquipmentTabId,
  "overview"
>;

type Props = {
  equipmentId: number;
  tab: PaginatedEquipmentTab;
  page: number;
  pageSize: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

function getPageHref(
  equipmentId: number,
  tab: PaginatedEquipmentTab,
  page: number
) {
  const params =
    new URLSearchParams({ tab });

  if (page > 1) {
    params.set(
      "page",
      String(page)
    );
  }

  return `/equipment/${equipmentId}?${params.toString()}`;
}

export default function EquipmentTabPagination({
  equipmentId,
  tab,
  page,
  pageSize,
  total,
  hasPreviousPage,
  hasNextPage,
}: Props) {
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
  const buttonClasses =
    "inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium";

  return (
    <nav
      aria-label="Сторінки розділу техніки"
      className="mt-4 flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-center text-xs text-gray-500 sm:text-left sm:text-sm">
        Сторінка {page}
        <span aria-hidden="true">
          {" · "}
        </span>
        {hasVisibleItems
          ? `Записи ${from}–${to} із ${total}`
          : "Записів немає"}
      </p>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex">
        {hasPreviousPage ? (
          <Link
            href={getPageHref(
              equipmentId,
              tab,
              page - 1
            )}
            scroll={false}
            className={`${buttonClasses} text-gray-700 transition hover:bg-gray-50`}
          >
            ← Назад
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={`${buttonClasses} cursor-not-allowed bg-gray-50 text-gray-400`}
          >
            ← Назад
          </button>
        )}

        {hasNextPage ? (
          <Link
            href={getPageHref(
              equipmentId,
              tab,
              page + 1
            )}
            scroll={false}
            className={`${buttonClasses} text-gray-700 transition hover:bg-gray-50`}
          >
            Далі →
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={`${buttonClasses} cursor-not-allowed bg-gray-50 text-gray-400`}
          >
            Далі →
          </button>
        )}
      </div>
    </nav>
  );
}
