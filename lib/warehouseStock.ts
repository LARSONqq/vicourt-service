export type WarehouseStockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "NORMAL";
type StockItem = { quantity: number; min_quantity: number | null; target_quantity?: number | null };

export const warehouseStockPresentation = {
  OUT_OF_STOCK: { label: "Закінчився", badgeClass: "vc-status-danger", panelClass: "vc-panel-danger", valueClass: "text-destructive" },
  LOW_STOCK: { label: "Мало", badgeClass: "vc-status-warning", panelClass: "vc-panel-warning", valueClass: "vc-text-warning" },
  NORMAL: { label: "Норма", badgeClass: "vc-status-success", panelClass: "vc-panel-neutral", valueClass: "text-foreground" },
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
