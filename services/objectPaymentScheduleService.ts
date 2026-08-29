import {
  createClient,
} from "@/lib/supabase/server";
import {
  fromMoneyInCents,
  toMoneyInCents,
} from "@/lib/objectPayments";

import type {
  ObjectPaymentScheduleItem,
  ObjectPaymentScheduleWithObject,
} from "@/types/objectPaymentSchedule";

const SCHEDULE_SELECT = `
  id,
  object_id,
  title,
  due_date,
  amount,
  note,
  created_at,
  updated_at
`;

export async function getObjectPaymentSchedule(
  objectId: number
): Promise<
  ObjectPaymentScheduleItem[]
> {
  if (
    !Number.isInteger(objectId) ||
    objectId <= 0
  ) {
    return [];
  }

  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from(
        "object_payment_schedule"
      )
      .select(SCHEDULE_SELECT)
      .eq("object_id", objectId)
      .order("due_date", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      })
      .overrideTypes<
        ObjectPaymentScheduleItem[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити графік оплат: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getDueObjectPaymentSchedules(
  dueDateTo: string
): Promise<
  ObjectPaymentScheduleWithObject[]
> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from(
        "object_payment_schedule"
      )
      .select(`
        ${SCHEDULE_SELECT},
        object:objects (
          id,
          name
        )
      `)
      .lte(
        "due_date",
        dueDateTo
      )
      .order("due_date", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      })
      .overrideTypes<
        ObjectPaymentScheduleWithObject[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити очікувані платежі: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getObjectPaymentTotals(
  objectIds: number[]
) {
  const uniqueIds =
    Array.from(
      new Set(
        objectIds.filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        )
      )
    );

  if (uniqueIds.length === 0) {
    return new Map<number, number>();
  }

  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from("object_payments")
      .select("object_id, amount")
      .in("object_id", uniqueIds);

  if (error) {
    throw new Error(
      `Не вдалося розрахувати покриття графіка оплат: ${error.message}`
    );
  }

  const totalsInCents =
    new Map<number, number>();

  for (const payment of
    Array.isArray(data)
      ? data
      : []) {
    const objectId = Number(
      payment.object_id
    );
    const amount = Number(
      payment.amount
    );

    if (
      !Number.isInteger(objectId) ||
      objectId <= 0 ||
      !Number.isFinite(amount)
    ) {
      continue;
    }

    totalsInCents.set(
      objectId,
      (totalsInCents.get(
        objectId
      ) || 0) +
        Math.max(
          toMoneyInCents(
            amount
          ),
          0
        )
    );
  }

  return new Map(
    Array.from(
      totalsInCents.entries()
    ).map(
      ([objectId, total]) => [
        objectId,
        fromMoneyInCents(
          total
        ),
      ]
    )
  );
}
