"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  isValidDateValue,
} from "@/lib/kyivDate";

import {
  canManageEquipment,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  recordActivity,
} from "@/services/activityLogService";

import {
  equipmentCategories,
  equipmentStatuses,
} from "@/constants/equipment";

async function requireEquipmentManagement() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }

  if (
    !canManageEquipment(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування технікою."
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

function getMaintenanceInterval(
  formData: FormData
) {
  const value =
    getText(
      formData,
      "maintenance_interval_days"
    );

  if (!value) {
    return null;
  }

  const interval =
    Number(value);

  if (
    !Number.isInteger(interval) ||
    interval <= 0
  ) {
    throw new Error(
      "Періодичність ТО має бути цілим числом, більшим за нуль."
    );
  }

  return interval;
}

function validateOptionalDate(
  value: string,
  message: string
) {
  if (
    value &&
    !isValidDateValue(value)
  ) {
    throw new Error(message);
  }
}

function validateEquipment(
  name: string,
  category: string,
  status: string
) {
  if (!name) {
    throw new Error(
      "Вкажи назву техніки."
    );
  }

  if (
    !equipmentCategories.includes(
      category as (typeof equipmentCategories)[number]
    )
  ) {
    throw new Error(
      "Обери категорію техніки."
    );
  }

  if (
    !equipmentStatuses.includes(
      status as (typeof equipmentStatuses)[number]
    )
  ) {
    throw new Error(
      "Обери правильний статус техніки."
    );
  }
}

function getEquipmentError(
  error: {
    code?: string;
    message?: string;
  },
  inventoryNumber: string
) {
  if (
    error.code === "23505"
  ) {
    return new Error(
      inventoryNumber
        ? `Інвентарний номер «${inventoryNumber}» уже використовується.`
        : "Такий інвентарний номер уже використовується."
    );
  }

  return new Error(
    `Не вдалося зберегти техніку: ${
      error.message ||
      "невідома помилка"
    }`
  );
}

async function getResponsibleEmployee(
  employeeValue: string
): Promise<{
  id: number | null;
  fullName: string | null;
}> {
  if (!employeeValue) {
    return {
      id: null,
      fullName: null,
    };
  }

  const employeeId =
    Number(employeeValue);

  if (
    !Number.isInteger(
      employeeId
    ) ||
    employeeId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити відповідального працівника."
    );
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("employees")
    .select(
      "id, first_name, last_name"
    )
    .eq(
      "id",
      employeeId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося завантажити працівника: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Вибраного працівника не знайдено."
    );
  }

  return {
    id: data.id,

    fullName:
      `${data.last_name} ${data.first_name}`.trim(),
  };
}

export async function createEquipment(
  formData: FormData
) {
  await requireEquipmentManagement();

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

  const inventoryNumber =
    getText(
      formData,
      "inventory_number"
    );

  const status =
    getText(
      formData,
      "status"
    );

  const responsibleEmployeeValue =
    getText(
      formData,
      "responsible_employee_id"
    );

  const location =
    getText(
      formData,
      "location"
    );

  const purchaseDate =
    getText(
      formData,
      "purchase_date"
    );

  const nextServiceDate =
    getText(
      formData,
      "next_service_date"
    );

  const maintenanceIntervalDays =
    getMaintenanceInterval(
      formData
    );

  const notes =
    getText(
      formData,
      "notes"
    );

  validateEquipment(
    name,
    category,
    status
  );

  validateOptionalDate(
    nextServiceDate,
    "Вкажи коректну дату наступного ТО."
  );

  const responsibleEmployee =
    await getResponsibleEmployee(
      responsibleEmployeeValue
    );

  const { error } =
    await supabase
      .from("equipment")
      .insert({
        name,
        category,

        inventory_number:
          inventoryNumber ||
          null,

        status,

        responsible_employee_id:
          responsibleEmployee.id,

        responsible:
          responsibleEmployee.fullName,

        location:
          location || null,

        purchase_date:
          purchaseDate || null,

        maintenance_interval_days:
          maintenanceIntervalDays,

        next_service_date:
          nextServiceDate ||
          null,

        notes:
          notes || null,
      });

  if (error) {
    throw getEquipmentError(
      error,
      inventoryNumber
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/notifications"
  );
  revalidatePath(
    "/employees"
  );
  revalidatePath(
    "/objects"
  );
  revalidatePath(
    "/reports"
  );
}

export async function updateEquipment(
  formData: FormData
) {
  await requireEquipmentManagement();

  const supabase =
    await createClient();

  const equipmentId =
    Number(
      formData.get(
        "equipment_id"
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

  const inventoryNumber =
    getText(
      formData,
      "inventory_number"
    );

  const status =
    getText(
      formData,
      "status"
    );

  const responsibleEmployeeValue =
    getText(
      formData,
      "responsible_employee_id"
    );

  const location =
    getText(
      formData,
      "location"
    );

  const purchaseDate =
    getText(
      formData,
      "purchase_date"
    );

  const nextServiceDate =
    getText(
      formData,
      "next_service_date"
    );

  const maintenanceIntervalDays =
    getMaintenanceInterval(
      formData
    );

  const notes =
    getText(
      formData,
      "notes"
    );

  if (
    !Number.isInteger(
      equipmentId
    ) ||
    equipmentId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити техніку."
    );
  }

  validateEquipment(
    name,
    category,
    status
  );

  validateOptionalDate(
    nextServiceDate,
    "Вкажи коректну дату наступного ТО."
  );

  if (!inventoryNumber) {
    throw new Error(
      "Інвентарний номер не може бути порожнім."
    );
  }

  const responsibleEmployee =
    await getResponsibleEmployee(
      responsibleEmployeeValue
    );

  const {
    data: previousEquipment,
    error: previousEquipmentError,
  } = await supabase
    .from("equipment")
    .select(`
      maintenance_interval_days,
      next_service_date
    `)
    .eq("id", equipmentId)
    .maybeSingle();

  if (
    previousEquipmentError ||
    !previousEquipment
  ) {
    throw new Error(
      `Не вдалося завантажити поточні налаштування техніки: ${
        previousEquipmentError?.message ||
        "запис не знайдено"
      }`
    );
  }

  const { error } =
    await supabase
      .from("equipment")
      .update({
        name,
        category,

        inventory_number:
          inventoryNumber,

        status,

        responsible_employee_id:
          responsibleEmployee.id,

        responsible:
          responsibleEmployee.fullName,

        location:
          location || null,

        purchase_date:
          purchaseDate || null,

        maintenance_interval_days:
          maintenanceIntervalDays,

        next_service_date:
          nextServiceDate ||
          null,

        notes:
          notes || null,
      })
      .eq(
        "id",
        equipmentId
      );

  if (error) {
    throw getEquipmentError(
      error,
      inventoryNumber
    );
  }

  const previousInterval =
    previousEquipment.maintenance_interval_days ===
      null
      ? null
      : Number(
          previousEquipment.maintenance_interval_days
        );
  const scheduleChanged =
    previousInterval !==
      maintenanceIntervalDays ||
    previousEquipment.next_service_date !==
      (nextServiceDate || null);

  if (scheduleChanged) {
    await recordActivity({
      action:
        "equipment.maintenance_schedule_updated",
      entityType:
        "equipment",
      entityId:
        equipmentId,
      entityName:
        name,
      description: `Оновлено налаштування планового ТО техніки «${name}».`,
      metadata: {
        previous_maintenance_interval_days:
          previousInterval,
        new_maintenance_interval_days:
          maintenanceIntervalDays,
        previous_next_service_date:
          previousEquipment.next_service_date,
        new_next_service_date:
          nextServiceDate ||
          null,
      },
    });
  }

  revalidatePath("/");
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/notifications"
  );
  revalidatePath(
    "/employees"
  );
  revalidatePath(
    "/objects"
  );
  revalidatePath(
    "/reports"
  );
}

export async function deleteEquipment(
  equipmentId: number
) {
  await requireEquipmentManagement();

  const supabase =
    await createClient();

  if (
    !Number.isInteger(
      equipmentId
    ) ||
    equipmentId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити техніку."
    );
  }

  const { error } =
    await supabase
      .from("equipment")
      .delete()
      .eq(
        "id",
        equipmentId
      );

  if (error) {
    throw new Error(
      `Не вдалося видалити техніку: ${error.message}`
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/notifications"
  );
  revalidatePath(
    "/employees"
  );
  revalidatePath(
    "/objects"
  );
  revalidatePath(
    "/reports"
  );
}
