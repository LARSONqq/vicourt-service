export type WarehouseStockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "NORMAL";
type StockItem = { quantity: number; min_quantity: number | null; target_quantity?: number | null };

export const warehouseStockPresentation = {
  OUT_OF_STOCK: { label: "Закінчився", badgeClass: "bg-red-100 text-red-800", panelClass: "border-red-200 bg-red-50", valueClass: "text-red-700" },
  LOW_STOCK: { label: "Мало", badgeClass: "bg-orange-100 text-orange-800", panelClass: "border-orange-200 bg-orange-50", valueClass: "text-orange-700" },
  NORMAL: { label: "Норма", badgeClass: "bg-green-100 text-green-800", panelClass: "border-green-200 bg-green-50", valueClass: "text-green-700" },
} as const;

export function getWarehouseStockStatus(item: StockItem): WarehouseStockStatus {
  const quantity = Number(item.quantity);
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity > 0 && item.min_quantity != null && quantity <= Number(item.min_quantity)) return "LOW_STOCK";
  return "NORMAL";
}

export function getRecommendedPurchaseQuantity(item: StockItem): number | null {
  if (getWarehouseStockStatus(item) === "NORMAL" || item.target_quantity == null) return null;
  const difference = Number(item.target_quantity) - Number(item.quantity);
  const rounded = Math.round(difference * 1_000_000) / 1_000_000;
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}
