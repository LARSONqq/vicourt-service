export interface WarehouseMovement {
  id: number;

  item_id: number;

  object_id: number | null;

  movement_type:
    | "Прихід"
    | "Списання";

  quantity: number;

  note: string | null;

  created_at: string;

  performed_by:
    | string
    | null;

  performed_by_name:
    | string
    | null;

  unit_price: number;

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