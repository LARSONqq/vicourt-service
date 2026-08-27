import Link from "next/link";

import {
  activityEntityTypes,
  getActivityEntityTypeLabel,
} from "@/constants/activityLog";

import {
  requireSectionAccess,
} from "@/lib/auth/requireAccess";

import {
  getActivityLogs,
} from "@/services/activityLogService";

type SearchParams = {
  q?: string | string[];
  entity_type?:
    | string
    | string[];
  actor?: string | string[];
  object?: string | string[];
  date_from?:
    | string
    | string[];
  date_to?:
    | string
    | string[];
  page?: string | string[];
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
  return Array.isArray(value)
    ? value[0] || ""
    : value || "";
}

function formatActivityDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone:
        "Europe/Kyiv",
    }
  )
    .format(
      new Date(value)
    )
    .replace(",", "");
}

function getEntityStyle(
  entityType: string
) {
  switch (entityType) {
    case "object":
      return "bg-green-50 text-green-700";

    case "task":
      return "bg-blue-50 text-blue-700";

    case "material":
      return "bg-amber-50 text-amber-700";

    case "work_log":
      return "bg-violet-50 text-violet-700";

    case "object_expense":
      return "bg-orange-50 text-orange-700";

    case "object_payment":
      return "bg-emerald-50 text-emerald-700";

    case "purchase":
      return "bg-cyan-50 text-cyan-700";

    case "equipment":
      return "bg-slate-100 text-slate-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function createPageHref(
  filters: {
    q: string;
    entityType: string;
    actor: string;
    object: string;
    dateFrom: string;
    dateTo: string;
  },
  page: number
) {
  const params =
    new URLSearchParams();

  if (filters.q) {
    params.set(
      "q",
      filters.q
    );
  }

  if (filters.entityType) {
    params.set(
      "entity_type",
      filters.entityType
    );
  }

  if (filters.actor) {
    params.set(
      "actor",
      filters.actor
    );
  }

  if (filters.object) {
    params.set(
      "object",
      filters.object
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

  const query =
    params.toString();

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

  const filters = {
    q: getParam(params.q).trim(),
    entityType: getParam(
      params.entity_type
    ).trim(),
    actor: getParam(
      params.actor
    ).trim(),
    object: getParam(
      params.object
    ).trim(),
    dateFrom: getParam(
      params.date_from
    ).trim(),
    dateTo: getParam(
      params.date_to
    ).trim(),
  };

  const requestedPage =
    Number(
      getParam(
        params.page
      )
    );

  const activityPage =
    await getActivityLogs({
      search:
        filters.q,
      entityType:
        filters.entityType,
      actorName:
        filters.actor,
      objectName:
        filters.object,
      dateFrom:
        filters.dateFrom,
      dateTo:
        filters.dateTo,
      page:
        Number.isInteger(
          requestedPage
        ) &&
        requestedPage > 0
          ? requestedPage
          : 1,
    });

  const firstVisible =
    activityPage.total > 0
      ? (
          activityPage.page -
          1
        ) *
          activityPage.pageSize +
        1
      : 0;

  const lastVisible =
    firstVisible +
    activityPage.logs.length -
    (activityPage.logs.length > 0
      ? 1
      : 0);

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Журнал дій
        </h1>

        <p className="mt-1 text-sm leading-5 text-gray-500 sm:text-base">
          Історія важливих дій у
          ViCourt
        </p>
      </div>

      <form
        method="get"
        className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4"
      >
        <div className="min-w-0 sm:col-span-2">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Пошук в описі
          </label>

          <input
            type="search"
            name="q"
            defaultValue={
              filters.q
            }
            placeholder="Наприклад: оприбуткував закупівлю"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Модуль
          </label>

          <select
            name="entity_type"
            defaultValue={
              filters.entityType
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Усі модулі
            </option>

            {activityEntityTypes.map(
              (item) => (
                <option
                  key={
                    item.value
                  }
                  value={
                    item.value
                  }
                >
                  {item.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Користувач
          </label>

          <input
            name="actor"
            defaultValue={
              filters.actor
            }
            placeholder="Ім’я користувача"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Об’єкт
          </label>

          <input
            name="object"
            defaultValue={
              filters.object
            }
            placeholder="Назва об’єкта"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Дата від
          </label>

          <input
            type="date"
            name="date_from"
            defaultValue={
              filters.dateFrom
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Дата до
          </label>

          <input
            type="date"
            name="date_to"
            defaultValue={
              filters.dateTo
            }
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

      {activityPage.logs.length ===
      0 ? (
        <div className="rounded-xl border border-dashed bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl">
            🕘
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Записів не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити фільтри
            або пошуковий запит.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activityPage.logs.map(
            (log) => (
              <article
                key={log.id}
                className="min-w-0 rounded-xl border bg-white p-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 sm:text-sm">
                      {formatActivityDate(
                        log.created_at
                      )}
                    </p>

                    <p className="mt-1 break-words font-semibold text-gray-900">
                      {log.actor_name}
                    </p>
                  </div>

                  <span
                    className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getEntityStyle(
                      log.entity_type
                    )}`}
                  >
                    {getActivityEntityTypeLabel(
                      log.entity_type
                    )}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 sm:text-base">
                  {log.description}
                </p>

                {(log.object_name ||
                  log.entity_name) && (
                  <div className="mt-4 flex min-w-0 flex-col gap-2 border-t pt-4 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
                    {log.object_name && (
                      <p className="break-words text-gray-600">
                        <span className="text-gray-400">
                          Об’єкт:{" "}
                        </span>
                        <span className="font-medium text-gray-700">
                          {log.object_name}
                        </span>
                      </p>
                    )}

                    {log.entity_name &&
                      log.entity_name !==
                        log.object_name && (
                        <p className="break-words text-gray-600">
                          <span className="text-gray-400">
                            Запис:{" "}
                          </span>
                          <span className="font-medium text-gray-700">
                            {log.entity_name}
                          </span>
                        </p>
                      )}
                  </div>
                )}
              </article>
            )
          )}
        </div>
      )}

      {(activityPage.hasPreviousPage ||
        activityPage.hasNextPage) && (
        <div className="grid grid-cols-2 gap-3 border-t pt-5 sm:flex sm:items-center sm:justify-between">
          {activityPage.hasPreviousPage ? (
            <Link
              href={createPageHref(
                filters,
                activityPage.page -
                  1
              )}
              className="min-h-11 rounded-lg border bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              ← Попередні
            </Link>
          ) : (
            <span />
          )}

          {activityPage.hasNextPage ? (
            <Link
              href={createPageHref(
                filters,
                activityPage.page +
                  1
              )}
              className="min-h-11 rounded-lg border bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Наступні →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
