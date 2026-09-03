export const WAREHOUSE_MOVEMENT_CODES = [
  "legacy_receipt",
  "legacy_write_off",
  "purchase_receipt",
  "issue_to_object",
  "return_from_object",
  "adjustment_in",
  "adjustment_out",
  "opening_balance",
  "object_opening_balance",
  "direct_to_object",
  "direct_object_reversal",
] as const;

export type WarehouseMovementCode =
  (typeof WAREHOUSE_MOVEMENT_CODES)[number];

export type WarehouseMovementSourceType =
  | "legacy"
  | "purchase"
  | "object_material"
  | "manual_adjustment"
  | "item_creation"
  | "ledger_cutover";

export interface WarehouseMovement {
  id: number;

  item_id: number | null;

  material_id: number | null;

  object_id: number | null;

  movement_type:
    | "Прихід"
    | "Списання";

  quantity: number;

  movement_code: WarehouseMovementCode;

  ledger_version: number;

  item_name_snapshot: string;

  unit_snapshot: string;

  object_name_snapshot: string | null;

  warehouse_quantity_after: number | null;

  object_quantity_after: number | null;

  source_type: WarehouseMovementSourceType;

  source_id: number | null;

  note: string | null;

  created_at: string;

  performed_by:
    | string
    | null;

  performed_by_name:
    | string
    | null;

  unit_price: number;

  total_cost: number;

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

export interface WarehouseMovementPage {
  movements: WarehouseMovement[];
  total: number;
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
