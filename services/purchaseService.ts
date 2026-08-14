import { createClient } from "@/lib/supabase/server";

import type { WarehousePurchase } from "@/types/warehousePurchase";

type PlannedPurchaseRow = {
  item_id: number;
  quantity: number;
};

export type PlannedPurchaseTotals = Record<
  number,
  number
>;

export async function getWarehousePurchases(): Promise<
  WarehousePurchase[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("warehouse_purchases")
    .select(`
      id,
      item_id,
      quantity,
      purchase_price,
      supplier,
      note,
      status,
      created_at,
      purchased_at,
      item:warehouse_items (
        id,
        name,
        unit,
        quantity,
        min_quantity
      )
    `)
    .order("created_at", {
      ascending: false,
    })
    .overrideTypes<
      WarehousePurchase[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити закупівлі: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getPlannedPurchaseTotals(): Promise<
  PlannedPurchaseTotals
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("warehouse_purchases")
    .select(`
      item_id,
      quantity
    `)
    .eq(
      "status",
      "Заплановано"
    )
    .overrideTypes<
      PlannedPurchaseRow[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити заплановані закупівлі: ${error.message}`
    );
  }

  const rows =
    Array.isArray(data)
      ? data
      : [];

  return rows.reduce<
    PlannedPurchaseTotals
  >(
    (
      totals,
      purchase
    ) => {
      const itemId =
        Number(
          purchase.item_id
        );

      const quantity =
        Number(
          purchase.quantity
        );

      if (
        !Number.isInteger(
          itemId
        ) ||
        itemId <= 0 ||
        !Number.isFinite(
          quantity
        )
      ) {
        return totals;
      }

      totals[itemId] =
        (totals[itemId] ||
          0) +
        quantity;

      return totals;
    },
    {}
  );
}