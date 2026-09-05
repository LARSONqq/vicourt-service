export interface WarehouseItem {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  min_quantity: number;
  target_quantity: number | null;
  purchase_price?: number;
  supplier: string | null;
  created_at: string;
}

export type ManagementWarehouseItem =
  WarehouseItem & {
    purchase_price: number;
  };
