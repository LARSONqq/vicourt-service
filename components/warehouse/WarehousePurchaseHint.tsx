import { getRecommendedPurchaseQuantity, getWarehouseStockStatus } from "@/lib/warehouseStock";
import { formatWarehouseQuantity } from "@/lib/warehousePlanning";
import WarehouseItemOperations from "@/components/warehouse/WarehouseItemOperations";
import type { WarehouseItem } from "@/types/warehouseItem";
import type { AppCurrency } from "@/types/appSettings";

export default function WarehousePurchaseHint({ item, management, plannedQuantity, currency }: {
  item: WarehouseItem; management: boolean; plannedQuantity: number; currency: AppCurrency;
}) {
  const recommended = getRecommendedPurchaseQuantity(item);
  return <div className="mt-3 min-w-0 space-y-2 text-sm">
    {recommended !== null && <p className="font-medium text-orange-700">Рекомендовано докупити: {formatWarehouseQuantity(recommended)} {item.unit}</p>}
    {management && <>
      <p className="text-blue-700">{plannedQuantity > 0 ? `Заплановано ${formatWarehouseQuantity(plannedQuantity)} ${item.unit} · Очікує отримання` : "Закупівлю не створено"}</p>
      {(plannedQuantity > 0 || getWarehouseStockStatus(item) !== "NORMAL") && <WarehouseItemOperations
        purchasingOnly itemId={item.id} name={item.name} unit={item.unit} currency={currency} canAdjust={false}
        plannedQuantity={plannedQuantity} recommendedQuantity={recommended} supplier={item.supplier}
      />}
    </>}
  </div>;
}
