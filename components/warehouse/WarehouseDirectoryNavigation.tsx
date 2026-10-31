import Link from "next/link";
import { warehouseDirectoryHref, warehouseQueryValue, type WarehouseDirectoryFilters, type WarehouseQuery } from "@/lib/warehouseDirectory";

export default function WarehouseDirectoryNavigation({ filters, categories, query, page, pageCount, total }: {
  filters: WarehouseDirectoryFilters; categories: string[]; query: WarehouseQuery; page: number; pageCount: number; total: number;
}) {
  const inputClass = "vc-field mt-1 min-h-11 min-w-0";
  return <section className="min-w-0 space-y-3" aria-label="Фільтри складу">
    <form action="/warehouse" method="get" key={JSON.stringify(filters)} className="vc-surface grid min-w-0 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries(query).filter(([key]) => key.startsWith("ledger_")).map(([key, value]) => <input key={key} type="hidden" name={key} value={warehouseQueryValue(value) || ""} />)}
      <label className="min-w-0 text-sm">Пошук<input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Назва, категорія, постачальник" className={inputClass} /></label>
      <label className="min-w-0 text-sm">Категорія<select name="category" defaultValue={filters.category} className={inputClass}><option value="">Усі категорії</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="min-w-0 text-sm">Запас<select name="stock" defaultValue={filters.stock} className={inputClass}>
        <option value="all">Усі залишки</option><option value="out">Закінчився</option><option value="low">Мало</option><option value="normal">Норма</option>
      </select></label>
      <div className="flex items-end gap-2"><button type="submit" className="min-h-11 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">Застосувати</button><Link href={warehouseDirectoryHref({ q: "", category: "", stock: "all" }, 1, query)} className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">Скинути</Link></div>
    </form>
    <nav aria-label="Сторінки складу" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-gray-600">{total ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} із ${total}` : "Позицій не знайдено"}</p>
      <div className="flex items-center gap-3">
        {page > 1 ? <Link className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 bg-white px-3 py-2 font-medium shadow-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2" href={warehouseDirectoryHref(filters, page - 1, query)}>Назад</Link> : <span aria-disabled="true" className="px-3 py-2 text-gray-400">Назад</span>}
        <span>{page} / {pageCount}</span>
        {page < pageCount ? <Link className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 bg-white px-3 py-2 font-medium shadow-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2" href={warehouseDirectoryHref(filters, page + 1, query)}>Далі</Link> : <span aria-disabled="true" className="px-3 py-2 text-gray-400">Далі</span>}
      </div>
    </nav>
  </section>;
}
