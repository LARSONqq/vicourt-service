import Link from "next/link";

import {
  equipmentCategories,
  equipmentStatuses,
} from "@/constants/equipment";

import type {
  EquipmentDirectoryFilters as DirectoryFilters,
} from "@/types/equipmentProfile";

export function EquipmentDirectoryFilters({
  filters,
}: {
  filters: DirectoryFilters;
}) {
  const hasFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.category
  );

  return (
    <form
      action="/equipment"
      method="get"
      className="vc-surface min-w-0 space-y-3 p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_210px_230px_auto] lg:gap-3 lg:space-y-0"
    >
      <label className="min-w-0">
        <span className="sr-only">
          Пошук техніки
        </span>
        <input
          type="search"
          name="q"
          defaultValue={
            filters.search || ""
          }
          maxLength={100}
          placeholder="Назва або інвентарний номер"
          className="vc-field min-h-11 min-w-0 px-4 py-3"
        />
      </label>

      <details className="group min-w-0 lg:contents" open={hasFilters || undefined}>
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden lg:hidden">
          <span>Фільтри</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {hasFilters ? "Активні" : "Не застосовані"}
            <span aria-hidden="true" className="transition group-open:rotate-180">⌄</span>
          </span>
        </summary>

        <div className="mt-3 hidden min-w-0 grid-cols-1 gap-3 group-open:grid lg:col-span-3 lg:mt-0 lg:grid lg:grid-cols-[210px_230px_auto]">
          <label className="min-w-0">
            <span className="sr-only">Статус техніки</span>
            <select name="status" defaultValue={filters.status || ""} className="vc-field min-h-11 min-w-0 py-3">
              <option value="">Усі статуси</option>
              {equipmentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Категорія техніки</span>
            <select name="category" defaultValue={filters.category || ""} className="vc-field min-h-11 min-w-0 py-3">
              <option value="">Усі категорії</option>
              {equipmentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2 lg:flex">
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Застосувати
        </button>

        {hasFilters ? (
          <Link
            href="/equipment"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Скинути
          </Link>
        ) : (
          <span />
        )}
          </div>
        </div>
      </details>
    </form>
  );
}

export function getEquipmentDirectoryPageHref(
  filters: DirectoryFilters,
  page: number
) {
  const params =
    new URLSearchParams();

  if (filters.search) {
    params.set(
      "q",
      filters.search
    );
  }
  if (filters.status) {
    params.set(
      "status",
      filters.status
    );
  }
  if (filters.category) {
    params.set(
      "category",
      filters.category
    );
  }
  if (page > 1) {
    params.set(
      "page",
      String(page)
    );
  }

  const query = params.toString();

  return query
    ? `/equipment?${query}`
    : "/equipment";
}

export function EquipmentDirectoryPagination({
  filters,
  page,
  pageSize,
  total,
  hasPreviousPage,
  hasNextPage,
}: {
  filters: DirectoryFilters;
  page: number;
  pageSize: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
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
      aria-label="Сторінки техніки"
      className="vc-surface flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-center text-xs text-gray-500 sm:text-left sm:text-sm">
        {hasVisibleItems
          ? `Показано ${from}–${to} із ${total}`
          : "На цій сторінці техніки немає"}
      </p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {hasPreviousPage ? (
          <Link
            href={getEquipmentDirectoryPageHref(
              filters,
              page - 1
            )}
            scroll={false}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-xs transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
          >
            ← Назад
          </Link>
        ) : (
          <span />
        )}

        <span className="px-1 text-center text-xs font-medium text-gray-500 sm:text-sm">
          {page}
        </span>

        {hasNextPage ? (
          <Link
            href={getEquipmentDirectoryPageHref(
              filters,
              page + 1
            )}
            scroll={false}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-xs transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
          >
            Далі →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  );
}
