"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  canManageWarehouse,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

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
      "У тебе немає прав для виконання складських операцій."
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

export async function createWarehouseMovement(
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

  const movementType =
    getText(
      formData,
      "movement_type"
    );

  const quantity =
    Number(
      formData.get(
        "quantity"
      )
    );

  const objectValue =
    getText(
      formData,
      "object_id"
    );

  const objectId =
    objectValue
      ? Number(objectValue)
      : null;

  const note =
    getText(
      formData,
      "note"
    );

  if (
    !Number.isInteger(
      itemId
    ) ||
    itemId <= 0
  ) {
    throw new Error(
      "Обери позицію складу."
    );
  }

  if (
    movementType !==
      "Прихід" &&
    movementType !==
      "Списання"
  ) {
    throw new Error(
      "Обери тип операції."
    );
  }

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
    objectId !== null &&
    (
      !Number.isInteger(
        objectId
      ) ||
      objectId <= 0
    )
  ) {
    throw new Error(
      "Не вдалося визначити об’єкт."
    );
  }

  const { error } =
    await supabase.rpc(
      "create_warehouse_movement",
      {
        p_item_id:
          itemId,

        p_object_id:
          objectId,

        p_movement_type:
          movementType,

        p_quantity:
          quantity,

        p_note:
          note || null,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося виконати операцію: ${error.message}`
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/warehouse"
  );
  revalidatePath(
    "/reports"
  );

  if (objectId) {
    revalidatePath(
      `/objects/${objectId}`
    );
  }
}