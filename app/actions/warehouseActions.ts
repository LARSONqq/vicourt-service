"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageWarehouse } from "@/lib/auth/permissions";

import { getCurrentUserProfile } from "@/services/profileService";

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

function validateValues(
  quantity: number,
  minQuantity: number,
  purchasePrice: number
) {
  if (
    quantity < 0 ||
    minQuantity < 0 ||
    purchasePrice < 0
  ) {
    throw new Error(
      "Числові значення не можуть бути від’ємними."
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
    purchasePrice
  );

  const { error } =
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
        purchase_price:
          purchasePrice,
        supplier:
          supplier || null,
      });

  if (error) {
    throw new Error(
      `Не вдалося створити позицію складу: ${error.message}`
    );
  }

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
    purchasePrice
  );

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

  revalidatePath(
    "/warehouse"
  );

  revalidatePath("/");
  revalidatePath(
    "/reports"
  );
}