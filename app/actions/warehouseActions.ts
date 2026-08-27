"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageWarehouse } from "@/lib/auth/permissions";

import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

type WarehouseItemSnapshot = {
  id: number;
  name: string;
  min_quantity: number;
  target_quantity: number | null;
  supplier: string | null;
};

async function requireWarehouseManagement() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }

  if (
    !canManageWarehouse(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування складом."
    );
  }

  return profile;
}

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function getNumber(
  formData: FormData,
  field: string
) {
  const value = Number(
    formData.get(field)
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getOptionalNumber(
  formData: FormData,
  field: string
) {
  const rawValue =
    getText(
      formData,
      field
    );

  if (!rawValue) {
    return null;
  }

  const value =
    Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(
      "Вкажи коректне числове значення."
    );
  }

  return value;
}

function validateValues(
  quantity: number,
  minQuantity: number,
  targetQuantity: number | null,
  purchasePrice: number
) {
  if (
    quantity < 0 ||
    minQuantity < 0 ||
    (targetQuantity !== null &&
      targetQuantity < 0) ||
    purchasePrice < 0
  ) {
    throw new Error(
      "Числові значення не можуть бути від’ємними."
    );
  }

  if (
    targetQuantity !== null &&
    targetQuantity <
      minQuantity
  ) {
    throw new Error(
      "Цільовий запас не може бути меншим за мінімальний залишок."
    );
  }
}

export async function createWarehouseItem(
  formData: FormData
) {
  await requireWarehouseManagement();

  const supabase =
    await createClient();

  const name =
    getText(
      formData,
      "name"
    );

  const category =
    getText(
      formData,
      "category"
    );

  const quantity =
    getNumber(
      formData,
      "quantity"
    );

  const unit =
    getText(
      formData,
      "unit"
    );

  const minQuantity =
    getNumber(
      formData,
      "min_quantity"
    );

  const purchasePrice =
    getNumber(
      formData,
      "purchase_price"
    );

  const targetQuantity =
    getOptionalNumber(
      formData,
      "target_quantity"
    );

  const supplier =
    getText(
      formData,
      "supplier"
    );

  if (!name) {
    throw new Error(
      "Вкажи назву матеріалу."
    );
  }

  if (!unit) {
    throw new Error(
      "Обери одиницю виміру."
    );
  }

  validateValues(
    quantity,
    minQuantity,
    targetQuantity,
    purchasePrice
  );

  const {
    data,
    error,
  } =
    await supabase
      .from("warehouse_items")
      .insert({
        name,
        category:
          category || null,
        quantity,
        unit,
        min_quantity:
          minQuantity,
        target_quantity:
          targetQuantity,
        purchase_price:
          purchasePrice,
        supplier:
          supplier || null,
      })
      .select("id")
      .single();

  if (error) {
    throw new Error(
      `Не вдалося створити позицію складу: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "warehouse_item.created",
    entityType:
      "material",
    entityId: data.id,
    entityName: name,
    description:
      `Створив позицію складу «${name}».`,
    metadata: {
      min_quantity:
        minQuantity,
      target_quantity:
        targetQuantity,
      supplier:
        supplier || null,
    },
  });

  revalidatePath(
    "/warehouse"
  );

  revalidatePath("/");
  revalidatePath(
    "/reports"
  );
}

export async function updateWarehouseItem(
  formData: FormData
) {
  await requireWarehouseManagement();

  const supabase =
    await createClient();

  const itemId =
    Number(
      formData.get(
        "item_id"
      )
    );

  const name =
    getText(
      formData,
      "name"
    );

  const category =
    getText(
      formData,
      "category"
    );

  const quantity =
    getNumber(
      formData,
      "quantity"
    );

  const unit =
    getText(
      formData,
      "unit"
    );

  const minQuantity =
    getNumber(
      formData,
      "min_quantity"
    );

  const purchasePrice =
    getNumber(
      formData,
      "purchase_price"
    );

  const targetQuantity =
    getOptionalNumber(
      formData,
      "target_quantity"
    );

  const supplier =
    getText(
      formData,
      "supplier"
    );

  if (
    !Number.isInteger(
      itemId
    ) ||
    itemId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити позицію складу."
    );
  }

  if (!name) {
    throw new Error(
      "Вкажи назву матеріалу."
    );
  }

  if (!unit) {
    throw new Error(
      "Обери одиницю виміру."
    );
  }

  validateValues(
    quantity,
    minQuantity,
    targetQuantity,
    purchasePrice
  );

  const {
    data: previousItem,
    error: previousItemError,
  } = await supabase
    .from("warehouse_items")
    .select(`
      id,
      name,
      min_quantity,
      target_quantity,
      supplier
    `)
    .eq("id", itemId)
    .maybeSingle()
    .overrideTypes<
      WarehouseItemSnapshot | null
    >();

  if (previousItemError) {
    throw new Error(
      `Не вдалося завантажити позицію складу: ${previousItemError.message}`
    );
  }

  if (!previousItem) {
    throw new Error(
      "Позицію складу не знайдено."
    );
  }

  const { error } =
    await supabase
      .from("warehouse_items")
      .update({
        name,
        category:
          category || null,
        quantity,
        unit,
        min_quantity:
          minQuantity,
        target_quantity:
          targetQuantity,
        purchase_price:
          purchasePrice,
        supplier:
          supplier || null,
      })
      .eq(
        "id",
        itemId
      );

  if (error) {
    throw new Error(
      `Не вдалося оновити позицію складу: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "warehouse_item.updated",
    entityType:
      "material",
    entityId: itemId,
    entityName: name,
    description:
      `Оновив позицію складу «${name}».`,
    metadata: {
      old_min_quantity:
        Number(
          previousItem.min_quantity
        ),
      new_min_quantity:
        minQuantity,
      old_target_quantity:
        previousItem.target_quantity ===
        null
          ? null
          : Number(
              previousItem.target_quantity
            ),
      new_target_quantity:
        targetQuantity,
      old_supplier:
        previousItem.supplier,
      new_supplier:
        supplier || null,
    },
  });

  revalidatePath(
    "/warehouse"
  );

  revalidatePath("/");
  revalidatePath(
    "/reports"
  );
}

export async function deleteWarehouseItem(
  itemId: number
) {
  await requireWarehouseManagement();

  const supabase =
    await createClient();

  if (
    !Number.isInteger(
      itemId
    ) ||
    itemId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити позицію складу."
    );
  }

  const {
    data: previousItem,
    error: previousItemError,
  } = await supabase
    .from("warehouse_items")
    .select(`
      id,
      name,
      min_quantity,
      target_quantity,
      supplier
    `)
    .eq("id", itemId)
    .maybeSingle()
    .overrideTypes<
      WarehouseItemSnapshot | null
    >();

  if (previousItemError) {
    throw new Error(
      `Не вдалося завантажити позицію складу: ${previousItemError.message}`
    );
  }

  const { error } =
    await supabase
      .from("warehouse_items")
      .delete()
      .eq(
        "id",
        itemId
      );

  if (error) {
    throw new Error(
      `Не вдалося видалити позицію складу: ${error.message}`
    );
  }

  if (previousItem) {
    await recordActivity({
      action:
        "warehouse_item.deleted",
      entityType:
        "material",
      entityId: itemId,
      entityName:
        previousItem.name,
      description:
        `Видалив позицію складу «${previousItem.name}».`,
      metadata: {
        min_quantity:
          Number(
            previousItem.min_quantity
          ),
        target_quantity:
          previousItem.target_quantity ===
          null
            ? null
            : Number(
                previousItem.target_quantity
              ),
        supplier:
          previousItem.supplier,
      },
    });
  }

  revalidatePath(
    "/warehouse"
  );

  revalidatePath("/");
  revalidatePath(
    "/reports"
  );
}
