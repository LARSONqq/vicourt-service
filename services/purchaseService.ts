import {
  cache,
} from "react";

import { createClient } from "@/lib/supabase/server";
import { canManagePurchases } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";
import {
  buildWarehousePurchaseInsights,
} from "@/lib/warehousePlanning";

import type {
  WarehousePurchase,
  WarehousePurchaseHistoryEntry,
  WarehousePurchaseInsights,
  WarehouseItemPurchasePreview,
  WarehousePurchaseStatus,
} from "@/types/warehousePurchase";

export type PurchaseQueryFilters = {
  status?: WarehousePurchaseStatus;
};

type PlannedPurchaseRow = {
  item_id: number;
  quantity: number;
};

export type PlannedPurchaseTotals = Record<
  number,
  number
>;

const PURCHASE_PAGE_SIZE =
  500;

async function requirePurchaseReadAccess() {
  const profile = await getCurrentUserProfile();
  if (!profile || !canManagePurchases(profile.role)) throw new Error("Недостатньо прав для перегляду закупівель.");
}

export async function getWarehousePlannedQuantities(itemIds: number[]): Promise<Record<number, number>> {
  await requirePurchaseReadAccess();
  const ids = [...new Set(itemIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return {};
  const supabase = await createClient();
  const totals: Record<number, number> = {};
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("warehouse_purchases")
      .select("id, item_id, quantity").in("item_id", ids).eq("status", "Заплановано")
      .order("id").range(from, from + 499);
    if (error) throw new Error("Не вдалося завантажити план закупівель.");
    for (const row of data) totals[row.item_id] = Math.round(((totals[row.item_id] || 0) + Number(row.quantity)) * 1_000_000) / 1_000_000;
    if (data.length < 500) break;
  }
  return totals;
}

export type PlannedPurchaseOverview = {
  id: number; item_id: number; quantity: number; supplier: string | null; status: string;
  item: { id: number; name: string; unit: string } | null;
};

export async function getWarehousePlannedPurchaseOverview(): Promise<PlannedPurchaseOverview[]> {
  await requirePurchaseReadAccess();
  const supabase = await createClient();
  const { data, error } = await supabase.from("warehouse_purchases")
    .select("id, item_id, quantity, supplier, status, item:warehouse_items(id, name, unit)")
    .eq("status", "Заплановано").order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(8).overrideTypes<PlannedPurchaseOverview[], { merge: false }>();
  if (error) throw new Error("Не вдалося завантажити заплановані закупівлі.");
  return data;
}

export async function getWarehousePurchases(
  filters: PurchaseQueryFilters = {}
): Promise<
  WarehousePurchase[]
> {
  const supabase =
    await createClient();
  const purchases:
    WarehousePurchase[] = [];

  for (
    let from = 0;
    ;
    from += PURCHASE_PAGE_SIZE
  ) {
    let query = supabase
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
      `);

    if (filters.status) {
      query = query.eq(
        "status",
        filters.status
      );
    }

    const {
      data,
      error,
    } = await query
      .order("created_at", {
        ascending: false,
      })
      .range(
        from,
        from +
          PURCHASE_PAGE_SIZE -
          1
      )
      .overrideTypes<
        WarehousePurchase[]
      >();

    if (error) {
      throw new Error(
        `Не вдалося завантажити закупівлі: ${error.message}`
      );
    }

    const page =
      Array.isArray(data)
        ? data
        : [];

    purchases.push(
      ...page
    );

    if (
      page.length <
      PURCHASE_PAGE_SIZE
    ) {
      break;
    }
  }

  return purchases;
}

export const getPlannedWarehousePurchases =
  cache(
    async () =>
      getWarehousePurchases({
        status:
          "Заплановано",
      })
  );

export async function getWarehousePurchaseInsights(): Promise<WarehousePurchaseInsights> {
  const purchases =
    await getWarehousePurchases();

  return buildWarehousePurchaseInsights(
    purchases
  );
}

export async function getWarehouseItemPurchaseHistory(
  itemId: number,
  limit = 20
): Promise<
  WarehousePurchaseHistoryEntry[]
> {
  const supabase =
    await createClient();
  const safeLimit =
    Math.min(
      Math.max(
        Math.trunc(limit),
        1
      ),
      20
    );
  const {
    data,
    error,
  } = await supabase
    .from("warehouse_purchases")
    .select(`
      id,
      quantity,
      purchase_price,
      supplier,
      purchased_at
    `)
    .eq("item_id", itemId)
    .eq(
      "status",
      "Закуплено"
    )
    .not(
      "purchased_at",
      "is",
      null
    )
    .order("purchased_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .limit(safeLimit)
    .overrideTypes<
      Array<{
        id: number;
        quantity: number;
        purchase_price: number;
        supplier: string | null;
        purchased_at: string;
      }>
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію закупівель: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ).map((purchase) => {
    const quantity =
      Number(
        purchase.quantity
      );
    const purchasePrice =
      Number(
        purchase.purchase_price
      );

    return {
      id:
        Number(purchase.id),
      quantity,
      purchasePrice,
      totalAmount:
        quantity *
        purchasePrice,
      supplier:
        purchase.supplier,
      purchasedAt:
        purchase.purchased_at,
    };
  });
}

export async function getWarehouseItemPurchasePreview(
  itemId: number,
  limit = 10
): Promise<WarehouseItemPurchasePreview[]> {
  if (
    !Number.isSafeInteger(itemId) ||
    itemId <= 0
  ) {
    return [];
  }

  const supabase = await createClient();
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    20
  );
  const { data, error } = await supabase
    .from("warehouse_purchases")
    .select(`
      id,
      item_id,
      quantity,
      purchase_price,
      supplier,
      status,
      created_at,
      purchased_at
    `)
    .eq("item_id", itemId)
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .limit(safeLimit)
    .overrideTypes<
      WarehouseItemPurchasePreview[],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити закупівлі матеріалу: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getPlannedPurchaseTotals(): Promise<
  PlannedPurchaseTotals
> {
  const purchases =
    await getPlannedWarehousePurchases();
  const rows:
    PlannedPurchaseRow[] =
    purchases.map(
      (purchase) => ({
        item_id:
          purchase.item_id,
        quantity:
          purchase.quantity,
      })
    );

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
