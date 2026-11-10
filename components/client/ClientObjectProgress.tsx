import "server-only";

import { formatKyivTimestamp } from "@/lib/kyivDate";
import type { ClientObjectProgress as ClientObjectProgressDto, ClientProgressStageStatus } from "@/types/clientPortal";
import ClientPortalState from "@/components/client/ClientPortalState";

type Props = {
  progress: ClientObjectProgressDto | null;
  unavailable?: boolean;
};

const stagePresentation: Record<ClientProgressStageStatus, { label: string; badge: string; marker: string }> = {
  planned: { label: "Далі", badge: "bg-gray-100 text-gray-600", marker: "border-gray-200 bg-white text-gray-500" },
  in_progress: { label: "Зараз", badge: "bg-amber-50 text-amber-800", marker: "border-amber-300 bg-amber-50 text-amber-800" },
  completed: { label: "Готово", badge: "bg-emerald-50 text-emerald-800", marker: "border-emerald-600 bg-emerald-600 text-white" },
};

export default function ClientObjectProgress({ progress, unavailable = false }: Props) {
  if (unavailable || !progress) {
    return (
      <section aria-labelledby="client-progress-title" className="min-w-0 space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 sm:p-8">
        <h1 id="client-progress-title" className="text-xl font-semibold text-gray-950 sm:text-2xl">Оновлення робіт</h1>
        <ClientPortalState error={unavailable} title={unavailable
            ? "Не вдалося завантажити оновлення прогресу. Спробуйте оновити сторінку пізніше."
            : "Оновлення прогресу ще не опубліковано."} />
      </section>
    );
  }

  return (
    <section aria-labelledby="client-progress-title" className="min-w-0 space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 sm:space-y-8 sm:p-8">
      <div className="space-y-5 rounded-xl bg-emerald-50/70 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1"><h1 id="client-progress-title" className="text-xl font-semibold text-gray-950 sm:text-2xl">Оновлення робіт</h1><p className="text-sm text-emerald-900/70">Як просуваються роботи на об’єкті</p></div>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-emerald-800 sm:text-5xl">{progress.overall_percent}%</p>
        </div>
        <div role="progressbar" aria-label="Загальний прогрес об’єкта" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={progress.overall_percent} className="h-2 overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.overall_percent}%` }} />
        </div>
      </div>

      {progress.stages.length > 0 && <div className="min-w-0 space-y-4">
        <h2 className="font-semibold text-gray-900">Хід робіт</h2>
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
                <div className={`min-w-0 flex-1 space-y-2 rounded-xl p-3 ${stage.status === "in_progress" ? "bg-amber-50 ring-1 ring-amber-200" : stage.status === "completed" ? "bg-emerald-50/60" : "bg-gray-50"}`}>
                  <p className="break-words font-medium leading-relaxed text-gray-900 [overflow-wrap:anywhere]">{stage.title}</p>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${presentation.badge}`}>{presentation.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>}
      {progress.stages.length === 0 && <ClientPortalState title="Деталі етапів ще не опубліковано." description="Загальний прогрес показано вище. Більше інформації з’явиться після наступного оновлення." />}

      {progress.next_summary && <div className="min-w-0 border-t border-gray-100 pt-5"><h2 className="font-semibold text-gray-900">Найближчі кроки</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 [overflow-wrap:anywhere]">{progress.next_summary}</p></div>}

      <p className="text-xs leading-relaxed text-gray-500">
        Останнє оновлення: <time dateTime={progress.updated_at}>{formatKyivTimestamp(progress.updated_at)}</time>
      </p>
    </section>
  );
}
