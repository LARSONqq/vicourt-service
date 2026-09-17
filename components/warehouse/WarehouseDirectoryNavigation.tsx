import Link from "next/link";
import { warehouseDirectoryHref, warehouseQueryValue, type WarehouseDirectoryFilters, type WarehouseQuery } from "@/lib/warehouseDirectory";

export default function WarehouseDirectoryNavigation({ filters, categories, query, page, pageCount, total }: {
  filters: WarehouseDirectoryFilters; categories: string[]; query: WarehouseQuery; page: number; pageCount: number; total: number;
}) {
  const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2";
  return <section className="min-w-0 space-y-3" aria-label="Фільтри складу">
    <form action="/warehouse" method="get" key={JSON.stringify(filters)} className="grid min-w-0 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries(query).filter(([key]) => key.startsWith("ledger_")).map(([key, value]) => <input key={key} type="hidden" name={key} value={warehouseQueryValue(value) || ""} />)}
      <label className="min-w-0 text-sm">Пошук<input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Назва, категорія, постачальник" className={inputClass} /></label>
      <label className="min-w-0 text-sm">Категорія<select name="category" defaultValue={filters.category} className={inputClass}><option value="">Усі категорії</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="min-w-0 text-sm">Запас<select name="stock" defaultValue={filters.stock} className={inputClass}>
        <option value="all">Усі залишки</option><option value="out">Закінчився</option><option value="low">Мало</option><option value="normal">Норма</option>
      </select></label>
      <div className="flex items-end gap-2"><button type="submit" className="min-h-11 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">Застосувати</button><Link href={warehouseDirectoryHref({ q: "", category: "", stock: "all" }, 1, query)} className="flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm">Скинути</Link></div>
    </form>
    <nav aria-label="Сторінки складу" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-gray-600">{total ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} із ${total}` : "Позицій не знайдено"}</p>
      <div className="flex items-center gap-3">
        {page > 1 ? <Link className="rounded-lg border bg-white px-3 py-2" href={warehouseDirectoryHref(filters, page - 1, query)}>Назад</Link> : <span aria-disabled="true" className="px-3 py-2 text-gray-400">Назад</span>}
        <span>{page} / {pageCount}</span>
        {page < pageCount ? <Link className="rounded-lg border bg-white px-3 py-2" href={warehouseDirectoryHref(filters, page + 1, query)}>Далі</Link> : <span aria-disabled="true" className="px-3 py-2 text-gray-400">Далі</span>}
      </div>
    </nav>
  </section>;
}
