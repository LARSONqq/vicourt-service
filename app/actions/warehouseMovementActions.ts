"use server";

import { revalidatePath } from "next/cache";

import {
  canManageWarehouse,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

type AdjustmentResult = {
  previous_quantity: number;
  new_quantity: number;
  unit_cost: number;
};

async function requireWarehouseManagement() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }

  if (!canManageWarehouse(profile.role)) {
    throw new Error(
      "У тебе немає прав для виконання складських операцій."
    );
  }
}

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function isAdjustmentResult(
  value: unknown
): value is AdjustmentResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return [
    record.previous_quantity,
    record.new_quantity,
    record.unit_cost,
  ].every(
    (item) =>
      typeof item === "number" ||
      (typeof item === "string" && Number.isFinite(Number(item)))
  );
}

export async function createWarehouseMovement(
  formData: FormData
) {
  await requireWarehouseManagement();

  const itemId = Number(formData.get("item_id"));
  const direction = getText(
    formData,
    "direction"
  );
  const quantity = Number(formData.get("quantity"));
  const unitCostValue = getText(formData, "unit_cost");
  const unitCost = unitCostValue
    ? Number(unitCostValue)
    : null;
  const reason = getText(formData, "reason");

  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error("Обери позицію складу.");
  }

  if (direction !== "in" && direction !== "out") {
    throw new Error("Обери напрям корекції.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(
      "Кількість повинна бути більшою за нуль."
    );
  }

  if (
    direction === "in" &&
    (unitCost === null || !Number.isFinite(unitCost) || unitCost < 0)
  ) {
    throw new Error(
      "Для збільшення залишку вкажи коректну облікову ціну."
    );
  }

  if (!reason) {
    throw new Error("Вкажи причину корекції залишку.");
  }

  if (reason.length > 2000) {
    throw new Error(
      "Причина не може перевищувати 2000 символів."
    );
  }

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("warehouse_items")
    .select("id, name, unit")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !item) {
    throw new Error("Позицію складу не знайдено.");
  }

  const { data, error } = await supabase.rpc(
    "adjust_warehouse_stock",
    {
      p_item_id: itemId,
      p_direction: direction,
      p_quantity: quantity,
      p_unit_cost: direction === "in" ? unitCost : null,
      p_reason: reason,
    }
  );

  if (error) {
    if (
      error.message.includes(
        "Недостатньо матеріалу на складі"
      )
    ) {
      throw new Error("Недостатньо матеріалу на складі.");
    }

    throw new Error(
      "Не вдалося скоригувати залишок. Спробуй ще раз."
    );
  }

  if (!isAdjustmentResult(data)) {
    throw new Error(
      "Залишок оновлено, але не вдалося прочитати результат операції."
    );
  }

  const previousQuantity = Number(data.previous_quantity);
  const newQuantity = Number(data.new_quantity);
  const historicalUnitCost = Number(data.unit_cost);

  await recordActivity({
    action: "warehouse_item.stock_adjusted",
    entityType: "material",
    entityId: item.id,
    entityName: item.name,
    description:
      direction === "in"
        ? `Збільшив залишок матеріалу «${item.name}» на ${quantity} ${item.unit}.`
        : `Зменшив залишок матеріалу «${item.name}» на ${quantity} ${item.unit}.`,
    metadata: {
      direction,
      quantity,
      unit: item.unit,
      unit_price: historicalUnitCost,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      reason,
    },
  });

  revalidatePath("/");
  revalidatePath("/warehouse");
  revalidatePath("/notifications");
  revalidatePath("/reports");
}
