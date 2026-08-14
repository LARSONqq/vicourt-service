"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  canManageEquipment,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

import {
  equipmentServiceTypes,
} from "@/constants/equipmentService";

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
      "У тебе немає прав для керування обслуговуванням техніки."
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

export async function createEquipmentServiceRecord(
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

  const serviceType =
    getText(
      formData,
      "service_type"
    );

  const serviceDate =
    getText(
      formData,
      "service_date"
    );

  const cost =
    Number(
      formData.get(
        "cost"
      )
    );

  const performedBy =
    getText(
      formData,
      "performed_by"
    );

  const description =
    getText(
      formData,
      "description"
    );

  const nextServiceDate =
    getText(
      formData,
      "next_service_date"
    );

  if (
    !Number.isInteger(
      equipmentId
    ) ||
    equipmentId <= 0
  ) {
    throw new Error(
      "Обери техніку."
    );
  }

  if (
    !equipmentServiceTypes.includes(
      serviceType as (typeof equipmentServiceTypes)[number]
    )
  ) {
    throw new Error(
      "Обери тип обслуговування."
    );
  }

  if (!serviceDate) {
    throw new Error(
      "Вкажи дату обслуговування."
    );
  }

  if (
    !Number.isFinite(cost) ||
    cost < 0
  ) {
    throw new Error(
      "Вартість обслуговування не може бути від’ємною."
    );
  }

  if (
    nextServiceDate &&
    nextServiceDate <
      serviceDate
  ) {
    throw new Error(
      "Наступне обслуговування не може бути раніше за поточне."
    );
  }

  const {
    error: insertError,
  } = await supabase
    .from(
      "equipment_service_records"
    )
    .insert({
      equipment_id:
        equipmentId,

      service_type:
        serviceType,

      service_date:
        serviceDate,

      cost,

      performed_by:
        performedBy || null,

      description:
        description || null,

      next_service_date:
        nextServiceDate || null,
    });

  if (insertError) {
    throw new Error(
      `Не вдалося додати запис обслуговування: ${insertError.message}`
    );
  }

  if (nextServiceDate) {
    const {
      error: updateError,
    } = await supabase
      .from("equipment")
      .update({
        next_service_date:
          nextServiceDate,
      })
      .eq(
        "id",
        equipmentId
      );

    if (updateError) {
      throw new Error(
        `Запис створено, але не вдалося оновити дату наступного сервісу: ${updateError.message}`
      );
    }
  }

  revalidatePath("/");
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/reports"
  );
}

export async function deleteEquipmentServiceRecord(
  recordId: number
) {
  await requireEquipmentManagement();

  const supabase =
    await createClient();

  if (
    !Number.isInteger(
      recordId
    ) ||
    recordId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити запис обслуговування."
    );
  }

  const { error } =
    await supabase
      .from(
        "equipment_service_records"
      )
      .delete()
      .eq(
        "id",
        recordId
      );

  if (error) {
    throw new Error(
      `Не вдалося видалити запис: ${error.message}`
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/reports"
  );
}