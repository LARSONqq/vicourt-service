import { createClient } from "@/lib/supabase/client";

import type { ObjectItem } from "@/types/object";

export async function getObjectsClient(): Promise<
  ObjectItem[]
> {
  const supabase =
    createClient();

  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .select(`
      id,
      name,
      customer,
      phone,
      address,
      status,
      manager,
      responsible_employee_id,
      supervision_interval_days,
      last_supervision_date,
      next_supervision_date,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити об’єкти: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as ObjectItem[];
}
