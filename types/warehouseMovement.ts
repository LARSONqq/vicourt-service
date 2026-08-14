export interface WarehouseMovement {
  id: number;
  item_id: number;
  object_id: number | null;
  movement_type: "Прихід" | "Списання";
  quantity: number;
  note: string | null;
  created_at: string;

  item: {
    id: number;
    name: string;
    unit: string;
  } | null;

  object: {
    id: number;
    name: string;
  } | null;
}