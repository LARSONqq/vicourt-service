"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageWarehouse } from "@/lib/auth/permissions";

import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

type WarehouseItemSnapshot = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  purchase_price: number;
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
  const rawValue = String(
    formData.get(field) ?? ""
  ).trim();

  if (!rawValue) {
    return 0;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(
      "Вкажи коректне числове значення."
    );
  }

  return value;
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

  const { data, error } = await supabase.rpc(
    "create_warehouse_item_with_opening_balance",
    {
      p_name: name,
      p_category: category || null,
      p_quantity: quantity,
      p_unit: unit,
      p_min_quantity: minQuantity,
      p_target_quantity: targetQuantity,
      p_unit_cost: purchasePrice,
      p_supplier: supplier || null,
    }
  );

  if (error) {
    throw new Error(
      "Не вдалося створити позицію складу. Спробуй ще раз."
    );
  }

  const createdItemId = Number(data);

  if (!Number.isInteger(createdItemId) || createdItemId <= 0) {
    throw new Error(
      "Позицію створено, але не вдалося визначити її запис."
    );
  }

  await recordActivity({
    action:
      "warehouse_item.created",
    entityType:
      "material",
    entityId: createdItemId,
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
      quantity,
      unit,
      purchase_price:
        purchasePrice,
    },
  });

  revalidatePath(
    "/warehouse"
  );

  revalidatePath(
    "/notifications"
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
    0,
    minQuantity,
    targetQuantity,
    0
  );

  const {
    data: previousItem,
    error: previousItemError,
  } = await supabase
    .rpc(
      "get_management_warehouse_items"
    )
    .eq("id", itemId)
    .maybeSingle()
    .overrideTypes<
      WarehouseItemSnapshot | null,
      { merge: false }
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
        unit,
        min_quantity:
          minQuantity,
        target_quantity:
          targetQuantity,
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
      quantity:
        Number(
          previousItem.quantity
        ),
      purchase_price:
        Number(
          previousItem.purchase_price
        ),
    },
  });

  revalidatePath(
    "/warehouse"
  );

  revalidatePath(
    "/notifications"
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
    .rpc(
      "get_management_warehouse_items"
    )
    .eq("id", itemId)
    .maybeSingle()
    .overrideTypes<
      WarehouseItemSnapshot | null,
      { merge: false }
    >();

  if (previousItemError) {
    throw new Error(
      `Не вдалося завантажити позицію складу: ${previousItemError.message}`
    );
  }

  if (
    previousItem &&
    Number(previousItem.quantity) !== 0
  ) {
    throw new Error(
      "Спочатку скоригуй залишок позиції до нуля. Історія рухів буде збережена."
    );
  }

  const { error } =
    await supabase.rpc(
      "delete_warehouse_item",
      {
        p_item_id: itemId,
      }
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

  revalidatePath(
    "/notifications"
  );

  revalidatePath("/");
  revalidatePath(
    "/reports"
  );
}
