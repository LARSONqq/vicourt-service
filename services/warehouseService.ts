import { cache } from "react";

import { isWarehouseMovementCode } from "@/constants/warehouseLedger";
import {
  buildSafeOrIlikeFilter,
  getSafeSearchCandidateToken,
} from "@/lib/globalSearch";
import {
  addDaysToDateValue,
  getKyivDateStartUtc,
  isValidDateValue,
} from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";

import type {
  ManagementWarehouseItem,
  WarehouseItem,
} from "@/types/warehouseItem";
import type {
  WarehouseMovement,
  WarehouseMovementPage,
} from "@/types/warehouseMovement";

const WAREHOUSE_LEDGER_PAGE_SIZE = 50;
const WAREHOUSE_LEDGER_SEARCH_MAX_LENGTH = 100;
const WAREHOUSE_LEDGER_SEARCH_COLUMNS = [
  "item_name_snapshot",
  "object_name_snapshot",
  "performed_by_name",
  "note",
] as const;

const WAREHOUSE_ITEM_OPERATIONAL_SELECT = `
  id,
  name,
  category,
  quantity,
  unit,
  min_quantity,
  target_quantity,
  supplier,
  created_at
`;

const WAREHOUSE_MOVEMENT_SELECT = `
  id,
  item_id,
  material_id,
  object_id,
  movement_type,
  movement_code,
  ledger_version,
  quantity,
  unit_price,
  total_cost,
  item_name_snapshot,
  unit_snapshot,
  object_name_snapshot,
  warehouse_quantity_after,
  object_quantity_after,
  source_type,
  source_id,
  note,
  created_at,
  performed_by,
  performed_by_name,
  item:warehouse_items (
    id,
    name,
    unit
  ),
  object:objects (
    id,
    name
  )
`;

export type WarehouseLedgerFilters = {
  itemId?: number;
  objectId?: number;
  movementCode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
};

async function loadWarehouseItems(): Promise<WarehouseItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouse_items")
    .select(
      WAREHOUSE_ITEM_OPERATIONAL_SELECT
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error(
      `Не вдалося завантажити склад: ${error.message}`
    );
  }

  return Array.isArray(data) ? (data as WarehouseItem[]) : [];
}

export const getWarehouseItems = cache(loadWarehouseItems);

async function loadManagementWarehouseItems(): Promise<
  ManagementWarehouseItem[]
> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_warehouse_items"
      )
      .order("name", {
        ascending: true,
      })
      .overrideTypes<
        ManagementWarehouseItem[],
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити облікову вартість складу: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export const getManagementWarehouseItems =
  cache(
    loadManagementWarehouseItems
  );

function normalizePositiveInteger(value: number | undefined) {
  return Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : undefined;
}

function normalizeLedgerFilters(filters: WarehouseLedgerFilters) {
  const search = (filters.search || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, WAREHOUSE_LEDGER_SEARCH_MAX_LENGTH);

  return {
    itemId: normalizePositiveInteger(filters.itemId),
    objectId: normalizePositiveInteger(filters.objectId),
    movementCode:
      filters.movementCode &&
      isWarehouseMovementCode(filters.movementCode)
        ? filters.movementCode
        : undefined,
    dateFrom:
      filters.dateFrom && isValidDateValue(filters.dateFrom)
        ? filters.dateFrom
        : undefined,
    dateTo:
      filters.dateTo && isValidDateValue(filters.dateTo)
        ? filters.dateTo
        : undefined,
    search,
    page:
      Number.isInteger(filters.page) && Number(filters.page) > 0
        ? Number(filters.page)
        : 1,
  };
}

export async function getWarehouseMovementPage(
  filters: WarehouseLedgerFilters = {}
): Promise<WarehouseMovementPage> {
  const supabase = await createClient();
  const normalized = normalizeLedgerFilters(filters);
  const from = (normalized.page - 1) * WAREHOUSE_LEDGER_PAGE_SIZE;
  const to = from + WAREHOUSE_LEDGER_PAGE_SIZE - 1;

  let query = supabase
    .from("warehouse_movements")
    .select(WAREHOUSE_MOVEMENT_SELECT, { count: "exact" });

  if (normalized.itemId) {
    query = query.eq("item_id", normalized.itemId);
  }

  if (normalized.objectId) {
    query = query.eq("object_id", normalized.objectId);
  }

  if (normalized.movementCode) {
    query = query.eq("movement_code", normalized.movementCode);
  }

  if (normalized.dateFrom) {
    const timestampFrom = getKyivDateStartUtc(normalized.dateFrom);

    if (timestampFrom) {
      query = query.gte("created_at", timestampFrom);
    }
  }

  if (normalized.dateTo) {
    const timestampTo = getKyivDateStartUtc(
      addDaysToDateValue(normalized.dateTo, 1)
    );

    if (timestampTo) {
      query = query.lt("created_at", timestampTo);
    }
  }

  const searchToken = getSafeSearchCandidateToken(normalized.search);

  if (searchToken) {
    query = query.or(
      buildSafeOrIlikeFilter(
        WAREHOUSE_LEDGER_SEARCH_COLUMNS,
        searchToken
      )
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)
    .overrideTypes<WarehouseMovement[]>();

  if (error) {
    throw new Error(
      `Не вдалося завантажити журнал рухів матеріалів: ${error.message}`
    );
  }

  const total = count || 0;

  return {
    movements: Array.isArray(data) ? data : [],
    total,
    page: normalized.page,
    pageSize: WAREHOUSE_LEDGER_PAGE_SIZE,
    hasPreviousPage: normalized.page > 1,
    hasNextPage: to + 1 < total,
  };
}

export async function getObjectMaterialMovements(
  objectId: number,
  limit = 20
): Promise<WarehouseMovement[]> {
  if (!Number.isInteger(objectId) || objectId <= 0) {
    return [];
  }

  const supabase = await createClient();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const { data, error } = await supabase
    .from("warehouse_movements")
    .select(WAREHOUSE_MOVEMENT_SELECT)
    .eq("object_id", objectId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit)
    .overrideTypes<WarehouseMovement[]>();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію матеріалів об’єкта: ${error.message}`
    );
  }

  return Array.isArray(data) ? data : [];
}
