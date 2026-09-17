import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canViewWarehouseLedger } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";
import { getWarehouseStockStatus } from "@/lib/warehouseStock";
import { resolveWarehouseFilters, warehouseQueryValue, type WarehouseQuery } from "@/lib/warehouseDirectory";
import type { WarehouseItem } from "@/types/warehouseItem";

type IndexRow = Pick<WarehouseItem, "id" | "name" | "category" | "supplier" | "quantity" | "min_quantity" | "purchase_price">;
const operationalColumns = "id, name, category, quantity, unit, min_quantity, target_quantity, supplier, created_at";

export async function getWarehouseDirectory(query: WarehouseQuery) {
  const profile = await getCurrentUserProfile();
  if (!profile) throw new Error("Потрібно увійти в систему.");
  const management = canViewWarehouseLedger(profile.role);
  const supabase = await createClient();
  const index: IndexRow[] = [];
  // Existing RPC/PostgREST contract cannot compare quantity with another column.
  // A bounded, operational index scan gives exact global counts and server filtering.
  // Only the chosen 20 full item rows are sent to the client. A future stock RPC
  // can replace this O(N) scan without changing the URL or presentation contract.
  for (let from = 0; ; from += 500) {
    const columns = "id, name, category, supplier, quantity, min_quantity";
    const source = management
      ? supabase.rpc("get_management_warehouse_items").select(`${columns}, purchase_price`)
      : supabase.from("warehouse_items").select(columns);
    const { data, error } = await source.order("name").order("id").range(from, from + 499)
      .overrideTypes<IndexRow[], { merge: false }>();
    if (error || !Array.isArray(data)) throw new Error("Не вдалося завантажити залишки складу.");
    index.push(...data);
    if (data.length < 500) break;
  }
  const categories = [...new Set(index.map((row) => row.category).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "uk"));
  const filters = resolveWarehouseFilters(query, categories);
  const stats = { total: index.length, out: 0, low: 0, normal: 0 };
  for (const row of index) {
    const status = getWarehouseStockStatus(row);
    stats[status === "OUT_OF_STOCK" ? "out" : status === "LOW_STOCK" ? "low" : "normal"]++;
  }
  const matched = index.filter((row) => {
    const status = getWarehouseStockStatus(row);
    const stock = status === "OUT_OF_STOCK" ? "out" : status === "LOW_STOCK" ? "low" : "normal";
    return (filters.stock === "all" || filters.stock === stock)
      && (!filters.category || row.category === filters.category)
      && (!filters.q || [row.name, row.category, row.supplier].filter(Boolean).join(" ").toLocaleLowerCase("uk").includes(filters.q.toLocaleLowerCase("uk")));
  });
  const rawPage = warehouseQueryValue(query.page) || "1";
  let requestedPage = /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) && Number(rawPage) > 0 ? Number(rawPage) : 1;
  // Preserve older /warehouse?item= links to a highlighted material.
  const focusedId = Number(warehouseQueryValue(query.item));
  if (!query.page && Number.isSafeInteger(focusedId) && focusedId > 0) {
    const position = matched.findIndex((row) => Number(row.id) === focusedId);
    if (position >= 0) requestedPage = Math.floor(position / 20) + 1;
  }
  const pageCount = Math.max(1, Math.ceil(matched.length / 20));
  const page = Math.min(requestedPage, pageCount);
  const ids = matched.slice((page - 1) * 20, page * 20).map((row) => row.id);
  let items: WarehouseItem[] = [];
  if (ids.length) {
    const source = management
      ? supabase.rpc("get_management_warehouse_items").select(`${operationalColumns}, purchase_price`)
      : supabase.from("warehouse_items").select(operationalColumns);
    const { data, error } = await source.in("id", ids).order("name").order("id")
      .overrideTypes<WarehouseItem[], { merge: false }>();
    if (error || !Array.isArray(data)) throw new Error("Не вдалося завантажити сторінку складу.");
    items = data;
  }
  return {
    items, filters, categories, stats, page, pageCount, total: matched.length,
    totalValue: management ? index.reduce((sum, row) => sum + Number(row.quantity) * Number(row.purchase_price), 0) : null,
    supplierCount: new Set(index.map((row) => row.supplier).filter(Boolean)).size,
    ledgerItems: management ? index.map(({ id, name }) => ({ id, name })) : [],
  };
}
