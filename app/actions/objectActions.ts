"use server";

import { revalidatePath } from "next/cache";

import { OBJECT_DOCUMENTS_BUCKET } from "@/constants/objectDocuments";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { canManageObjects } from "@/lib/auth/permissions";
import {
  formatDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";
import {
  completeSupervisionCycle,
  syncSupervisionTaskSafely,
} from "@/services/supervisionTaskService";

import type {
  ActivityMetadata,
} from "@/types/activityLog";

type ManagementObjectSnapshot = {
  id: number;
  name: string;
  status: string;
  cost_budget: number | null;
  client_price: number | null;
  supervision_interval_days: number | null;
  next_supervision_date: string | null;
};

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

function getOptionalPositiveInteger(
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
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${label} має бути цілим числом, більшим за нуль.`
    );
  }

  return value;
}

function getOptionalDate(
  formData: FormData,
  field: string,
  label: string
) {
  const value = getText(
    formData,
    field
  );

  if (!value) {
    return null;
  }

  if (!isValidDateValue(value)) {
    throw new Error(
      `${label} має містити коректну дату.`
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

function formatActivityDate(
  value: string | null
) {
  return value
    ? formatDateValue(value) ||
        value
    : "не заплановано";
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

export async function getObjectEditorEmployees() {
  await requireObjectManagementAccess();

  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from("employees")
      .select(`
        id,
        first_name,
        last_name,
        position,
        status
      `)
      .order("last_name", {
        ascending: true,
      })
      .order("first_name", {
        ascending: true,
      });

  if (error) {
    throw new Error(
      `Не вдалося завантажити працівників: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
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
  revalidatePath(
    "/notifications"
  );

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

  const supervisionIntervalDays =
    getOptionalPositiveInteger(
      formData,
      "supervision_interval_days",
      "Періодичність нагляду"
    );

  const nextSupervisionDate =
    getOptionalDate(
      formData,
      "next_supervision_date",
      "Дата наступного огляду"
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

      supervision_interval_days:
        supervisionIntervalDays,

      last_supervision_date:
        null,

      next_supervision_date:
        nextSupervisionDate,
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

  await syncSupervisionTaskSafely(
    createdObject.id
  );

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
      supervision_interval_days:
        supervisionIntervalDays,
      next_supervision_date:
        nextSupervisionDate,
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

  const supervisionIntervalDays =
    getOptionalPositiveInteger(
      formData,
      "supervision_interval_days",
      "Періодичність нагляду"
    );
  const supervisionIntervalProvided =
    formData.has(
      "supervision_interval_days"
    );

  const nextSupervisionDate =
    getOptionalDate(
      formData,
      "next_supervision_date",
      "Дата наступного огляду"
    );
  const nextSupervisionDateProvided =
    formData.has(
      "next_supervision_date"
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
    .rpc(
      "get_management_objects"
    )
    .eq(
      "id",
      objectId
    )
    .maybeSingle()
    .overrideTypes<
      ManagementObjectSnapshot | null,
      { merge: false }
    >();

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

  const previousSupervisionIntervalDays =
    previousObject.supervision_interval_days ===
      null
      ? null
      : Number(
          previousObject.supervision_interval_days
        );
  const previousNextSupervisionDate =
    previousObject.next_supervision_date ||
    null;
  const supervisionIntervalDaysForUpdate =
    supervisionIntervalProvided
      ? supervisionIntervalDays
      : previousSupervisionIntervalDays;
  const nextSupervisionDateForUpdate =
    nextSupervisionDateProvided
      ? nextSupervisionDate
      : previousNextSupervisionDate;

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

      supervision_interval_days:
        supervisionIntervalDaysForUpdate,

      next_supervision_date:
        nextSupervisionDateForUpdate,
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

  await syncSupervisionTaskSafely(
    objectId
  );

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
  const supervisionIntervalChanged =
    previousSupervisionIntervalDays !==
    supervisionIntervalDaysForUpdate;
  const nextSupervisionDateChanged =
    previousNextSupervisionDate !==
    nextSupervisionDateForUpdate;
  const objectChanges:
    string[] = [];

  if (costBudgetChanged) {
    objectChanges.push(
      `плановий бюджет: ${formatActivityMoney(
        previousCostBudget
      )} → ${formatActivityMoney(
        costBudget
      )}`
    );
  }

  if (clientPriceChanged) {
    objectChanges.push(
      `вартість для клієнта: ${formatActivityMoney(
        previousClientPrice
      )} → ${formatActivityMoney(
        clientPrice
      )}`
    );
  }

  if (supervisionIntervalChanged) {
    objectChanges.push(
      `періодичність нагляду: ${
        previousSupervisionIntervalDays ===
        null
          ? "не вказано"
          : `${previousSupervisionIntervalDays} дн.`
      } → ${
        supervisionIntervalDaysForUpdate ===
        null
          ? "не вказано"
          : `${supervisionIntervalDaysForUpdate} дн.`
      }`
    );
  }

  if (nextSupervisionDateChanged) {
    objectChanges.push(
      `наступний огляд: ${formatActivityDate(
        previousNextSupervisionDate
      )} → ${formatActivityDate(
        nextSupervisionDateForUpdate
      )}`
    );
  }

  const activityDescription =
    statusChanged
      ? `Змінив статус об’єкта «${name}»: ${previousObject.status} → ${status}${
          objectChanges.length >
          0
            ? `; ${objectChanges.join(
                "; "
              )}`
            : ""
        }.`
      : objectChanges.length >
          0
        ? `Оновив об’єкт «${name}»: ${objectChanges.join(
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

  if (supervisionIntervalChanged) {
    activityMetadata.previous_supervision_interval_days =
      previousSupervisionIntervalDays;
    activityMetadata.new_supervision_interval_days =
      supervisionIntervalDaysForUpdate;
  }

  if (nextSupervisionDateChanged) {
    activityMetadata.previous_next_supervision_date =
      previousNextSupervisionDate;
    activityMetadata.new_next_supervision_date =
      nextSupervisionDateForUpdate;
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

export async function completeObjectSupervision(
  objectId: number
) {
  const result =
    await completeSupervisionCycle({
      objectId,
    });

  refreshObjectPages(
    objectId
  );

  return result;
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
    data: objectDocuments,
    error: documentsError,
  } = await supabase
    .from("object_documents")
    .select("storage_path")
    .eq("object_id", objectId);

  if (documentsError) {
    throw new Error(
      "Не вдалося перевірити документи об’єкта перед видаленням. Об’єкт не видалено."
    );
  }

  const documentStoragePaths = [
    ...new Set(
      (objectDocuments || [])
        .map(
          (document) =>
            document.storage_path
        )
        .filter(
          (storagePath): storagePath is string =>
            typeof storagePath ===
              "string" &&
            storagePath.length > 0
        )
    ),
  ];

  if (
    documentStoragePaths.length >
    0
  ) {
    const adminClient =
      createServiceRoleClient();
    const {
      error: storageError,
    } = await adminClient.storage
      .from(
        OBJECT_DOCUMENTS_BUCKET
      )
      .remove(
        documentStoragePaths
      );

    if (storageError) {
      throw new Error(
        "Не вдалося видалити всі файли документів. Об’єкт не видалено, щоб не залишити файли без власника."
      );
    }
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
    if (
      documentStoragePaths.length >
      0
    ) {
      throw new Error(
        "Файли документів очищено, але об’єкт не вдалося видалити. Повідом адміністратора, щоб завершити очищення."
      );
    }

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
      documents_removed:
        documentStoragePaths.length,
    },
  });

  refreshObjectPages();
}
