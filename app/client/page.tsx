import Link from "next/link";
import { getClientObjectsPage } from "@/services/clientPortalService";
import { clientPage } from "@/lib/clientPortal";

export default async function ClientPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = await getClientObjectsPage(clientPage((await searchParams).page));
  return <>
    <div><h1 className="text-2xl font-bold text-gray-900">Ваші об’єкти</h1><p className="mt-1 text-sm text-gray-500">Об’єкти, до яких вам надано доступ.</p></div>
    {page.items.length === 0 ? <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">Поки немає доступних об’єктів. Якщо ви очікуєте доступ, зверніться до вашого менеджера.</div> :
      <div className="grid gap-4 sm:grid-cols-2">{page.items.map(object => <Link key={object.id} href={`/client/objects/${object.id}`} className="min-w-0 space-y-3 rounded-xl border bg-white p-5 transition hover:border-green-500">
        <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">{object.status}</span>
        <h2 className="break-words text-lg font-semibold">{object.name}</h2>
        <p className="break-words text-sm text-gray-500">{object.address || "Адресу не вказано"}</p>
        <p className="text-sm font-medium text-green-700">Відкрити об’єкт →</p>
      </Link>)}</div>}
    <nav aria-label="Сторінки об’єктів" className="flex flex-wrap justify-between gap-3 text-sm">
      {page.page > 1 && <Link className="rounded-lg border bg-white px-4 py-3" href={`/client?page=${page.page - 1}`}>← Назад</Link>}
      {page.hasMore && <Link className="rounded-lg border bg-white px-4 py-3" href={`/client?page=${page.page + 1}`}>Далі →</Link>}
    </nav>
  </>;
}
