import Link from "next/link";
import WarehouseItemOperations from "@/components/warehouse/WarehouseItemOperations";
import { formatWarehouseQuantity } from "@/lib/warehousePlanning";
import type { PlannedPurchaseOverview } from "@/services/purchaseService";
import type { AppCurrency } from "@/types/appSettings";

export default function WarehousePurchaseOverview({ purchases, currency }: { purchases: PlannedPurchaseOverview[]; currency: AppCurrency }) {
  return <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Заплановані закупівлі</h2><Link href="/purchases" className="text-sm font-medium text-green-700 hover:underline">Усі закупівлі →</Link></div>
    {!purchases.length ? <p className="mt-3 text-sm text-gray-500">Немає закупівель, що очікують отримання.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {purchases.map((purchase) => <article key={purchase.id} className="min-w-0 space-y-2 rounded-lg border p-3">
        {purchase.item ? <Link href={`/warehouse/${purchase.item.id}`} className="break-words font-medium text-green-800 hover:underline">{purchase.item.name}</Link> : <p>Матеріал недоступний</p>}
        <p className="text-sm">{formatWarehouseQuantity(Number(purchase.quantity))} {purchase.item?.unit} · {purchase.status} · Очікує отримання</p>
        <p className="break-words text-sm text-gray-500">{purchase.supplier || "Постачальника не вказано"}</p>
        {purchase.item && <WarehouseItemOperations purchasingOnly itemId={purchase.item.id} name={purchase.item.name} unit={purchase.item.unit} currency={currency} canAdjust={false} plannedQuantity={Number(purchase.quantity)} purchaseId={purchase.id} />}
      </article>)}
    </div>}
  </section>;
}
