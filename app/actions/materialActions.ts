"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageObjects } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

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

async function getWarehouseItemSnapshot(
  itemId: number
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("warehouse_items")
    .select(`
      id,
      name,
      unit
    `)
    .eq(
      "id",
      itemId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося завантажити матеріал зі складу: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Матеріал на складі не знайдено."
    );
  }

  return data;
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

    const warehouseItem =
      await getWarehouseItemSnapshot(
        warehouseItemId
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

    await recordActivity({
      action:
        "material.added_from_warehouse",
      entityType:
        "material",
      entityId:
        warehouseItem.id,
      entityName:
        warehouseItem.name,
      objectId,
      description:
        `Списав ${quantity} ${warehouseItem.unit} матеріалу «${warehouseItem.name}» зі складу на об’єкт.`,
      metadata: {
        source:
          "warehouse",
        warehouse_item_id:
          warehouseItem.id,
        quantity,
        unit:
          warehouseItem.unit,
      },
    });

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
    data: createdMaterial,
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
      })
      .select(`
        id,
        name,
        quantity,
        unit,
        price
      `)
      .single();

  if (error) {
    throw new Error(
      `Не вдалося додати матеріал: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "material.added",
    entityType:
      "material",
    entityId:
      createdMaterial.id,
    entityName:
      createdMaterial.name,
    objectId,
    description:
      `Додав ${createdMaterial.quantity} ${createdMaterial.unit} матеріалу «${createdMaterial.name}» до об’єкта.`,
    metadata: {
      source:
        "direct",
      quantity:
        Number(
          createdMaterial.quantity
        ),
      unit:
        createdMaterial.unit,
      price:
        Number(
          createdMaterial.price
        ),
    },
  });

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
        warehouse_item_id,
        name,
        quantity,
        unit,
        price
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

    await recordActivity({
      action:
        "material.quantity_changed",
      entityType:
        "material",
      entityId:
        material.id,
      entityName:
        material.name,
      objectId,
      description:
        `Змінив кількість матеріалу «${material.name}»: ${material.quantity} → ${quantity} ${material.unit}.`,
      metadata: {
        source:
          "warehouse",
        previous_quantity:
          Number(
            material.quantity
          ),
        new_quantity:
          quantity,
        unit:
          material.unit,
      },
    });

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

  await recordActivity({
    action:
      "material.updated",
    entityType:
      "material",
    entityId:
      material.id,
    entityName:
      name,
    objectId,
    description:
      `Оновив матеріал «${name}» на об’єкті.`,
    metadata: {
      source:
        "direct",
      previous_quantity:
        Number(
          material.quantity
        ),
      new_quantity:
        quantity,
      unit,
      previous_price:
        Number(
          material.price
        ),
      new_price:
        price,
    },
  });

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
    data: material,
    error: materialError,
  } = await supabase
    .from("materials")
    .select(`
      id,
      warehouse_item_id,
      name,
      quantity,
      unit,
      price
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

  if (materialError) {
    throw new Error(
      `Не вдалося завантажити матеріал: ${materialError.message}`
    );
  }

  if (!material) {
    throw new Error(
      "Матеріал не знайдено."
    );
  }

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

  const restoredToWarehouse =
    Boolean(
      material.warehouse_item_id
    );

  await recordActivity({
    action: restoredToWarehouse
      ? "material.deleted_stock_restored"
      : "material.deleted",
    entityType:
      "material",
    entityId:
      material.id,
    entityName:
      material.name,
    objectId,
    description: restoredToWarehouse
      ? `Видалив матеріал «${material.name}» з об’єкта та повернув ${material.quantity} ${material.unit} на склад.`
      : `Видалив матеріал «${material.name}» з об’єкта.`,
    metadata: {
      source: restoredToWarehouse
        ? "warehouse"
        : "direct",
      quantity:
        Number(
          material.quantity
        ),
      unit:
        material.unit,
      restored_to_warehouse:
        restoredToWarehouse,
    },
  });

  refreshMaterialPages(
    objectId
  );
}
