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
      className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_210px_230px_auto]"
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
          className="min-h-11 w-full min-w-0 rounded-lg border px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </label>

      <label className="min-w-0">
        <span className="sr-only">
          Статус техніки
        </span>
        <select
          name="status"
          defaultValue={
            filters.status || ""
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          <option value="">
            Усі статуси
          </option>
          {equipmentStatuses.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            )
          )}
        </select>
      </label>

      <label className="min-w-0">
        <span className="sr-only">
          Категорія техніки
        </span>
        <select
          name="category"
          defaultValue={
            filters.category || ""
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          <option value="">
            Усі категорії
          </option>
          {equipmentCategories.map(
            (category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            )
          )}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2 lg:flex">
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          Застосувати
        </button>

        {hasFilters ? (
          <Link
            href="/equipment"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Скинути
          </Link>
        ) : (
          <span />
        )}
      </div>
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
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
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
            className="inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:px-4"
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
            className="inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:px-4"
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
