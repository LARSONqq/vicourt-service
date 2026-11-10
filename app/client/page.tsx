import Link from "next/link";
import { getClientObjectHomePage } from "@/services/clientPortalService";
import { clientPage } from "@/lib/clientPortal";
import { ArrowRight, CalendarClock, MapPin } from "lucide-react";
import ClientObjectStatus from "@/components/client/ClientObjectStatus";
import ClientPortalState from "@/components/client/ClientPortalState";
import { formatKyivTimestamp } from "@/lib/kyivDate";

export default async function ClientPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = await getClientObjectHomePage(clientPage((await searchParams).page));
  return <>
    <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Ваш простір ViCourt</p><h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">Ваші об’єкти</h1><p className="max-w-xl text-sm leading-6 text-gray-600">Актуальний стан робіт, опубліковані фото та документи — в одному спокійному просторі.</p></header>
    {page.items.length === 0 ? <ClientPortalState title="Поки немає доступних об’єктів." description="Якщо ви очікуєте доступ, зверніться до вашого менеджера." /> :
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">{page.items.map(object => <Link key={object.id} href={`/client/objects/${object.id}`} className="group flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-gray-200/80 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-600/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3"><ClientObjectStatus status={object.status} />{object.published_progress && <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-800">{object.published_progress.overall_percent}%</span>}</div>
        <h2 className="mt-4 min-w-0 break-words text-xl font-semibold leading-snug text-gray-950 [overflow-wrap:anywhere]">{object.name}</h2>
        {object.address && <p className="mt-2 flex min-w-0 items-start gap-2 text-sm leading-relaxed text-gray-600"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gray-400" /><span className="min-w-0 [overflow-wrap:anywhere]">{object.address}</span></p>}
        {object.published_progress ? <div className="mt-5 space-y-2" aria-label={`Опублікований прогрес: ${object.published_progress.overall_percent}%`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${object.published_progress.overall_percent}%` }} /></div>
          <p className="flex items-center gap-2 text-xs text-gray-500"><CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />Оновлено <time dateTime={object.published_progress.updated_at}>{formatKyivTimestamp(object.published_progress.updated_at)}</time></p>
        </div> : <p className="mt-5 text-xs leading-5 text-gray-500">{object.progress_unavailable ? "Оновлення тимчасово недоступне." : "Оновлення ще не опубліковано."}</p>}
        <span className="mt-5 flex min-h-11 w-full items-center justify-between gap-2 border-t border-gray-100 pt-4 text-sm font-semibold text-emerald-800">Переглянути об’єкт<ArrowRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" /></span>
      </Link>)}</div>}
    {(page.page > 1 || page.hasMore) && <nav aria-label="Сторінки об’єктів" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="w-full text-center text-gray-500 sm:order-none sm:w-auto">Сторінка {page.page}</span>
      {page.page > 1 && <Link className="min-h-11 rounded-lg border bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-green-700" href={`/client?page=${page.page - 1}`}>← Назад</Link>}
      {page.hasMore && <Link className="min-h-11 rounded-lg border bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-green-700" href={`/client?page=${page.page + 1}`}>Далі →</Link>}
    </nav>}
  </>;
}
