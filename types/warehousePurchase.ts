export type WarehousePurchaseStatus =
  | "Заплановано"
  | "Закуплено";

export interface WarehousePurchase {
  id: number;
  item_id: number;
  quantity: number;
  purchase_price: number;
  supplier: string | null;
  note: string | null;
  status: WarehousePurchaseStatus;
  created_at: string;
  purchased_at: string | null;

  item: {
    id: number;
    name: string;
    unit: string;
    quantity: number;
    min_quantity: number;
  } | null;
}

export type WarehousePurchasePlanningRow = Pick<
  WarehousePurchase,
  | "id"
  | "item_id"
  | "quantity"
  | "purchase_price"
  | "supplier"
  | "status"
  | "created_at"
  | "purchased_at"
>;

export interface WarehousePurchaseInsight {
  plannedQuantity: number;
  lastPurchasePrice: number | null;
  previousPurchasePrice: number | null;
  priceChangePercent: number | null;
}

export type WarehousePurchaseInsights = Record<
  number,
  WarehousePurchaseInsight
>;

export interface WarehousePurchaseHistoryEntry {
  id: number;
  quantity: number;
  purchasePrice: number;
  totalAmount: number;
  supplier: string | null;
  purchasedAt: string;
}
