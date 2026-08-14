import { createClient } from "@/lib/supabase/server";

import type { Equipment } from "@/types/equipment";
import type { EquipmentServiceRecord } from "@/types/equipmentServiceRecord";

export async function getEquipment(): Promise<Equipment[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("equipment")
    .select("*")
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити техніку: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as Equipment[];
}

export async function getEquipmentServiceRecords(): Promise<
  EquipmentServiceRecord[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "equipment_service_records"
    )
    .select(`
      id,
      equipment_id,
      service_type,
      service_date,
      cost,
      performed_by,
      description,
      next_service_date,
      created_at,
      equipment:equipment (
        id,
        name,
        inventory_number
      )
    `)
    .order(
      "service_date",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .overrideTypes<
      EquipmentServiceRecord[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію обслуговування: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getEquipmentServiceRecordsByEquipmentId(
  equipmentId: number
): Promise<
  EquipmentServiceRecord[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "equipment_service_records"
    )
    .select(`
      id,
      equipment_id,
      service_type,
      service_date,
      cost,
      performed_by,
      description,
      next_service_date,
      created_at,
      equipment:equipment (
        id,
        name,
        inventory_number
      )
    `)
    .eq(
      "equipment_id",
      equipmentId
    )
    .order(
      "service_date",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .overrideTypes<
      EquipmentServiceRecord[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити обслуговування техніки: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}