import Link from "next/link";
import WarehouseActions from "@/components/warehouse/WarehouseActions";
import WarehouseList from "@/components/warehouse/WarehouseList";
import WarehouseMovements from "@/components/warehouse/WarehouseMovements";
import WarehouseDirectoryNavigation from "@/components/warehouse/WarehouseDirectoryNavigation";
import WarehousePurchaseOverview from "@/components/warehouse/WarehousePurchaseOverview";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canManagePurchases, canManageWarehouse, canViewWarehouseLedger } from "@/lib/auth/permissions";
import { warehouseDirectoryHref, warehouseQueryValue, type WarehouseQuery } from "@/lib/warehouseDirectory";
import { getWarehouseDirectory } from "@/services/warehouseDirectoryService";
import { getObjects } from "@/services/objectService";
import { getAppSettings } from "@/services/settingsService";
import { getWarehousePlannedQuantities, getWarehousePlannedPurchaseOverview } from "@/services/purchaseService";
import { getWarehouseMovementPage } from "@/services/warehouseService";
import type { WarehousePurchaseInsights } from "@/types/warehousePurchase";

type Props = { searchParams: Promise<WarehouseQuery> };

export default async function WarehousePage({ searchParams }: Props) {
  const profile = await requireSectionAccess("warehouse");
  const canManage = canManageWarehouse(profile.role);
  const purchasing = canManagePurchases(profile.role);
  const ledger = canViewWarehouseLedger(profile.role);
  const query = await searchParams;
  const value = (name: string) => warehouseQueryValue(query[name]);
  const ledgerFilters = {
    search: value("ledger_search"), item: value("ledger_item"), object: value("ledger_object"),
    movement: value("ledger_movement"), from: value("ledger_from"), to: value("ledger_to"),
  };
  const [directory, settings, movementPage, objects, purchases] = await Promise.all([
    getWarehouseDirectory(query), getAppSettings(),
    ledger ? getWarehouseMovementPage({ search: ledgerFilters.search, itemId: Number(ledgerFilters.item), objectId: Number(ledgerFilters.object), movementCode: ledgerFilters.movement, dateFrom: ledgerFilters.from, dateTo: ledgerFilters.to, page: Number(value("ledger_page")) }) : Promise.resolve(null),
    ledger ? getObjects() : Promise.resolve([]),
    purchasing ? getWarehousePlannedPurchaseOverview() : Promise.resolve([]),
  ]);
  const planned = purchasing ? await getWarehousePlannedQuantities(directory.items.map((item) => item.id)) : {};
  const insights: WarehousePurchaseInsights = {};
  for (const [id, quantity] of Object.entries(planned)) insights[Number(id)] = { plannedQuantity: quantity, lastPurchasePrice: null, previousPurchasePrice: null, priceChangePercent: null };
  const cards = [
    { label: "Всього позицій", count: directory.stats.total, stock: "all" as const },
    { label: "Закінчилось", count: directory.stats.out, stock: "out" as const },
    { label: "Мало", count: directory.stats.low, stock: "low" as const },
    { label: "Норма", count: directory.stats.normal, stock: "normal" as const },
  ];
  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <div className="flex min-w-0 flex-col justify-between gap-4 xl:flex-row">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Склад</h1><p className="mt-1 text-sm text-gray-500">Залишки, потреба в матеріалах та очікувані закупівлі</p></div>
      {canManage && <div className="min-w-0"><WarehouseActions items={directory.items} /><p className="mt-2 text-xs text-gray-500">У формі корекції — матеріали поточної сторінки. Інші знайдіть через фільтри або паспорт.</p></div>}
    </div>
    {!purchasing && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Режим перегляду: залишки та параметри запасу матеріалів.</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => <Link key={card.stock} href={warehouseDirectoryHref({ q: "", category: "", stock: card.stock }, 1, query)} className={`min-w-0 rounded-xl border bg-white p-4 hover:border-green-500 ${directory.filters.stock === card.stock ? "border-green-600 ring-1 ring-green-600" : ""}`}>
        <p className="text-sm text-gray-500">{card.label}</p><p className={`mt-2 text-2xl font-bold ${card.stock === "out" ? "text-red-700" : card.stock === "low" ? "text-orange-700" : "text-gray-900"}`}>{card.count}</p>
      </Link>)}
    </div>
    <p className="text-xs text-gray-500">Постачальників: {directory.supplierCount}{directory.totalValue !== null && <> · Вартість залишків: {new Intl.NumberFormat("uk-UA", { style: "currency", currency: settings.currency }).format(directory.totalValue)}</>}</p>
    <WarehouseDirectoryNavigation filters={directory.filters} categories={directory.categories} query={query} page={directory.page} pageCount={directory.pageCount} total={directory.total} />
    <WarehouseList key={JSON.stringify([directory.filters, directory.page])} items={directory.items} currency={settings.currency} canManage={canManage} canCreatePurchases={purchasing} canViewPurchaseHistory={purchasing} canViewCosts={ledger} purchaseInsights={insights} focusedItemId={Number(value("item")) || undefined} />
    {purchasing && <WarehousePurchaseOverview purchases={purchases} currency={settings.currency} />}
    {ledger && movementPage && <WarehouseMovements movementPage={movementPage} items={directory.ledgerItems} objects={objects} currency={settings.currency} filters={{ ...ledgerFilters, q: directory.filters.q, category: directory.filters.category, stock: directory.filters.stock, page: String(directory.page) }} />}
  </div>;
}
