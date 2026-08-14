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
