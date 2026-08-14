import { createClient } from "@/lib/supabase/server";

import type { Employee } from "@/types/employee";

export async function getEmployees(): Promise<Employee[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("employees")
    .select("*")
    .order(
      "last_name",
      {
        ascending: true,
      }
    )
    .order(
      "first_name",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося завантажити працівників: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as Employee[];
}