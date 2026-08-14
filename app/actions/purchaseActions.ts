"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  canManagePurchases,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

async function requirePurchaseManagement() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }

  if (
    !canManagePurchases(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування закупівлями."
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

function validateId(
  value: number,
  message: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(message);
  }
}

function refreshPurchasePages() {
  revalidatePath("/");
  revalidatePath(
    "/purchases"
  );
  revalidatePath(
    "/warehouse"
  );
  revalidatePath(
    "/reports"
  );
}

export async function createWarehousePurchase(
  formData: FormData
) {
  await requirePurchaseManagement();

  const supabase =
    await createClient();

  const itemId =
    Number(
      formData.get(
        "item_id"
      )
    );

  const quantity =
    Number(
      formData.get(
        "quantity"
      )
    );

  const purchasePrice =
    Number(
      formData.get(
        "purchase_price"
      )
    );

  const supplier =
    getText(
      formData,
      "supplier"
    );

  const note =
    getText(
      formData,
      "note"
    );

  validateId(
    itemId,
    "Обери матеріал для закупівлі."
  );

  if (
    !Number.isFinite(
      quantity
    ) ||
    quantity <= 0
  ) {
    throw new Error(
      "Кількість повинна бути більшою за нуль."
    );
  }

  if (
    !Number.isFinite(
      purchasePrice
    ) ||
    purchasePrice < 0
  ) {
    throw new Error(
      "Закупівельна ціна не може бути від’ємною."
    );
  }

  const { error } =
    await supabase.rpc(
      "create_or_add_warehouse_purchase",
      {
        p_item_id:
          itemId,

        p_quantity:
          quantity,

        p_purchase_price:
          purchasePrice,

        p_supplier:
          supplier,

        p_note:
          note,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося створити закупівлю: ${error.message}`
    );
  }

  refreshPurchasePages();
}

export async function updateWarehousePurchase(
  formData: FormData
) {
  await requirePurchaseManagement();

  const supabase =
    await createClient();

  const purchaseId =
    Number(
      formData.get(
        "purchase_id"
      )
    );

  const quantity =
    Number(
      formData.get(
        "quantity"
      )
    );

  const purchasePrice =
    Number(
      formData.get(
        "purchase_price"
      )
    );

  const supplier =
    getText(
      formData,
      "supplier"
    );

  const note =
    getText(
      formData,
      "note"
    );

  validateId(
    purchaseId,
    "Не вдалося визначити закупівлю."
  );

  if (
    !Number.isFinite(
      quantity
    ) ||
    quantity <= 0
  ) {
    throw new Error(
      "Кількість повинна бути більшою за нуль."
    );
  }

  if (
    !Number.isFinite(
      purchasePrice
    ) ||
    purchasePrice < 0
  ) {
    throw new Error(
      "Закупівельна ціна не може бути від’ємною."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "warehouse_purchases"
    )
    .update({
      quantity,

      purchase_price:
        purchasePrice,

      supplier:
        supplier || null,

      note:
        note || null,
    })
    .eq(
      "id",
      purchaseId
    )
    .eq(
      "status",
      "Заплановано"
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося оновити закупівлю: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Закупівлю не знайдено або її вже оприбутковано."
    );
  }

  refreshPurchasePages();
}

export async function completeWarehousePurchase(
  purchaseId: number
) {
  await requirePurchaseManagement();

  const supabase =
    await createClient();

  validateId(
    purchaseId,
    "Не вдалося визначити закупівлю."
  );

  const { error } =
    await supabase.rpc(
      "complete_warehouse_purchase",
      {
        p_purchase_id:
          purchaseId,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося оприбуткувати закупівлю: ${error.message}`
    );
  }

  refreshPurchasePages();
}

export async function deleteWarehousePurchase(
  purchaseId: number
) {
  await requirePurchaseManagement();

  const supabase =
    await createClient();

  validateId(
    purchaseId,
    "Не вдалося визначити закупівлю."
  );

  const {
    data,
    error,
  } = await supabase
    .from(
      "warehouse_purchases"
    )
    .delete()
    .eq(
      "id",
      purchaseId
    )
    .eq(
      "status",
      "Заплановано"
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося видалити закупівлю: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Закупівлю не знайдено або її вже оприбутковано."
    );
  }

  refreshPurchasePages();
}