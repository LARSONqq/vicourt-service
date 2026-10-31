import "server-only";

import { createClient } from "@/lib/supabase/server";

const MAX_DASHBOARD_ITEMS = 5;

type WarehousePreviewRow = {
  item_id: number;
  name: string;
  quantity: number;
  min_quantity: number | null;
  stock_state: "out" | "low";
};

type EquipmentPreviewRow = {
  equipment_id: number;
  name: string;
  next_service_date: string | null;
  attention_state: "overdue" | "due_now" | "repair_required" | "in_repair" | "upcoming";
  usage_due: boolean;
};

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseWarehouseRows(value: unknown): WarehousePreviewRow[] | null {
  if (!Array.isArray(value) || value.length > MAX_DASHBOARD_ITEMS) return null;
  const rows: WarehousePreviewRow[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const row = candidate as Record<string, unknown>;
    if (!hasExactKeys(row, ["item_id", "name", "quantity", "min_quantity", "stock_state"])
      || !isPositiveInteger(row.item_id)
      || typeof row.name !== "string"
      || !isFiniteNumber(row.quantity)
      || (row.min_quantity !== null && !isFiniteNumber(row.min_quantity))
      || (row.stock_state !== "out" && row.stock_state !== "low")) return null;
    if ((row.stock_state === "out" && row.quantity > 0)
      || (row.stock_state === "low" && !(row.quantity > 0 && row.min_quantity !== null && row.quantity <= row.min_quantity))) return null;
    rows.push(row as WarehousePreviewRow);
  }
  return rows;
}

function parseEquipmentRows(value: unknown): EquipmentPreviewRow[] | null {
  if (!Array.isArray(value) || value.length > MAX_DASHBOARD_ITEMS) return null;
  const rows: EquipmentPreviewRow[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const row = candidate as Record<string, unknown>;
    if (!hasExactKeys(row, ["equipment_id", "name", "next_service_date", "attention_state", "usage_due"])
      || !isPositiveInteger(row.equipment_id)
      || typeof row.name !== "string"
      || (row.next_service_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(row.next_service_date as string))
      || !["overdue", "due_now", "repair_required", "in_repair", "upcoming"].includes(row.attention_state as string)
      || typeof row.usage_due !== "boolean") return null;
    rows.push(row as EquipmentPreviewRow);
  }
  return rows;
}

export async function getDashboardWarehouseAttentionItems() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_dashboard_warehouse_attention_items")
    .overrideTypes<WarehousePreviewRow[], { merge: false }>();
  const rows = parseWarehouseRows(data);
  if (error || rows === null) throw new Error("Не вдалося завантажити залишки складу.");
  return rows.map((row) => ({
    id: row.item_id,
    name: row.name,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    stockStatus: row.stock_state === "out" ? "OUT_OF_STOCK" as const : "LOW_STOCK" as const,
  }));
}

export async function getDashboardEquipmentAttentionItems(businessDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_dashboard_equipment_attention_items", { p_business_date: businessDate })
    .overrideTypes<EquipmentPreviewRow[], { merge: false }>();
  const rows = parseEquipmentRows(data);
  if (error || rows === null) throw new Error("Не вдалося завантажити план ТО.");
  return rows.map((row) => ({
    id: row.equipment_id,
    name: row.name,
    date: row.next_service_date,
    state: row.attention_state,
    usageDue: row.usage_due,
  }));
}
