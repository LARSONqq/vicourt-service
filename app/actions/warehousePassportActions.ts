"use server";

import { revalidatePath } from "next/cache";

import { createMaterial, returnMaterialToWarehouse } from "@/app/actions/materialActions";
import { completeWarehousePurchase, createWarehousePurchase } from "@/app/actions/purchaseActions";
import { createWarehouseMovement } from "@/app/actions/warehouseMovementActions";
import { canManagePurchases, canManageWarehouse, canUseWarehouseForObjects } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";
import { getWarehouseItem } from "@/services/warehouseService";
import type { WarehouseOperation, WarehouseOperationOptions, WarehouseOperationResult } from "@/types/warehouseOperation";

class OperationInputError extends Error {}

function positiveId(value: number, message: string) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new OperationInputError(message);
  return value;
}

async function requireOperationAccess(operation: WarehouseOperation | "plan") {
  const profile = await getCurrentUserProfile();
  const allowed = profile && (
    operation === "adjustment" ? canManageWarehouse(profile.role)
      : operation === "receipt" || operation === "plan" ? canManagePurchases(profile.role)
        : operation === "issue" || operation === "return" ? canUseWarehouseForObjects(profile.role)
          : false
  );
  if (!allowed) throw new OperationInputError("Немає прав для цієї складської операції. Увійдіть активним обліковим записом із відповідними правами.");
}

function operationError(error: unknown): { ok: false; error: string } {
  if (error instanceof OperationInputError) return { ok: false, error: error.message };
  const message = error instanceof Error ? error.message : "";
  // Existing actions throw domain errors. Only known public messages cross this boundary.
  const knownMessages = [
    "Недостатньо матеріалу на складі.",
    "Не можна повернути більше, ніж є на об’єкті.",
    "Закупівлю вже оприбутковано.",
    "Закупівлю не знайдено.",
    "Позицію складу не знайдено.",
    "Матеріал не знайдено.",
    "Об’єкт не знайдено.",
    "Для виконання цієї дії потрібно увійти в систему.",
    "Потрібно увійти в систему.",
  ];
  const known = knownMessages.find((text) => message === text || message.endsWith(`: ${text}`));
  if (known) return { ok: false, error: known };
  console.error("[WarehousePassport] Operation failed", error);
  return { ok: false, error: "Не вдалося виконати операцію. Оновіть дані перед повторною спробою та перевірте історію матеріалу." };
}

export async function loadWarehouseOperationOptions(
  itemId: number,
  operation: WarehouseOperation,
  page = 1
): Promise<WarehouseOperationResult<WarehouseOperationOptions>> {
  try {
    await requireOperationAccess(operation);
    positiveId(itemId, "Не вдалося визначити матеріал.");
    const item = await getWarehouseItem(itemId);
    if (!item) throw new OperationInputError("Позицію складу не знайдено.");
    const supabase = await createClient();
    const safePage = Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
    const from = (safePage - 1) * 50;
    const result: WarehouseOperationOptions = {
      currentQuantity: Number(item.quantity), objects: [], allocations: [], purchases: [],
      page: safePage, hasMore: false,
    };
    if (operation === "issue") {
      const { data, error } = await supabase.from("objects").select("id, name")
        .order("name").order("id").range(from, from + 50);
      if (error) throw error;
      result.hasMore = data.length > 50;
      result.objects = data.slice(0, 50);
    } else if (operation === "return") {
      const { data, error } = await supabase.from("materials")
        .select("id, object_id, quantity, object:objects(id, name)")
        .eq("warehouse_item_id", itemId).gt("quantity", 0)
        .order("object_id").order("id").range(from, from + 50)
        .overrideTypes<WarehouseOperationOptions["allocations"], { merge: false }>();
      if (error) throw error;
      result.hasMore = data.length > 50;
      result.allocations = data.slice(0, 50);
    } else if (operation === "receipt") {
      const { data, error } = await supabase.from("warehouse_purchases")
        .select("id, quantity, purchase_price, supplier, note, created_at")
        .eq("item_id", itemId).eq("status", "Заплановано")
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(from, from + 50)
        .overrideTypes<WarehouseOperationOptions["purchases"], { merge: false }>();
      if (error) throw error;
      result.hasMore = data.length > 50;
      result.purchases = data.slice(0, 50);
    }
    return { ok: true, data: result };
  } catch (error) {
    return operationError(error);
  }
}

