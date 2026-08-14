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
    .select("*")
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