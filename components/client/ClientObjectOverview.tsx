import "server-only";

import { CalendarClock, CheckCircle2, MapPin, Route } from "lucide-react";
import ClientObjectStatus from "@/components/client/ClientObjectStatus";
import ClientPortalState from "@/components/client/ClientPortalState";
import { formatKyivTimestamp } from "@/lib/kyivDate";
import type { ClientObjectProfile, ClientObjectProgress } from "@/types/clientPortal";

export default function ClientObjectOverview({ object, progress, unavailable = false }: {
  object: ClientObjectProfile;
  progress: ClientObjectProgress | null;
  unavailable?: boolean;
}) {
  return <div className="min-w-0 space-y-4 sm:space-y-5">
    <section aria-labelledby="client-object-title" className="min-w-0 rounded-2xl bg-gray-950 p-5 text-white shadow-sm sm:p-8">
      <ClientObjectStatus status={object.status} />
      <h1 id="client-object-title" className="mt-5 break-words text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{object.name}</h1>
      <p className="mt-3 flex min-w-0 items-start gap-2 text-sm leading-relaxed text-gray-300"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-400" /><span className="min-w-0 [overflow-wrap:anywhere]">{object.address || "Адресу не вказано"}</span></p>
      {progress && <div className="mt-7 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2"><div className="flex items-center justify-between gap-3 text-sm"><span className="text-gray-300">Загальний прогрес</span><strong className="text-lg tabular-nums text-white">{progress.overall_percent}%</strong></div>
          <div role="progressbar" aria-label="Загальний прогрес об’єкта" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.overall_percent} className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress.overall_percent}%` }} /></div>
        </div>
        <p className="flex items-center gap-2 text-xs text-gray-400"><CalendarClock aria-hidden="true" className="size-4" />Оновлено <time dateTime={progress.updated_at}>{formatKyivTimestamp(progress.updated_at)}</time></p>
      </div>}
    </section>

    {unavailable ? <ClientPortalState error title="Не вдалося завантажити опубліковане оновлення. Спробуйте пізніше." />
      : !progress ? <ClientPortalState title="Оновлення ще не опубліковано." description="Щойно з’явиться нова інформація про хід робіт, ви побачите її тут." />
      : <section aria-label="Коротко про роботи" className="grid min-w-0 gap-4 sm:grid-cols-2">
        <article className="min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 sm:p-6">
          <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-700" /><h2 className="mt-4 font-semibold text-gray-950">Що виконано</h2>
          {progress.completed_summary ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 [overflow-wrap:anywhere]">{progress.completed_summary}</p> : <p className="mt-2 text-sm leading-6 text-gray-500">Підсумок виконаного ще не опубліковано.</p>}
        </article>
        <article className="min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 sm:p-6">
          <Route aria-hidden="true" className="size-5 text-emerald-700" /><h2 className="mt-4 font-semibold text-gray-950">Що далі</h2>
          {progress.next_summary ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 [overflow-wrap:anywhere]">{progress.next_summary}</p> : <p className="mt-2 text-sm leading-6 text-gray-500">Наступні кроки ще не опубліковано.</p>}
        </article>
      </section>}
  </div>;
}
