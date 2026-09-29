import Link from "next/link";
import { getClientObjectsPage } from "@/services/clientPortalService";
import { clientPage } from "@/lib/clientPortal";
import { ArrowUpRight, MapPin } from "lucide-react";
import ClientObjectStatus from "@/components/client/ClientObjectStatus";
import ClientPortalState from "@/components/client/ClientPortalState";

export default async function ClientPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = await getClientObjectsPage(clientPage((await searchParams).page));
  return <>
    <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-green-700">Ваш простір ViCourt</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ваші об’єкти</h1><p className="max-w-xl text-sm leading-relaxed text-gray-600">Слідкуйте за прогресом робіт, переглядайте фото та завантажуйте документи.</p></div>
    {page.items.length === 0 ? <ClientPortalState title="Поки немає доступних об’єктів." description="Якщо ви очікуєте доступ, зверніться до вашого менеджера." /> :
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">{page.items.map(object => <Link key={object.id} href={`/client/objects/${object.id}`} className="group flex min-w-0 flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-green-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-700 sm:p-6">
        <ClientObjectStatus status={object.status} />
        <h2 className="min-w-0 break-words text-xl font-semibold leading-snug [overflow-wrap:anywhere]">{object.name}</h2>
        {object.address && <p className="flex min-w-0 items-start gap-2 text-sm leading-relaxed text-gray-600"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{object.address}</span></p>}
        <span className="mt-auto flex min-h-11 w-full items-center justify-between gap-2 border-t border-gray-100 pt-4 text-sm font-semibold text-green-800">Відкрити об’єкт<ArrowUpRight aria-hidden="true" className="size-5 shrink-0" /></span>
      </Link>)}</div>}
    {(page.page > 1 || page.hasMore) && <nav aria-label="Сторінки об’єктів" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="w-full text-center text-gray-500 sm:order-none sm:w-auto">Сторінка {page.page}</span>
      {page.page > 1 && <Link className="min-h-11 rounded-lg border bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-green-700" href={`/client?page=${page.page - 1}`}>← Назад</Link>}
      {page.hasMore && <Link className="min-h-11 rounded-lg border bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-green-700" href={`/client?page=${page.page + 1}`}>Далі →</Link>}
    </nav>}
  </>;
}
