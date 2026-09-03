"use client";

import {
  useState,
} from "react";

import {
  loadMoreObjectActivity,
} from "@/app/actions/activityActions";
import ActivityTimelineList from "@/components/activity/ActivityTimelineList";

import type {
  ActivityLog,
  ActivityLogCursor,
  ObjectActivityLogPage,
} from "@/types/activityLog";

type Props = {
  objectId: number;
  initialPage: ObjectActivityLogPage;
};

export default function ObjectActivityTimeline({
  objectId,
  initialPage,
}: Props) {
  const [logs, setLogs] =
    useState<ActivityLog[]>(
      initialPage.logs
    );
  const [cursor, setCursor] =
    useState<ActivityLogCursor | null>(
      initialPage.nextCursor
    );
  const [isLoading, setIsLoading] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function handleLoadMore() {
    if (!cursor || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextPage =
        await loadMoreObjectActivity(
          objectId,
          cursor
        );

      setLogs((currentLogs) => {
        const logsById = new Map(
          currentLogs.map((log) => [
            log.id,
            log,
          ])
        );

        for (const log of nextPage.logs) {
          logsById.set(log.id, log);
        }

        return Array.from(
          logsById.values()
        );
      });
      setCursor(
        nextPage.nextCursor
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не вдалося завантажити старіші події."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section
      id="object-history"
      className="min-w-0 space-y-4 scroll-mt-24"
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Історія об’єкта
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Хронологія важливих змін, робіт і фінансових дій.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-6 text-center">
          <p className="font-medium text-gray-700">
            Історія поки порожня
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Нові бізнес-дії з’являться тут автоматично.
          </p>
        </div>
      ) : (
        <ActivityTimelineList
          logs={logs}
          existingObjectIds={[
            objectId,
          ]}
          compact
        />
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {cursor && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoading}
          className="min-h-11 w-full rounded-lg border bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isLoading
            ? "Завантаження…"
            : "Показати ще"}
        </button>
      )}
    </section>
  );
}
