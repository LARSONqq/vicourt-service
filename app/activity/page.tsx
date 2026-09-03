import Link from "next/link";

import ActivityTimelineList from "@/components/activity/ActivityTimelineList";
import {
  activityCategories,
  activityEventOptions,
  isActivityCategory,
  isActivityEventName,
} from "@/constants/activityLog";
import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";
import {
  getActivityFilterOptions,
  getActivityLogs,
} from "@/services/activityLogService";

type SearchParams = {
  q?: string | string[];
  category?: string | string[];
  event?: string | string[];
  actor?: string | string[];
  object_id?: string | string[];
  date_from?: string | string[];
  date_to?: string | string[];
  page?: string | string[];
};

type Props = {
  searchParams: Promise<SearchParams>;
};

type PageFilters = {
  q: string;
  category: string;
  event: string;
  actor: string;
  objectId: string;
  dateFrom: string;
  dateTo: string;
};

function getParam(
  value:
    | string
    | string[]
    | undefined
) {
  return Array.isArray(value)
    ? value[0] || ""
    : value || "";
}

function getPositiveId(
  value: string
) {
  const id = Number(value);
  return Number.isInteger(id) &&
    id > 0
    ? id
    : undefined;
}

function createPageHref(
  filters: PageFilters,
  page: number
) {
  const params =
    new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.category) {
    params.set(
      "category",
      filters.category
    );
  }
  if (filters.event) {
    params.set(
      "event",
      filters.event
    );
  }
  if (filters.actor) {
    params.set(
      "actor",
      filters.actor
    );
  }
  if (filters.objectId) {
    params.set(
      "object_id",
      filters.objectId
    );
  }
  if (filters.dateFrom) {
    params.set(
      "date_from",
      filters.dateFrom
    );
  }
  if (filters.dateTo) {
    params.set(
      "date_to",
      filters.dateTo
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
    ? `/activity?${query}`
    : "/activity";
}

export const dynamic =
  "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: Props) {
  await requireSectionAccess(
    "activity"
  );

  const params =
    await searchParams;
  const rawCategory = getParam(
    params.category
  ).trim();
  const rawEvent = getParam(
    params.event
  ).trim();
  const filters: PageFilters = {
    q: getParam(params.q).trim(),
    category:
      isActivityCategory(
        rawCategory
      )
        ? rawCategory
        : "",
    event:
      isActivityEventName(
        rawEvent
      )
        ? rawEvent
        : "",
    actor: getParam(
      params.actor
    ).trim(),
    objectId: getParam(
      params.object_id
    ).trim(),
    dateFrom: getParam(
      params.date_from
    ).trim(),
    dateTo: getParam(
      params.date_to
    ).trim(),
  };
  const requestedPage = Number(
    getParam(params.page)
  );

  const [
    activityPage,
    filterOptions,
  ] = await Promise.all([
    getActivityLogs({
      search: filters.q,
      category: filters.category,
      action: filters.event,
      actorId: filters.actor,
      objectId: getPositiveId(
        filters.objectId
      ),
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page:
        Number.isInteger(
          requestedPage
        ) && requestedPage > 0
          ? requestedPage
          : 1,
    }),
    getActivityFilterOptions(),
  ]);

  const firstVisible =
    activityPage.total > 0
      ? (activityPage.page - 1) *
          activityPage.pageSize +
        1
      : 0;
  const lastVisible =
    firstVisible +
    Math.max(
      activityPage.logs.length - 1,
      0
    );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Журнал активності
        </h1>

        <p className="mt-1 text-sm leading-5 text-gray-500 sm:text-base">
          Історія змін у ViCourt
        </p>
      </div>

      <form
        method="get"
        className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4"
      >
        <div className="min-w-0 sm:col-span-2">
          <label
            htmlFor="activity-search"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Пошук
          </label>
          <input
            id="activity-search"
            type="search"
            name="q"
            maxLength={100}
            defaultValue={filters.q}
            placeholder="Подія, сутність, об’єкт або користувач"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label
            htmlFor="activity-category"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Категорія
          </label>
          <select
            id="activity-category"
            name="category"
            defaultValue={
              filters.category
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі категорії
            </option>
            {activityCategories.map(
              (category) => (
                <option
                  key={category.value}
                  value={category.value}
                >
                  {category.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="activity-event"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Тип події
          </label>
          <select
            id="activity-event"
            name="event"
            defaultValue={filters.event}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі типи подій
            </option>
            {activityEventOptions.map(
              (event) => (
                <option
                  key={event.value}
                  value={event.value}
                >
                  {event.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="activity-actor"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Користувач
          </label>
          <select
            id="activity-actor"
            name="actor"
            defaultValue={filters.actor}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі користувачі
            </option>
            {filterOptions.actors.map(
              (actor) => (
                <option
                  key={actor.id}
                  value={actor.id}
                >
                  {actor.name}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="activity-object"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Об’єкт
          </label>
          <select
            id="activity-object"
            name="object_id"
            defaultValue={
              filters.objectId
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі об’єкти
            </option>
            {filterOptions.objects.map(
              (object) => (
                <option
                  key={object.id}
                  value={object.id}
                >
                  {object.name}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="activity-date-from"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Дата від
          </label>
          <input
            id="activity-date-from"
            type="date"
            name="date_from"
            defaultValue={
              filters.dateFrom
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label
            htmlFor="activity-date-to"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Дата до
          </label>
          <input
            id="activity-date-to"
            type="date"
            name="date_to"
            defaultValue={filters.dateTo}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-1 xl:self-end">
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700"
          >
            Застосувати
          </button>
          <Link
            href="/activity"
            className="flex min-h-11 items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Скинути
          </Link>
        </div>
      </form>

      <div className="flex flex-col gap-1 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Записів: {activityPage.total}
        </p>
        {activityPage.total > 0 && (
          <p>
            Показано {firstVisible}–{lastVisible}
          </p>
        )}
      </div>

      {activityPage.logs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl">
            🕘
          </div>
          <p className="mt-3 font-medium text-gray-700">
            Записів не знайдено
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити фільтри або пошуковий запит.
          </p>
        </div>
      ) : (
        <ActivityTimelineList
          logs={activityPage.logs}
          existingObjectIds={
            activityPage.existingObjectIds
          }
        />
      )}

      {(activityPage.hasPreviousPage ||
        activityPage.hasNextPage) && (
        <nav
          aria-label="Сторінки журналу активності"
          className="grid grid-cols-2 gap-3 border-t pt-5 sm:flex sm:items-center sm:justify-between"
        >
          {activityPage.hasPreviousPage ? (
            <Link
              href={createPageHref(
                filters,
                activityPage.page - 1
              )}
              className="min-h-11 rounded-lg border bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              ← Новіші
            </Link>
          ) : (
            <span />
          )}

          {activityPage.hasNextPage ? (
            <Link
              href={createPageHref(
                filters,
                activityPage.page + 1
              )}
              className="min-h-11 rounded-lg border bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Старіші →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
