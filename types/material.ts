export interface Material {
  id: number;
  object_id: number;
  warehouse_item_id: number | null;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  created_at: string;
}