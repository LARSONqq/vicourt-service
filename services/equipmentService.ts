import "server-only";

import {
  cache,
} from "react";

import {
  equipmentServiceTypes,
} from "@/constants/equipmentService";
import {
  canManageEquipment,
} from "@/lib/auth/permissions";
import {
  getKyivDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type { Equipment } from "@/types/equipment";
import type {
  CreateEquipmentServiceRecordInput,
  EquipmentServiceCreationResult,
  EquipmentServiceRecord,
  EquipmentServiceVoidResult,
  VoidEquipmentServiceRecordInput,
} from "@/types/equipmentServiceRecord";

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(
  value: unknown
): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableNumber(
  value: unknown
): value is number | null {
  return typeof value === "number" || value === null;
}

function isServiceCreationResult(
  value: unknown
): value is EquipmentServiceCreationResult {
  return (
    isRecord(value) &&
    typeof value.service_history_id === "number" &&
    typeof value.equipment_id === "number" &&
    typeof value.equipment_name === "string" &&
    equipmentServiceTypes.includes(
      value.service_type as (typeof equipmentServiceTypes)[number]
    ) &&
    typeof value.service_date === "string" &&
    typeof value.cost === "number" &&
    isNullableString(value.performed_by) &&
    isNullableString(value.description) &&
    isNullableString(value.next_service_date) &&
    (value.usage_type === "hours" ||
      value.usage_type === "km" ||
      value.usage_type === null) &&
    isNullableNumber(value.usage_reading) &&
    isNullableNumber(value.usage_log_id)
  );
}

function isServiceVoidResult(
  value: unknown
): value is EquipmentServiceVoidResult {
  return (
    isRecord(value) &&
    typeof value.service_history_id === "number" &&
    typeof value.equipment_id === "number" &&
    typeof value.equipment_name === "string" &&
    equipmentServiceTypes.includes(
      value.service_type as (typeof equipmentServiceTypes)[number]
    ) &&
    typeof value.service_date === "string" &&
    typeof value.cost === "number" &&
    typeof value.void_reason === "string"
  );
}

async function requireEquipmentServiceManagement() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error("Для виконання цієї дії потрібно увійти в систему.");
  }

  if (!canManageEquipment(profile.role)) {
    throw new Error(
      "Обслуговуванням техніки може керувати лише адміністратор."
    );
  }
}

async function loadEquipment(): Promise<Equipment[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("equipment")
    .select("*")
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити техніку: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as Equipment[];
}

export const getEquipment =
  cache(loadEquipment);

export async function getEquipmentServiceRecords(): Promise<
  EquipmentServiceRecord[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "equipment_service_records"
    )
    .select(`
      id,
      equipment_id,
      service_type,
      service_date,
      cost,
      performed_by,
      description,
      next_service_date,
      usage_reading,
      usage_type_snapshot,
      usage_log_id,
      created_by,
      created_by_name,
      voided_at,
      voided_by,
      void_reason,
      created_at,
      equipment:equipment (
        id,
        name,
        inventory_number
      )
    `)
    .is(
      "voided_at",
      null
    )
    .order(
      "service_date",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .overrideTypes<
      EquipmentServiceRecord[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію обслуговування: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getEquipmentServiceRecordsByEquipmentId(
  equipmentId: number
): Promise<
  EquipmentServiceRecord[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "equipment_service_records"
    )
    .select(`
      id,
      equipment_id,
      service_type,
      service_date,
      cost,
      performed_by,
      description,
      next_service_date,
      usage_reading,
      usage_type_snapshot,
      usage_log_id,
      created_by,
      created_by_name,
      voided_at,
      voided_by,
      void_reason,
      created_at,
      equipment:equipment (
        id,
        name,
        inventory_number
      )
    `)
    .eq(
      "equipment_id",
      equipmentId
    )
    .is(
      "voided_at",
      null
    )
    .order(
      "service_date",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .overrideTypes<
      EquipmentServiceRecord[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити обслуговування техніки: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function createEquipmentServiceRecordV2(
  input: CreateEquipmentServiceRecordInput
): Promise<EquipmentServiceCreationResult> {
  await requireEquipmentServiceManagement();

  if (!Number.isInteger(input.equipmentId) || input.equipmentId <= 0) {
    throw new Error("Не вдалося визначити техніку.");
  }

  if (!equipmentServiceTypes.includes(input.serviceType)) {
    throw new Error("Обери тип обслуговування.");
  }

  if (input.serviceType === "Планове обслуговування") {
    throw new Error(
      "Планове ТО потрібно завершувати через окрему дію «ТО виконано»."
    );
  }

  if (
    !isValidDateValue(input.serviceDate) ||
    input.serviceDate > getKyivDateValue()
  ) {
    throw new Error("Вкажи коректну дату обслуговування без майбутньої дати.");
  }

  if (!Number.isFinite(input.cost) || input.cost < 0) {
    throw new Error("Вартість обслуговування не може бути від’ємною.");
  }

  const nextServiceDate = input.nextServiceDate?.trim() || null;

  if (
    nextServiceDate &&
    (!isValidDateValue(nextServiceDate) ||
      nextServiceDate < input.serviceDate)
  ) {
    throw new Error(
      "Наступне обслуговування не може бути раніше за поточне."
    );
  }

  if (
    input.usageReading !== undefined &&
    input.usageReading !== null &&
    (!Number.isFinite(input.usageReading) || input.usageReading < 0)
  ) {
    throw new Error("Показник напрацювання має бути невід’ємним числом.");
  }

  const performedBy = input.performedBy?.trim() || null;
  const description = input.description?.trim() || null;

  if (performedBy && performedBy.length > 300) {
    throw new Error("Поле «Хто виконав» не може перевищувати 300 символів.");
  }

  if (description && description.length > 4000) {
    throw new Error("Опис робіт не може перевищувати 4000 символів.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_equipment_service_record_v2",
    {
      p_equipment_id: input.equipmentId,
      p_service_type: input.serviceType,
      p_service_date: input.serviceDate,
      p_cost: input.cost,
      p_performed_by: performedBy,
      p_description: description,
      p_next_service_date: nextServiceDate,
      p_usage_reading: input.usageReading ?? null,
    }
  );

  if (error) {
    throw new Error(`Не вдалося додати запис обслуговування: ${error.message}`);
  }

  if (!isServiceCreationResult(data)) {
    throw new Error(
      "Система отримала некоректний результат створення сервісного запису."
    );
  }

  return data;
}

export async function voidEquipmentServiceRecordV2(
  input: VoidEquipmentServiceRecordInput
): Promise<EquipmentServiceVoidResult> {
  await requireEquipmentServiceManagement();

  if (!Number.isInteger(input.serviceRecordId) || input.serviceRecordId <= 0) {
    throw new Error("Не вдалося визначити запис обслуговування.");
  }

  const reason = input.reason.trim();

  if (!reason || reason.length > 1000) {
    throw new Error("Вкажи причину анулювання до 1000 символів.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "void_equipment_service_record",
    {
      p_service_record_id: input.serviceRecordId,
      p_void_reason: reason,
    }
  );

  if (error) {
    throw new Error(`Не вдалося анулювати сервісний запис: ${error.message}`);
  }

  if (!isServiceVoidResult(data)) {
    throw new Error(
      "Система отримала некоректний результат анулювання сервісного запису."
    );
  }

  return data;
}
