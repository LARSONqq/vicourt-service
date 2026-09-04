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
  EquipmentUsageLog,
  EquipmentUsageRecordResult,
  EquipmentUsageScheduleResult,
  RecordEquipmentUsageInput,
  ConfigureEquipmentUsageInput,
} from "@/types/equipmentUsage";

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

export async function getEquipmentUsageLogs(): Promise<
  EquipmentUsageLog[]
> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from(
        "equipment_usage_logs"
      )
      .select(`
        id,
        equipment_id,
        equipment_name_snapshot,
        inventory_number_snapshot,
        usage_type,
        reading,
        previous_reading,
        delta,
        reading_date,
        entry_type,
        note,
        created_by,
        created_by_name,
        created_at
      `)
      .order("reading_date", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .overrideTypes<
        EquipmentUsageLog[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію напрацювання: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getEquipmentUsageLogsByEquipmentId(
  equipmentId: number
): Promise<EquipmentUsageLog[]> {
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

  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from(
        "equipment_usage_logs"
      )
      .select(`
        id,
        equipment_id,
        equipment_name_snapshot,
        inventory_number_snapshot,
        usage_type,
        reading,
        previous_reading,
        delta,
        reading_date,
        entry_type,
        note,
        created_by,
        created_by_name,
        created_at
      `)
      .eq(
        "equipment_id",
        equipmentId
      )
      .order("reading_date", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .overrideTypes<
        EquipmentUsageLog[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити напрацювання техніки: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
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
