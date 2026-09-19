import "server-only";

import { createClient } from "@/lib/supabase/server";

type WarehouseStockSummaryRow = {
  out_of_stock_count: number;
  low_stock_count: number;
  attention_count: number;
};

function toCount(value: number) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0
    ? count
    : 0;
}

export async function getWarehouseStockSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_warehouse_stock_summary")
    .overrideTypes<WarehouseStockSummaryRow[], { merge: false }>();

  const row = Array.isArray(data)
    ? data[0]
    : null;

  if (error || !row) {
    throw new Error("Не вдалося завантажити підсумок залишків складу.");
  }

  return {
    out: toCount(row.out_of_stock_count),
    low: toCount(row.low_stock_count),
    attention: toCount(row.attention_count),
  };
}
