export type WarehouseDirectoryFilters = { q: string; category: string; stock: "all" | "low" | "out" | "normal" };
export type WarehouseQuery = Record<string, string | string[] | undefined>;

export function warehouseQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveWarehouseFilters(query: WarehouseQuery, categories: string[]): WarehouseDirectoryFilters {
  const stock = warehouseQueryValue(query.stock);
  const category = warehouseQueryValue(query.category) || "";
  return {
    q: (warehouseQueryValue(query.q) || "").trim().slice(0, 100),
    category: categories.includes(category) ? category : "",
    stock: stock === "low" || stock === "out" || stock === "normal" ? stock : "all",
  };
}

export function warehouseDirectoryHref(filters: WarehouseDirectoryFilters, page = 1, query: WarehouseQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const single = warehouseQueryValue(value);
    if (key.startsWith("ledger_") && single) params.set(key, single);
  }
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.stock !== "all") params.set("stock", filters.stock);
  if (page > 1) params.set("page", String(page));
  return `/warehouse${params.size ? `?${params}` : ""}`;
}
