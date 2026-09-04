"use server";

import {
  formatDateValue,
  getKyivDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";

import {
  completeEquipmentMaintenanceCycle,
  revalidateEquipmentMaintenancePages,
} from "@/services/equipmentMaintenanceTaskService";
import {
  createEquipmentServiceRecordV2,
  voidEquipmentServiceRecordV2,
} from "@/services/equipmentService";
import {
  recordActivity,
} from "@/services/activityLogService";

import {
  equipmentServiceTypes,
} from "@/constants/equipmentService";

import type {
  EquipmentMaintenanceActionResult,
  EquipmentMaintenanceCompletionResult,
} from "@/types/equipment";
import type {
  EquipmentServiceType,
} from "@/types/equipmentServiceRecord";

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function getOptionalNumber(
  formData: FormData,
  field: string
) {
  const value = getText(
    formData,
    field
  );

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error("Показник напрацювання має бути невід’ємним числом.");
  }

  return numberValue;
}

function getNextMaintenanceSummary(
  data: EquipmentMaintenanceCompletionResult
) {
  const nextDate = formatDateValue(data.new_next_service_date);
  const usageUnit = data.usage_type === "hours" ? "мотогод." : "км";
  const parts = [
    nextDate,
    data.new_next_maintenance_usage !== null && data.usage_type !== "none"
      ? `${data.new_next_maintenance_usage} ${usageUnit}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join("; ") || "не заплановано";
}

export async function completeEquipmentMaintenance(
  formData: FormData
): Promise<EquipmentMaintenanceActionResult> {
  try {
    const equipmentId =
      Number(
        formData.get(
          "equipment_id"
        )
      );
    const costValue =
      getText(
        formData,
        "cost"
      );
    const cost =
      costValue
        ? Number(costValue)
        : 0;
    const description =
      getText(
        formData,
        "description"
      );
    const usageReading = getOptionalNumber(
      formData,
      "usage_reading"
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

    if (
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      throw new Error(
        "Вартість ТО не може бути від’ємною."
      );
    }

    const data =
      await completeEquipmentMaintenanceCycle({
        equipmentId,
        cost,
        description,
        usageReading,
      });

    return {
      success: true,
      message: `ТО виконано. Наступне ТО: ${getNextMaintenanceSummary(data)}.`,
      completion: data,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Не вдалося завершити планове ТО.",
    };
  }
}

export async function createEquipmentServiceRecord(
  formData: FormData
) {
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
  const usageReading = getOptionalNumber(
    formData,
    "usage_reading"
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

  if (!isValidDateValue(serviceDate)) {
    throw new Error(
      "Вкажи коректну дату обслуговування."
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
    (!isValidDateValue(nextServiceDate) ||
      nextServiceDate < serviceDate)
  ) {
    throw new Error(
      "Наступне обслуговування не може бути раніше за поточне."
    );
  }

  if (serviceType === "Планове обслуговування") {
    if (serviceDate !== getKyivDateValue()) {
      throw new Error(
        "Планове ТО фіксується поточною датою за київським часом."
      );
    }

    if (nextServiceDate) {
      throw new Error(
        "Дата наступного планового ТО розраховується автоматично за налаштованим інтервалом."
      );
    }

    await completeEquipmentMaintenanceCycle({
      equipmentId,
      cost,
      performedBy,
      description,
      usageReading,
    });
    return;
  }

  const data = await createEquipmentServiceRecordV2({
    equipmentId,
    serviceType: serviceType as EquipmentServiceType,
    serviceDate,
    cost,
    performedBy,
    description,
    nextServiceDate,
    usageReading,
  });

  await recordActivity({
    action: "equipment.service_record_created",
    entityType: "equipment",
    entityId: data.equipment_id,
    entityName: data.equipment_name,
    description: `Додано сервісний запис «${data.service_type}» для техніки «${data.equipment_name}».`,
    metadata: {
      service_history_id: data.service_history_id,
      service_type: data.service_type,
      service_date: data.service_date,
      cost: data.cost,
      performed_by: data.performed_by,
      description: data.description,
      next_service_date: data.next_service_date,
      usage_type: data.usage_type,
      usage_reading: data.usage_reading,
      usage_log_id: data.usage_log_id,
    },
  });

  revalidateEquipmentMaintenancePages();
}

export async function deleteEquipmentServiceRecord(
  recordId: number
) {
  await voidEquipmentServiceRecord(
    recordId,
    "Сервісний запис анульовано через дію видалення."
  );
}

export async function voidEquipmentServiceRecord(
  recordId: number,
  reason: string
) {
  const data = await voidEquipmentServiceRecordV2({
    serviceRecordId: recordId,
    reason,
  });

  await recordActivity({
    action: "equipment.service_record_voided",
    entityType: "equipment",
    entityId: data.equipment_id,
    entityName: data.equipment_name,
    description: `Анульовано сервісний запис «${data.service_type}» для техніки «${data.equipment_name}».`,
    metadata: {
      service_history_id: data.service_history_id,
      service_type: data.service_type,
      service_date: data.service_date,
      cost: data.cost,
      void_reason: data.void_reason,
    },
  });

  revalidateEquipmentMaintenancePages();
}
