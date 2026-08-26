"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageObjects } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

import type {
  ActivityMetadata,
} from "@/types/activityLog";

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function getOptionalMoney(
  formData: FormData,
  field: string,
  label: string
) {
  const rawValue = getText(
    formData,
    field
  );

  if (!rawValue) {
    return null;
  }

  const value =
    Number(rawValue);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${label} має бути невід’ємним числом.`
    );
  }

  return value;
}

function normalizeOptionalMoney(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    Number(value);

  return Number.isFinite(
    normalized
  )
    ? normalized
    : null;
}

function formatActivityMoney(
  value: number | null
) {
  if (value === null) {
    return "не вказано";
  }

  return `${new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 2,
    }
  ).format(value)} грн`;
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

  const costBudget =
    getOptionalMoney(
      formData,
      "cost_budget",
      "Плановий бюджет витрат"
    );

  const clientPrice =
    getOptionalMoney(
      formData,
      "client_price",
      "Вартість для клієнта"
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
    data: createdObject,
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

      cost_budget:
        costBudget,

      client_price:
        clientPrice,
    })
    .select(`
      id,
      name,
      status
    `)
    .single();

  if (error) {
    throw new Error(
      `Не вдалося створити об’єкт: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "object.created",
    entityType:
      "object",
    entityId:
      createdObject.id,
    entityName:
      createdObject.name,
    objectId:
      createdObject.id,
    objectName:
      createdObject.name,
    description:
      `Створив об’єкт «${createdObject.name}».`,
    metadata: {
      status:
        createdObject.status,
      cost_budget:
        costBudget,
      client_price:
        clientPrice,
    },
  });

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

  const costBudget =
    getOptionalMoney(
      formData,
      "cost_budget",
      "Плановий бюджет витрат"
    );

  const clientPrice =
    getOptionalMoney(
      formData,
      "client_price",
      "Вартість для клієнта"
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

  const {
    data: previousObject,
    error: previousObjectError,
  } = await supabase
    .from("objects")
    .select(`
      id,
      name,
      status,
      cost_budget,
      client_price
    `)
    .eq(
      "id",
      objectId
    )
    .maybeSingle();

  if (previousObjectError) {
    throw new Error(
      `Не вдалося завантажити об’єкт: ${previousObjectError.message}`
    );
  }

  if (!previousObject) {
    throw new Error(
      "Об’єкт не знайдено."
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

      cost_budget:
        costBudget,

      client_price:
        clientPrice,
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

  const statusChanged =
    previousObject.status !==
    status;

  const previousCostBudget =
    normalizeOptionalMoney(
      previousObject.cost_budget
    );
  const previousClientPrice =
    normalizeOptionalMoney(
      previousObject.client_price
    );
  const costBudgetChanged =
    previousCostBudget !==
    costBudget;
  const clientPriceChanged =
    previousClientPrice !==
    clientPrice;
  const financialChanges:
    string[] = [];

  if (costBudgetChanged) {
    financialChanges.push(
      `плановий бюджет: ${formatActivityMoney(
        previousCostBudget
      )} → ${formatActivityMoney(
        costBudget
      )}`
    );
  }

  if (clientPriceChanged) {
    financialChanges.push(
      `вартість для клієнта: ${formatActivityMoney(
        previousClientPrice
      )} → ${formatActivityMoney(
        clientPrice
      )}`
    );
  }

  const activityDescription =
    statusChanged
      ? `Змінив статус об’єкта «${name}»: ${previousObject.status} → ${status}${
          financialChanges.length >
          0
            ? `; ${financialChanges.join(
                "; "
              )}`
            : ""
        }.`
      : financialChanges.length >
          0
        ? `Оновив об’єкт «${name}»: ${financialChanges.join(
            "; "
          )}.`
        : `Оновив об’єкт «${name}».`;
  const activityMetadata:
    ActivityMetadata =
    statusChanged
      ? {
          previous_status:
            previousObject.status,
          new_status:
            status,
        }
      : {
          status,
          previous_name:
            previousObject.name,
        };

  if (costBudgetChanged) {
    activityMetadata.previous_cost_budget =
      previousCostBudget;
    activityMetadata.new_cost_budget =
      costBudget;
  }

  if (clientPriceChanged) {
    activityMetadata.previous_client_price =
      previousClientPrice;
    activityMetadata.new_client_price =
      clientPrice;
  }

  await recordActivity({
    action: statusChanged
      ? "object.status_changed"
      : "object.updated",
    entityType:
      "object",
    entityId:
      objectId,
    entityName:
      name,
    objectId,
    objectName:
      name,
    description:
      activityDescription,
    metadata:
      activityMetadata,
  });

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
    data: object,
    error: objectError,
  } = await supabase
    .from("objects")
    .select(`
      id,
      name,
      status
    `)
    .eq(
      "id",
      objectId
    )
    .maybeSingle();

  if (objectError) {
    throw new Error(
      `Не вдалося завантажити об’єкт: ${objectError.message}`
    );
  }

  if (!object) {
    throw new Error(
      "Об’єкт не знайдено."
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

  await recordActivity({
    action:
      "object.deleted",
    entityType:
      "object",
    entityId:
      object.id,
    entityName:
      object.name,
    objectId:
      object.id,
    objectName:
      object.name,
    description:
      `Видалив об’єкт «${object.name}».`,
    metadata: {
      status:
        object.status,
    },
  });

  refreshObjectPages();
}
