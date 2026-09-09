"use server";

import {
  revalidateEquipmentMaintenancePages,
} from "@/services/equipmentMaintenanceTaskService";
import {
  recordActivity,
} from "@/services/activityLogService";
import {
  configureEquipmentUsageSchedule,
  recordEquipmentUsageEntry,
  recordEquipmentWorkSessionEntry,
} from "@/services/equipmentUsageService";

import type {
  ConfigureEquipmentUsageInput,
  EquipmentUsageRecordResult,
  EquipmentUsageScheduleResult,
  EquipmentWorkSessionResult,
  RecordEquipmentUsageInput,
  RecordEquipmentWorkSessionInput,
} from "@/types/equipmentUsage";

function getUsageUnit(
  usageType: "hours" | "km"
) {
  return usageType === "hours"
    ? "мотогод."
    : "км";
}

export async function recordEquipmentUsage(
  input: RecordEquipmentUsageInput
): Promise<EquipmentUsageRecordResult> {
  const data = await recordEquipmentUsageEntry(input);
  const corrected = data.entry_type === "correction";

  await recordActivity({
    action: corrected
      ? "equipment.usage_corrected"
      : "equipment.usage_recorded",
    entityType: "equipment",
    entityId: data.equipment_id,
    entityName: data.equipment_name,
    description: `${
      corrected ? "Скориговано" : "Зафіксовано"
    } напрацювання техніки «${data.equipment_name}»: ${data.new_current_usage} ${getUsageUnit(
      data.usage_type
    )}.`,
    metadata: {
      usage_log_id: data.usage_log_id,
      usage_type: data.usage_type,
      entry_type: data.entry_type,
      reading_date: data.reading_date,
      previous_current_usage: data.previous_current_usage,
      new_current_usage: data.new_current_usage,
    },
  });

  revalidateEquipmentMaintenancePages();
  return data;
}

export async function recordEquipmentWorkSession(
  input: RecordEquipmentWorkSessionInput
): Promise<EquipmentWorkSessionResult> {
  const data =
    await recordEquipmentWorkSessionEntry(
      input
    );

  if (!data.idempotent_replay) {
    await recordActivity({
      action:
        "equipment.usage_recorded",
      entityType: "equipment",
      entityId: data.equipment_id,
      entityName:
        data.equipment_name,
      objectId: data.object_id,
      objectName: data.object_name,
      description: `Зафіксовано роботу техніки «${data.equipment_name}»: +${data.duration} мотогод. на об’єкті «${data.object_name}» (${data.employee_name}).`,
      metadata: {
        usage_log_id:
          data.usage_log_id,
        usage_type:
          data.usage_type,
        entry_type:
          data.entry_type,
        duration: data.duration,
        reading_date:
          data.reading_date,
        object_name:
          data.object_name,
        employee_name:
          data.employee_name,
        previous_current_usage:
          data.previous_current_usage,
        new_current_usage:
          data.new_current_usage,
      },
    });
  }

  revalidateEquipmentMaintenancePages();
  return data;
}

export async function configureEquipmentUsage(
  input: ConfigureEquipmentUsageInput
): Promise<EquipmentUsageScheduleResult> {
  const data = await configureEquipmentUsageSchedule(input);

  await recordActivity({
    action: "equipment.maintenance_schedule_updated",
    entityType: "equipment",
    entityId: data.equipment_id,
    entityName: data.equipment_name,
    description: `Оновлено налаштування ТО за напрацюванням техніки «${data.equipment_name}».`,
    metadata: {
      previous_usage_type: data.previous_usage_type,
      new_usage_type: data.new_usage_type,
      previous_maintenance_interval_usage:
        data.previous_maintenance_interval_usage,
      new_maintenance_interval_usage:
        data.new_maintenance_interval_usage,
      previous_next_maintenance_usage:
        data.previous_next_maintenance_usage,
      new_next_maintenance_usage:
        data.new_next_maintenance_usage,
    },
  });

  revalidateEquipmentMaintenancePages();
  return data;
}
