"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageObjects } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function getPositiveNumber(
  formData: FormData,
  field: string
) {
  const value = Number(
    formData.get(field)
  );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Кількість має бути більшою за нуль."
    );
  }

  return value;
}

function getNonNegativeNumber(
  formData: FormData,
  field: string
) {
  const rawValue = String(
    formData.get(field) ?? ""
  ).trim();

  if (!rawValue) {
    return 0;
  }

  const value = Number(
    rawValue
  );

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      "Ціна не може бути від’ємною."
    );
  }

  return value;
}

function validateId(
  value: number,
  message: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      message
    );
  }
}

async function requireMaterialManagementAccess() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Потрібно увійти в систему."
    );
  }

  if (
    !canManageObjects(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування матеріалами."
    );
  }

  return profile;
}

function refreshMaterialPages(
  objectId: number
) {
  revalidatePath(
    `/objects/${objectId}`
  );

  revalidatePath(
    "/objects"
  );

  revalidatePath(
    "/warehouse"
  );

  revalidatePath(
    "/reports"
  );

  revalidatePath(
    "/"
  );
}

export async function createMaterial(
  formData: FormData
) {
  await requireMaterialManagementAccess();

  const supabase =
    await createClient();

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const sourceType =
    getText(
      formData,
      "source_type"
    );

  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const quantity =
    getPositiveNumber(
      formData,
      "quantity"
    );

  if (
    sourceType ===
    "warehouse"
  ) {
    const warehouseItemId =
      Number(
        formData.get(
          "warehouse_item_id"
        )
      );

    validateId(
      warehouseItemId,
      "Обери матеріал зі складу."
    );

    const {
      error,
    } =
      await supabase.rpc(
        "allocate_warehouse_material",
        {
          p_object_id:
            objectId,

          p_warehouse_item_id:
            warehouseItemId,

          p_quantity:
            quantity,
        }
      );

    if (error) {
      throw new Error(
        `Не вдалося списати матеріал зі складу: ${error.message}`
      );
    }

    refreshMaterialPages(
      objectId
    );

    return;
  }

  const name =
    getText(
      formData,
      "name"
    );

  const unit =
    getText(
      formData,
      "unit"
    );

  const price =
    getNonNegativeNumber(
      formData,
      "price"
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

  const {
    error,
  } =
    await supabase
      .from(
        "materials"
      )
      .insert({
        object_id:
          objectId,

        warehouse_item_id:
          null,

        name,

        quantity,

        unit,

        price,
      });

  if (error) {
    throw new Error(
      `Не вдалося додати матеріал: ${error.message}`
    );
  }

  refreshMaterialPages(
    objectId
  );
}

export async function updateMaterial(
  formData: FormData
) {
  await requireMaterialManagementAccess();

  const supabase =
    await createClient();

  const materialId =
    Number(
      formData.get(
        "material_id"
      )
    );

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  validateId(
    materialId,
    "Не вдалося визначити матеріал."
  );

  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const quantity =
    getPositiveNumber(
      formData,
      "quantity"
    );

  const {
    data: material,
    error: materialError,
  } =
    await supabase
      .from(
        "materials"
      )
      .select(`
        id,
        warehouse_item_id
      `)
      .eq(
        "id",
        materialId
      )
      .eq(
        "object_id",
        objectId
      )
      .maybeSingle();

  if (
    materialError
  ) {
    throw new Error(
      `Не вдалося завантажити матеріал: ${materialError.message}`
    );
  }

  if (!material) {
    throw new Error(
      "Матеріал не знайдено."
    );
  }

  if (
    material.warehouse_item_id
  ) {
    const {
      error,
    } =
      await supabase.rpc(
        "change_allocated_material_quantity",
        {
          p_material_id:
            materialId,

          p_object_id:
            objectId,

          p_quantity:
            quantity,
        }
      );

    if (error) {
      throw new Error(
        `Не вдалося змінити кількість матеріалу: ${error.message}`
      );
    }

    refreshMaterialPages(
      objectId
    );

    return;
  }

  const name =
    getText(
      formData,
      "name"
    );

  const unit =
    getText(
      formData,
      "unit"
    );

  const price =
    getNonNegativeNumber(
      formData,
      "price"
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

  const {
    error,
  } =
    await supabase
      .from(
        "materials"
      )
      .update({
        name,
        quantity,
        unit,
        price,
      })
      .eq(
        "id",
        materialId
      )
      .eq(
        "object_id",
        objectId
      );

  if (error) {
    throw new Error(
      `Не вдалося оновити матеріал: ${error.message}`
    );
  }

  refreshMaterialPages(
    objectId
  );
}

export async function deleteMaterial(
  materialId: number,
  objectId: number
) {
  await requireMaterialManagementAccess();

  const supabase =
    await createClient();

  validateId(
    materialId,
    "Не вдалося визначити матеріал."
  );

  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const {
    error,
  } =
    await supabase.rpc(
      "delete_material_with_stock_restore",
      {
        p_material_id:
          materialId,

        p_object_id:
          objectId,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося видалити матеріал: ${error.message}`
    );
  }

  refreshMaterialPages(
    objectId
  );
}