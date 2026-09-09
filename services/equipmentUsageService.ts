import "server-only";

import {
  canManageEquipment,
} from "@/lib/auth/permissions";
import {
  isValidDateValue,
} from "@/lib/kyivDate";
import {
  createClient,
} from "@/lib/supabase/server";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  EquipmentUsageRecordResult,
  EquipmentUsageScheduleResult,
  EquipmentWorkSessionResult,
  RecordEquipmentUsageInput,
  RecordEquipmentWorkSessionInput,
  ConfigureEquipmentUsageInput,
} from "@/types/equipmentUsage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isNullableNumber(
  value: unknown
): value is number | null {
  return (
    typeof value === "number" ||
    value === null
  );
}

function isUsageRecordResult(
  value: unknown
): value is EquipmentUsageRecordResult {
  return (
    isRecord(value) &&
    typeof value.equipment_id ===
      "number" &&
    typeof value.equipment_name ===
      "string" &&
    (value.usage_type === "hours" ||
      value.usage_type === "km") &&
    isNullableNumber(
      value.previous_current_usage
    ) &&
    typeof value.new_current_usage ===
      "number" &&
    typeof value.reading_date ===
      "string" &&
    (value.entry_type === "reading" ||
      value.entry_type ===
        "correction") &&
    typeof value.usage_log_id ===
      "number" &&
    value.appended === true
  );
}

function isUsageScheduleResult(
  value: unknown
): value is EquipmentUsageScheduleResult {
  return (
    isRecord(value) &&
    typeof value.equipment_id ===
      "number" &&
    typeof value.equipment_name ===
      "string" &&
    (value.previous_usage_type ===
      "none" ||
      value.previous_usage_type ===
        "hours" ||
      value.previous_usage_type ===
        "km") &&
    (value.new_usage_type ===
      "none" ||
      value.new_usage_type ===
        "hours" ||
      value.new_usage_type ===
        "km") &&
    isNullableNumber(
      value.previous_maintenance_interval_usage
    ) &&
    isNullableNumber(
      value.new_maintenance_interval_usage
    ) &&
    isNullableNumber(
      value.previous_next_maintenance_usage
    ) &&
    isNullableNumber(
      value.new_next_maintenance_usage
    )
  );
}

function isEquipmentWorkSessionResult(
  value: unknown
): value is EquipmentWorkSessionResult {
  return (
    isRecord(value) &&
    typeof value.usage_log_id ===
      "number" &&
    typeof value.equipment_id ===
      "number" &&
    typeof value.equipment_name ===
      "string" &&
    value.usage_type === "hours" &&
    typeof value.previous_current_usage ===
      "number" &&
    typeof value.new_current_usage ===
      "number" &&
    typeof value.duration ===
      "number" &&
    typeof value.reading_date ===
      "string" &&
    value.entry_type ===
      "work_session" &&
    typeof value.object_id ===
      "number" &&
    typeof value.object_name ===
      "string" &&
    typeof value.employee_id ===
      "number" &&
    typeof value.employee_name ===
      "string" &&
    (typeof value.note ===
      "string" ||
      value.note === null) &&
    typeof value.created_by_name ===
      "string" &&
    value.appended === true &&
    typeof value.idempotent_replay ===
      "boolean"
  );
}

async function requireEquipmentUsageManagement() {
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
      "Обліком напрацювання техніки може керувати лише адміністратор."
    );
  }

  return profile;
}

