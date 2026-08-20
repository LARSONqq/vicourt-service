import { createClient } from "@/lib/supabase/server";

import type { WarehouseItem } from "@/types/warehouseItem";
import type { WarehouseMovement } from "@/types/warehouseMovement";

export async function getWarehouseItems(): Promise<
  WarehouseItem[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("warehouse_items")
    .select("*")
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити склад: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as WarehouseItem[];
}

export async function getWarehouseMovements(): Promise<
  WarehouseMovement[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("warehouse_movements")
    .select(`
      id,
      item_id,
      object_id,
      movement_type,
      quantity,
      note,
      created_at,
      performed_by,
      performed_by_name,
      unit_price,
      item:warehouse_items (
        id,
        name,
        unit
      ),
      object:objects (
        id,
        name
      )
    `)
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .overrideTypes<
      WarehouseMovement[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити рухи складу: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}