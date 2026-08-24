import {
  createClient,
} from "@/lib/supabase/server";

import type {
  ObjectExpense,
} from "@/types/objectExpense";

export async function getObjectExpenses(
  objectId: number
): Promise<ObjectExpense[]> {
  const supabase =
    await createClient();

  if (
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "object_expenses"
    )
    .select(`
      id,
      object_id,
      expense_date,
      category,
      description,
      amount,
      note,
      created_by,
      created_by_name,
      created_at,
      updated_at
    `)
    .eq(
      "object_id",
      objectId
    )
    .order(
      "expense_date",
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
      ObjectExpense[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити витрати об’єкта: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}