export async function recordEquipmentUsageEntry(
  input: RecordEquipmentUsageInput
): Promise<EquipmentUsageRecordResult> {
  await requireEquipmentUsageManagement();

  if (
    !Number.isInteger(
      input.equipmentId
    ) ||
    input.equipmentId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити техніку."
    );
  }

  if (
    !Number.isFinite(
      input.reading
    ) ||
    input.reading < 0
  ) {
    throw new Error(
      "Показник має бути невід’ємним числом."
    );
  }

  if (
    !isValidDateValue(
      input.readingDate
    )
  ) {
    throw new Error(
      "Вкажи коректну дату показника."
    );
  }

  if (
    input.entryType !==
      "reading" &&
    input.entryType !==
      "correction"
  ) {
    throw new Error(
      "Некоректний тип запису напрацювання."
    );
  }

  const note =
    input.note?.trim() ||
    null;

  if (
    note &&
    note.length > 2000
  ) {
    throw new Error(
      "Примітка не може перевищувати 2000 символів."
    );
  }

  const supabase =
    await createClient();
  const { data, error } =
    await supabase.rpc(
      "record_equipment_usage",
      {
        p_equipment_id:
          input.equipmentId,
        p_reading:
          input.reading,
        p_reading_date:
          input.readingDate,
        p_entry_type:
          input.entryType,
        p_note: note,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося зберегти показник техніки: ${error.message}`
    );
  }

  if (
    !isUsageRecordResult(data)
  ) {
    throw new Error(
      "Система отримала некоректний результат запису напрацювання."
    );
  }

  return data;
}

export async function recordEquipmentWorkSessionEntry(
  input: RecordEquipmentWorkSessionInput
): Promise<EquipmentWorkSessionResult> {
  await requireEquipmentUsageManagement();

  if (
    !Number.isInteger(
      input.equipmentId
    ) ||
    input.equipmentId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити техніку."
    );
  }

  if (
    !Number.isFinite(
      input.duration
    ) ||
    input.duration <= 0
  ) {
    throw new Error(
      "Тривалість має бути додатним числом."
    );
  }

  if (
    !isValidDateValue(
      input.readingDate
    )
  ) {
    throw new Error(
      "Вкажи коректну дату роботи."
    );
  }

  for (const [value, message] of [
    [
      input.objectId,
      "Не вдалося визначити об’єкт.",
    ],
    [
      input.employeeId,
      "Не вдалося визначити працівника.",
    ],
  ] as const) {
    if (
      !Number.isInteger(value) ||
      value <= 0
    ) {
      throw new Error(message);
    }
  }

  if (
    !UUID_PATTERN.test(
      input.idempotencyKey
    )
  ) {
    throw new Error(
      "Не вдалося визначити унікальний ключ запису роботи."
    );
  }

  const note =
    input.note?.trim() ||
    null;

  if (
    note &&
    note.length > 2000
  ) {
    throw new Error(
      "Примітка не може перевищувати 2000 символів."
    );
  }

  const supabase =
    await createClient();
  const { data, error } =
    await supabase.rpc(
      "record_equipment_work_session",
      {
        p_equipment_id:
          input.equipmentId,
        p_duration:
          input.duration,
        p_reading_date:
          input.readingDate,
        p_object_id:
          input.objectId,
        p_employee_id:
          input.employeeId,
        p_note: note,
        p_idempotency_key:
          input.idempotencyKey,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося зберегти роботу техніки: ${error.message}`
    );
  }

  if (
    !isEquipmentWorkSessionResult(
      data
    )
  ) {
    throw new Error(
      "Система отримала некоректний результат запису роботи техніки."
    );
  }

  return data;
}

export async function configureEquipmentUsageSchedule(
  input: ConfigureEquipmentUsageInput
): Promise<EquipmentUsageScheduleResult> {
  await requireEquipmentUsageManagement();

  if (
    !Number.isInteger(
      input.equipmentId
    ) ||
    input.equipmentId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити техніку."
    );
  }

  if (
    input.usageType !== "none" &&
    input.usageType !== "hours" &&
    input.usageType !== "km"
  ) {
    throw new Error(
      "Некоректний тип напрацювання."
    );
  }

  for (const value of [
    input.maintenanceIntervalUsage,
    input.nextMaintenanceUsage,
  ]) {
    if (
      value !== null &&
      (!Number.isFinite(value) ||
        value < 0)
    ) {
      throw new Error(
        "Параметри напрацювання мають бути невід’ємними числами."
      );
    }
  }

  if (
    input.maintenanceIntervalUsage !==
      null &&
    input.maintenanceIntervalUsage <=
      0
  ) {
    throw new Error(
      "Інтервал ТО за напрацюванням має бути більшим за нуль."
    );
  }

  if (
    input.usageType !== "none" &&
    input.maintenanceIntervalUsage === null &&
    input.nextMaintenanceUsage !== null
  ) {
    throw new Error(
      "Поріг наступного ТО потребує налаштованого інтервалу."
    );
  }

  const maintenanceIntervalUsage =
    input.usageType === "none"
      ? null
      : input.maintenanceIntervalUsage;
  const nextMaintenanceUsage =
    input.usageType === "none"
      ? null
      : input.nextMaintenanceUsage;

  const supabase =
    await createClient();
  const { data, error } =
    await supabase.rpc(
      "configure_equipment_usage_schedule",
      {
        p_equipment_id:
          input.equipmentId,
        p_usage_type:
          input.usageType,
        p_maintenance_interval_usage:
          maintenanceIntervalUsage,
        p_next_maintenance_usage:
          nextMaintenanceUsage,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося налаштувати облік напрацювання: ${error.message}`
    );
  }

  if (
    !isUsageScheduleResult(data)
  ) {
    throw new Error(
      "Система отримала некоректний результат налаштування напрацювання."
    );
  }

  return data;
}
