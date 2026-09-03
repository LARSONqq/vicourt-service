import {
  WAREHOUSE_MOVEMENT_CODES,
  type WarehouseMovementCode,
} from "@/types/warehouseMovement";

export const warehouseMovementLabels: Record<
  WarehouseMovementCode,
  string
> = {
  legacy_receipt: "Legacy-прихід",
  legacy_write_off: "Legacy-списання",
  purchase_receipt: "Оприбуткування закупівлі",
  issue_to_object: "Видано на об’єкт",
  return_from_object: "Повернено з об’єкта",
  adjustment_in: "Корекція залишку +",
  adjustment_out: "Корекція залишку −",
  opening_balance: "Початковий залишок складу",
  object_opening_balance: "Початковий залишок об’єкта",
  direct_to_object: "Матеріал додано напряму",
  direct_object_reversal: "Матеріал зменшено / видалено",
};

export const warehouseMovementOptions =
  WAREHOUSE_MOVEMENT_CODES.map((value) => ({
    value,
    label: warehouseMovementLabels[value],
  }));

export function isWarehouseMovementCode(
  value: string
): value is WarehouseMovementCode {
  return WAREHOUSE_MOVEMENT_CODES.some(
    (movementCode) => movementCode === value
  );
}

export function isWarehouseInboundMovement(
  movementCode: WarehouseMovementCode
) {
  return [
    "legacy_receipt",
    "purchase_receipt",
    "return_from_object",
    "adjustment_in",
    "opening_balance",
  ].includes(movementCode);
}

export function isWarehouseOutboundMovement(
  movementCode: WarehouseMovementCode
) {
  return [
    "legacy_write_off",
    "issue_to_object",
    "adjustment_out",
  ].includes(movementCode);
}
