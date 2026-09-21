import "server-only";

import { formatKyivTimestamp } from "@/lib/kyivDate";
import type { ClientObjectProgress as ClientObjectProgressDto, ClientProgressStageStatus } from "@/types/clientPortal";

type Props = {
  progress: ClientObjectProgressDto | null;
  unavailable?: boolean;
};

const stagePresentation: Record<ClientProgressStageStatus, { label: string; badge: string; marker: string }> = {
  planned: { label: "Заплановано", badge: "bg-gray-100 text-gray-600", marker: "border-gray-200 bg-white text-gray-500" },
  in_progress: { label: "В роботі", badge: "bg-amber-50 text-amber-800", marker: "border-amber-300 bg-amber-50 text-amber-800" },
  completed: { label: "Завершено", badge: "bg-green-50 text-green-800", marker: "border-green-600 bg-green-600 text-white" },
};

export default function ClientObjectProgress({ progress, unavailable = false }: Props) {
  if (unavailable || !progress) {
    return (
      <section aria-labelledby="client-progress-title" className="min-w-0 space-y-3 rounded-2xl border bg-white p-5 sm:p-8">
        <h2 id="client-progress-title" className="text-lg font-semibold text-gray-900">Прогрес об’єкта</h2>
        <p role="status" className="text-sm leading-relaxed text-gray-600">
          {unavailable
            ? "Не вдалося завантажити оновлення прогресу. Спробуйте оновити сторінку пізніше."
            : "Оновлення прогресу ще не опубліковано."}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="client-progress-title" className="min-w-0 space-y-6 rounded-2xl border bg-white p-5 sm:space-y-8 sm:p-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="client-progress-title" className="text-lg font-semibold text-gray-900">Прогрес об’єкта</h2>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-green-800 sm:text-5xl">{progress.overall_percent}%</p>
        </div>
        <div role="progressbar" aria-label="Загальний прогрес об’єкта" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={progress.overall_percent} className="h-3 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-green-600" style={{ width: `${progress.overall_percent}%` }} />
        </div>
      </div>

      {progress.stages.length > 0 && <div className="min-w-0 space-y-4">
        <h3 className="font-semibold text-gray-900">Етапи проєкту</h3>
        {/* The client-safe mapper already sorts by sort_order, then id. */}
        <ol className="min-w-0">
          {progress.stages.map((stage, index) => {
            const presentation = stagePresentation[stage.status];
            return (
              <li key={stage.id} className="relative flex min-w-0 gap-3 pb-5 last:pb-0 sm:gap-4">
                {index < progress.stages.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-4 top-8 w-px bg-gray-200" />}
                <span aria-hidden="true" className={`relative flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${presentation.marker}`}>
                  {stage.status === "completed" ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                  <p className="break-words font-medium leading-relaxed text-gray-900">{stage.title}</p>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${presentation.badge}`}>{presentation.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>}

      {(progress.completed_summary || progress.next_summary) && <div className="min-w-0 space-y-5 border-t border-gray-100 pt-5">
        {progress.completed_summary && <div className="min-w-0 space-y-2">
          <h3 className="font-semibold text-gray-900">Що виконано</h3>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{progress.completed_summary}</p>
        </div>}
        {progress.next_summary && <div className="min-w-0 space-y-2">
          <h3 className="font-semibold text-gray-900">Що далі</h3>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{progress.next_summary}</p>
        </div>}
      </div>}

      <p className="text-xs leading-relaxed text-gray-500">
        Останнє оновлення: <time dateTime={progress.updated_at}>{formatKyivTimestamp(progress.updated_at)}</time>
      </p>
    </section>
  );
}
