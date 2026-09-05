"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageObjects } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

type ManagementMaterialSnapshot = {
  id: number;
  object_id: number;
  warehouse_item_id: number | null;
  name: string;
  quantity: number;
  unit: string;
  price: number;
};

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

function getRpcId(
  value: unknown,
  message: string
) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(message);
  }

  return id;
}

function getMaterialOperationError(
  message: string,
  fallback: string
) {
  if (
    message.includes(
      "Недостатньо матеріалу на складі"
    )
  ) {
    return "Недостатньо матеріалу на складі.";
  }

  if (
    message.includes(
      "Не можна повернути більше"
    )
  ) {
    return "Не можна повернути більше, ніж є на об’єкті.";
  }

  return fallback;
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
    "/notifications"
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
        getMaterialOperationError(
          error.message,
          "Не вдалося списати матеріал зі складу. Спробуй ще раз."
        )
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

  const { data: createdMaterialId, error } =
    await supabase.rpc(
      "create_direct_object_material",
      {
        p_object_id: objectId,
        p_name: name,
        p_quantity: quantity,
        p_unit: unit,
        p_unit_cost: price,
      }
    );

  if (error) {
    throw new Error(
      "Не вдалося додати матеріал. Спробуй ще раз."
    );
  }

  const createdMaterialIdValue = getRpcId(
    createdMaterialId,
    "Матеріал створено, але не вдалося визначити його запис."
  );

  await recordActivity({
    action:
      "material.added",
    entityType:
      "material",
    entityId:
      createdMaterialIdValue,
    entityName:
      name,
    objectId,
    description:
      `Додав ${quantity} ${unit} матеріалу «${name}» до об’єкта.`,
    metadata: {
      source:
        "direct",
      quantity:
        quantity,
      unit:
        unit,
      price:
        price,
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
      .rpc(
        "get_management_materials"
      )
      .eq(
        "id",
        materialId
      )
      .eq(
        "object_id",
        objectId
      )
      .maybeSingle()
      .overrideTypes<
        ManagementMaterialSnapshot | null,
        { merge: false }
      >();

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
        getMaterialOperationError(
          error.message,
          "Не вдалося змінити кількість матеріалу. Спробуй ще раз."
        )
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

  const { error } = await supabase.rpc(
    "update_direct_object_material",
    {
      p_material_id: materialId,
      p_object_id: objectId,
      p_name: name,
      p_quantity: quantity,
      p_unit: unit,
      p_unit_cost: price,
    }
  );

  if (error) {
    throw new Error(
      "Не вдалося оновити матеріал. Спробуй ще раз."
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
    .rpc(
      "get_management_materials"
    )
    .eq(
      "id",
      materialId
    )
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle()
    .overrideTypes<
      ManagementMaterialSnapshot | null,
      { merge: false }
    >();

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

export async function returnMaterialToWarehouse(
  formData: FormData
) {
  await requireMaterialManagementAccess();

  const materialId = Number(
    formData.get("material_id")
  );
  const objectId = Number(
    formData.get("object_id")
  );
  const quantity = getPositiveNumber(
    formData,
    "quantity"
  );

  validateId(
    materialId,
    "Не вдалося визначити матеріал."
  );
  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase = await createClient();
  const { data: material, error: materialError } =
    await supabase
      .from("materials")
      .select(`
        id,
        warehouse_item_id,
        name,
        quantity,
        unit
      `)
      .eq("id", materialId)
      .eq("object_id", objectId)
      .maybeSingle();

  if (materialError || !material) {
    throw new Error("Матеріал не знайдено.");
  }

  if (!material.warehouse_item_id) {
    throw new Error(
      "Цей матеріал не був виданий зі складу."
    );
  }

  const previousQuantity = Number(material.quantity);

  if (quantity > previousQuantity) {
    throw new Error(
      "Не можна повернути більше, ніж є на об’єкті."
    );
  }

  const { error } = await supabase.rpc(
    "return_object_material_to_warehouse",
    {
      p_material_id: materialId,
      p_object_id: objectId,
      p_quantity: quantity,
    }
  );

  if (error) {
    throw new Error(
      getMaterialOperationError(
        error.message,
        "Не вдалося повернути матеріал на склад. Спробуй ще раз."
      )
    );
  }

  const remainingQuantity = previousQuantity - quantity;

  await recordActivity({
    action: "material.returned_to_warehouse",
    entityType: "material",
    entityId: material.id,
    entityName: material.name,
    objectId,
    description:
      remainingQuantity > 0
        ? `Повернув ${quantity} ${material.unit} матеріалу «${material.name}» з об’єкта на склад.`
        : `Повернув увесь залишок матеріалу «${material.name}» з об’єкта на склад.`,
    metadata: {
      quantity,
      unit: material.unit,
      previous_quantity: previousQuantity,
      new_quantity: Math.max(remainingQuantity, 0),
      restored_to_warehouse: true,
    },
  });

  refreshMaterialPages(objectId);
}
