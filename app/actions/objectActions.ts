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

async function requireObjectManagementAccess() {
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
      "У тебе немає прав для керування об’єктами."
    );
  }

  return profile;
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

function refreshObjectPages(
  objectId?: number
) {
  revalidatePath("/");
  revalidatePath("/objects");
  revalidatePath("/reports");
  revalidatePath("/task");
  revalidatePath("/calendar");

  if (objectId) {
    revalidatePath(
      `/objects/${objectId}`
    );
  }
}

export async function createObject(
  formData: FormData
) {
  await requireObjectManagementAccess();

  const supabase =
    await createClient();

  const name =
    getText(
      formData,
      "name"
    );

  const customer =
    getText(
      formData,
      "customer"
    );

  const phone =
    getText(
      formData,
      "phone"
    );

  const address =
    getText(
      formData,
      "address"
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

  // Тимчасова підтримка старого текстового поля
  const oldManagerValue =
    getText(
      formData,
      "manager"
    );

  if (!name) {
    throw new Error(
      "Вкажи назву об’єкта."
    );
  }

  if (!status) {
    throw new Error(
      "Обери статус об’єкта."
    );
  }

  const responsibleEmployee =
    await getResponsibleEmployee(
      responsibleEmployeeValue
    );

  const managerName =
    responsibleEmployee.fullName ||
    oldManagerValue ||
    null;

  const {
    error,
  } = await supabase
    .from("objects")
    .insert({
      name,

      customer:
        customer || null,

      phone:
        phone || null,

      address:
        address || null,

      status,

      responsible_employee_id:
        responsibleEmployee.id,

      manager:
        managerName,
    });

  if (error) {
    throw new Error(
      `Не вдалося створити об’єкт: ${error.message}`
    );
  }

  refreshObjectPages();
}

export async function updateObject(
  formData: FormData
) {
  await requireObjectManagementAccess();

  const supabase =
    await createClient();

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const name =
    getText(
      formData,
      "name"
    );

  const customer =
    getText(
      formData,
      "customer"
    );

  const phone =
    getText(
      formData,
      "phone"
    );

  const address =
    getText(
      formData,
      "address"
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

  // Тимчасова підтримка старого текстового поля
  const oldManagerValue =
    getText(
      formData,
      "manager"
    );

  if (
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити об’єкт."
    );
  }

  if (!name) {
    throw new Error(
      "Вкажи назву об’єкта."
    );
  }

  if (!status) {
    throw new Error(
      "Обери статус об’єкта."
    );
  }

  const responsibleEmployee =
    await getResponsibleEmployee(
      responsibleEmployeeValue
    );

  const managerName =
    responsibleEmployee.fullName ||
    oldManagerValue ||
    null;

  const {
    error,
  } = await supabase
    .from("objects")
    .update({
      name,

      customer:
        customer || null,

      phone:
        phone || null,

      address:
        address || null,

      status,

      responsible_employee_id:
        responsibleEmployee.id,

      manager:
        managerName,
    })
    .eq(
      "id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося оновити об’єкт: ${error.message}`
    );
  }

  refreshObjectPages(
    objectId
  );
}

export async function deleteObject(
  objectId: number
) {
  await requireObjectManagementAccess();

  const supabase =
    await createClient();

  if (
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити об’єкт."
    );
  }

  const {
    error,
  } = await supabase
    .from("objects")
    .delete()
    .eq(
      "id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося видалити об’єкт: ${error.message}`
    );
  }

  refreshObjectPages();
}