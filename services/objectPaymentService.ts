import {
  createClient,
} from "@/lib/supabase/server";

import type {
  ObjectPayment,
} from "@/types/objectPayment";

export async function getObjectPayments(
  objectId: number
): Promise<ObjectPayment[]> {
  if (
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    return [];
  }

  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("object_payments")
    .select(`
      id,
      object_id,
      payment_date,
      amount,
      payment_method,
      note,
      created_at,
      updated_at
    `)
    .eq(
      "object_id",
      objectId
    )
    .order(
      "payment_date",
      { ascending: false }
    )
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .overrideTypes<
      ObjectPayment[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити платежі клієнта: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}
