"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  canManagePurchases,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

import {
  recordActivity,
} from "@/services/activityLogService";

type PurchaseSnapshot = {
  id: number;
  item_id: number;
  quantity: number;
  purchase_price: number;
  status: string;
};

type WarehouseItemSnapshot = {
  id: number;
  name: string;
  unit: string;
};

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

async function getWarehouseItemSnapshot(
  itemId: number
): Promise<WarehouseItemSnapshot | null> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("warehouse_items")
    .select("id, name, unit")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    console.error(
      "[ActivityLog] Не вдалося отримати snapshot матеріалу закупівлі.",
      {
        itemId,
        message:
          error.message,
      }
    );

    return null;
  }

  return data;
}

async function getPurchaseSnapshot(
  purchaseId: number
): Promise<PurchaseSnapshot | null> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "warehouse_purchases"
    )
    .select(`
      id,
      item_id,
      quantity,
      purchase_price,
      status
    `)
    .eq("id", purchaseId)
    .maybeSingle();

  if (error) {
    console.error(
      "[ActivityLog] Не вдалося отримати snapshot закупівлі.",
      {
        purchaseId,
        message:
          error.message,
      }
    );

    return null;
  }

  return data;
}

async function getPlannedPurchaseSnapshot(
  itemId: number
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "warehouse_purchases"
    )
    .select(`
      id,
      quantity,
      purchase_price
    `)
    .eq("item_id", itemId)
    .eq(
      "status",
      "Заплановано"
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[ActivityLog] Не вдалося визначити створену закупівлю.",
      {
        itemId,
        message:
          error.message,
      }
    );

    return null;
  }

  return data;
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

  const itemSnapshot =
    await getWarehouseItemSnapshot(
      itemId
    );

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

  const purchaseSnapshot =
    await getPlannedPurchaseSnapshot(
      itemId
    );

  const itemName =
    itemSnapshot?.name ||
    `Матеріал #${itemId}`;

  await recordActivity({
    action:
      "purchase.planned",
    entityType:
      "purchase",
    entityId:
      purchaseSnapshot?.id ||
      null,
    entityName:
      itemName,
    description:
      `Додав до плану закупівель «${itemName}»: ${quantity} ${itemSnapshot?.unit || "од."} за ціною ${purchasePrice} грн.`,
    metadata: {
      item_id:
        itemId,
      added_quantity:
        quantity,
      planned_quantity:
        purchaseSnapshot
          ? Number(
              purchaseSnapshot.quantity
            )
          : null,
      purchase_price:
        purchasePrice,
      unit:
        itemSnapshot?.unit ||
        null,
    },
  });

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

  const previousPurchase =
    await getPurchaseSnapshot(
      purchaseId
    );

  const itemSnapshot =
    previousPurchase
      ? await getWarehouseItemSnapshot(
          previousPurchase.item_id
        )
      : null;

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

  const itemName =
    itemSnapshot?.name ||
    `Закупівля #${purchaseId}`;

  await recordActivity({
    action:
      "purchase.updated",
    entityType:
      "purchase",
    entityId:
      purchaseId,
    entityName:
      itemName,
    description:
      `Змінив заплановану закупівлю «${itemName}»: ${quantity} ${itemSnapshot?.unit || "од."} за ціною ${purchasePrice} грн.`,
    metadata: {
      old_quantity:
        previousPurchase
          ? Number(
              previousPurchase.quantity
            )
          : null,
      new_quantity:
        quantity,
      old_purchase_price:
        previousPurchase
          ? Number(
              previousPurchase.purchase_price
            )
          : null,
      new_purchase_price:
        purchasePrice,
      unit:
        itemSnapshot?.unit ||
        null,
    },
  });

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

  const purchaseSnapshot =
    await getPurchaseSnapshot(
      purchaseId
    );

  const itemSnapshot =
    purchaseSnapshot
      ? await getWarehouseItemSnapshot(
          purchaseSnapshot.item_id
        )
      : null;

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

  const itemName =
    itemSnapshot?.name ||
    `Закупівля #${purchaseId}`;

  await recordActivity({
    action:
      "purchase.completed",
    entityType:
      "purchase",
    entityId:
      purchaseId,
    entityName:
      itemName,
    description:
      purchaseSnapshot
        ? `Оприбуткував закупівлю «${itemName}»: ${Number(purchaseSnapshot.quantity)} ${itemSnapshot?.unit || "од."} за ціною ${Number(purchaseSnapshot.purchase_price)} грн.`
        : `Оприбуткував закупівлю #${purchaseId}.`,
    metadata: {
      quantity:
        purchaseSnapshot
          ? Number(
              purchaseSnapshot.quantity
            )
          : null,
      purchase_price:
        purchaseSnapshot
          ? Number(
              purchaseSnapshot.purchase_price
            )
          : null,
      unit:
        itemSnapshot?.unit ||
        null,
    },
  });

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

  const purchaseSnapshot =
    await getPurchaseSnapshot(
      purchaseId
    );

  const itemSnapshot =
    purchaseSnapshot
      ? await getWarehouseItemSnapshot(
          purchaseSnapshot.item_id
        )
      : null;

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

  const itemName =
    itemSnapshot?.name ||
    `Закупівля #${purchaseId}`;

  await recordActivity({
    action:
      "purchase.deleted",
    entityType:
      "purchase",
    entityId:
      purchaseId,
    entityName:
      itemName,
    description:
      `Видалив заплановану закупівлю «${itemName}».`,
    metadata: {
      quantity:
        purchaseSnapshot
          ? Number(
              purchaseSnapshot.quantity
            )
          : null,
      purchase_price:
        purchaseSnapshot
          ? Number(
              purchaseSnapshot.purchase_price
            )
          : null,
      unit:
        itemSnapshot?.unit ||
        null,
    },
  });

  refreshPurchasePages();
}
