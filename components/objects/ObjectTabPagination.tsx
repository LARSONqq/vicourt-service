import Link from "next/link";

import type {
  ObjectTabId,
} from "@/components/ObjectTabs";

type Props = {
  objectId: number;
  tab: ObjectTabId;
  page: number;
  pageSize: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

function getPageHref(
  objectId: number,
  tab: ObjectTabId,
  page: number
) {
  const params =
    new URLSearchParams({
      tab,
    });

  if (page > 1) {
    params.set(
      "page",
      String(page)
    );
  }

  return `/objects/${objectId}?${params.toString()}`;
}

export default function ObjectTabPagination({
  objectId,
  tab,
  page,
  pageSize,
  total,
  hasPreviousPage,
  hasNextPage,
}: Props) {
  if (
    !hasPreviousPage &&
    !hasNextPage
  ) {
    return null;
  }

  const from =
    total === 0
      ? 0
      : (page - 1) *
          pageSize +
        1;
  const to = Math.min(
    page * pageSize,
    total
  );

  return (
    <nav
      aria-label="Сторінки розділу об’єкта"
      className="mt-4 flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-center text-xs text-gray-500 sm:text-left sm:text-sm">
        Показано {from}–{to} із {total}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        {hasPreviousPage ? (
          <Link
            href={getPageHref(
              objectId,
              tab,
              page - 1
            )}
            scroll={false}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Новіші
          </Link>
        ) : (
          <span />
        )}

        {hasNextPage && (
          <Link
            href={getPageHref(
              objectId,
              tab,
              page + 1
            )}
            scroll={false}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Старіші →
          </Link>
        )}
      </div>
    </nav>
  );
}