export async function submitWarehouseOperation(
  formData: FormData
): Promise<WarehouseOperationResult<{ planned: boolean }>> {
  try {
    const operation = String(formData.get("operation")) as WarehouseOperation | "plan";
    await requireOperationAccess(operation);
    const itemId = positiveId(Number(formData.get("item_id")), "Не вдалося визначити матеріал.");
    const item = await getWarehouseItem(itemId);
    if (!item) throw new OperationInputError("Позицію складу не знайдено.");
    const supabase = await createClient();
    const payload = new FormData();
    payload.set("item_id", String(itemId));

    if (operation === "receipt") {
      const purchaseId = positiveId(Number(formData.get("purchase_id")), "Оберіть заплановану закупівлю.");
      const { data, error } = await supabase.from("warehouse_purchases").select("id, status")
        .eq("id", purchaseId).eq("item_id", itemId).maybeSingle();
      if (error) throw error;
      if (!data) throw new OperationInputError("Закупівлю цього матеріалу не знайдено.");
      if (data.status !== "Заплановано") throw new OperationInputError("Закупівлю вже оприбутковано.");
      await completeWarehousePurchase(purchaseId);
    } else {
      const quantity = Number(formData.get("quantity"));
      if (!Number.isFinite(quantity) || quantity <= 0) throw new OperationInputError("Кількість повинна бути більшою за нуль.");
      payload.set("quantity", String(quantity));

      if (operation === "issue") {
        const objectId = positiveId(Number(formData.get("object_id")), "Оберіть об’єкт.");
        const { data, error } = await supabase.from("objects").select("id").eq("id", objectId).maybeSingle();
        if (error) throw error;
        if (!data) throw new OperationInputError("Об’єкт не знайдено.");
        if (quantity > Number(item.quantity)) throw new OperationInputError("Недостатньо матеріалу на складі.");
        payload.set("object_id", String(objectId));
        payload.set("source_type", "warehouse");
        payload.set("warehouse_item_id", String(itemId));
        await createMaterial(payload);
      } else if (operation === "return") {
        const materialId = positiveId(Number(formData.get("material_id")), "Оберіть матеріал, виданий на об’єкт.");
        const { data, error } = await supabase.from("materials").select("id, object_id, quantity")
          .eq("id", materialId).eq("warehouse_item_id", itemId).maybeSingle();
        if (error) throw error;
        if (!data) throw new OperationInputError("Матеріал не знайдено або він не походить із цієї позиції складу.");
        if (quantity > Number(data.quantity)) throw new OperationInputError("Не можна повернути більше, ніж є на об’єкті.");
        payload.set("material_id", String(materialId));
        payload.set("object_id", String(data.object_id));
        await returnMaterialToWarehouse(payload);
      } else if (operation === "adjustment") {
        const direction = String(formData.get("direction"));
        const reason = String(formData.get("reason") ?? "").trim();
        if (direction !== "in" && direction !== "out") throw new OperationInputError("Оберіть напрям коригування.");
        if (!reason || reason.length > 2000) throw new OperationInputError("Вкажіть причину коригування (до 2000 символів).");
        if (direction === "out" && quantity > Number(item.quantity)) throw new OperationInputError("Недостатньо матеріалу на складі.");
        const rawCost = String(formData.get("unit_cost") ?? "").trim();
        if (direction === "in" && (!rawCost || !Number.isFinite(Number(rawCost)) || Number(rawCost) < 0)) {
          throw new OperationInputError("Вкажіть невід’ємну облікову ціну за одиницю.");
        }
        payload.set("direction", direction);
        payload.set("reason", reason);
        payload.set("unit_cost", direction === "in" ? rawCost : "");
        await createWarehouseMovement(payload);
      } else if (operation === "plan") {
        const price = String(formData.get("purchase_price") ?? "").trim();
        if (!price || !Number.isFinite(Number(price)) || Number(price) < 0) throw new OperationInputError("Вкажіть невід’ємну закупівельну ціну.");
        const supplier = String(formData.get("supplier") ?? "").trim();
        const note = String(formData.get("note") ?? "").trim();
        if (supplier.length > 500 || note.length > 2000) throw new OperationInputError("Постачальник: до 500 символів; примітка: до 2000 символів.");
        payload.set("purchase_price", price);
        payload.set("supplier", supplier);
        payload.set("note", note);
        await createWarehousePurchase(payload);
      }
    }

    // Canonical actions already invalidate directory/object/report consumers.
    revalidatePath(`/warehouse/${itemId}`);
    return { ok: true, data: { planned: operation === "plan" } };
  } catch (error) {
    return operationError(error);
  }
}
