import { createClient } from "@/lib/supabase/client";

import type { Equipment } from "@/types/equipment";

export async function getEquipmentClient(): Promise<
  Equipment[]
> {
  const supabase =
    createClient();

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