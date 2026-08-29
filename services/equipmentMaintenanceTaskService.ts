import "server-only";

import { revalidatePath } from "next/cache";

import { canManageEquipment } from "@/lib/auth/permissions";
import { formatDateValue } from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import { recordActivity } from "@/services/activityLogService";
import { getCurrentUserProfile } from "@/services/profileService";

import type { EquipmentMaintenanceCompletionResult } from "@/types/equipment";

type MaintenanceTaskSyncResult = {
  action: "created" | "updated" | "removed" | "none";
  task_id: number | null;
};

type MaintenanceTaskRescheduleResult = {
  task_id: number;
  equipment_id: number;
  equipment_name: string;
  previous_due_date: string | null;
  new_due_date: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isSyncResult(value: unknown): value is MaintenanceTaskSyncResult {
  return (
    isRecord(value) &&
    (value.action === "created" ||
      value.action === "updated" ||
      value.action === "removed" ||
      value.action === "none") &&
    (typeof value.task_id === "number" || value.task_id === null)
  );
}

function isRescheduleResult(
  value: unknown
): value is MaintenanceTaskRescheduleResult {
  return (
    isRecord(value) &&
    typeof value.task_id === "number" &&
    typeof value.equipment_id === "number" &&
    typeof value.equipment_name === "string" &&
    isNullableString(value.previous_due_date) &&
    typeof value.new_due_date === "string"
  );
}

function isCompletionResult(
  value: unknown
): value is EquipmentMaintenanceCompletionResult {
  return (
    isRecord(value) &&
    typeof value.service_history_id === "number" &&
    typeof value.equipment_name === "string" &&
    isNullableString(value.previous_last_maintenance_date) &&
    typeof value.new_last_maintenance_date === "string" &&
    isNullableString(value.previous_next_service_date) &&
    typeof value.new_next_service_date === "string" &&
    typeof value.maintenance_interval_days === "number" &&
    (typeof value.completed_task_id === "number" ||
      value.completed_task_id === null) &&
    (typeof value.next_task_id === "number" ||
      value.next_task_id === null)
  );
}

export async function requireEquipmentMaintenanceManagement() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error("Для виконання цієї дії потрібно увійти в систему.");
  }

  if (!canManageEquipment(profile.role)) {
    throw new Error("Плановим ТО техніки може керувати лише адміністратор.");
  }

  return profile;
}

export function revalidateEquipmentMaintenancePages() {
  revalidatePath("/");
  revalidatePath("/task");
  revalidatePath("/calendar");
  revalidatePath("/equipment");
  revalidatePath("/notifications");
  revalidatePath("/employees");
  revalidatePath("/reports");
}

export async function syncEquipmentMaintenanceTask(
  equipmentId: number
): Promise<MaintenanceTaskSyncResult> {
  await requireEquipmentMaintenanceManagement();

  if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
    throw new Error("Не вдалося визначити техніку.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "sync_equipment_maintenance_task",
    { p_equipment_id: equipmentId }
  );

  if (error) {
    throw new Error(
      `Техніку збережено, але не вдалося синхронізувати завдання ТО: ${error.message}`
    );
  }

  if (!isSyncResult(data)) {
    throw new Error("Система отримала некоректний результат синхронізації ТО.");
  }

  revalidateEquipmentMaintenancePages();
  return data;
}

export async function rescheduleEquipmentMaintenanceTask(input: {
  taskId: number;
  equipmentId: number;
  dueDate: string;
}) {
  await requireEquipmentMaintenanceManagement();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "reschedule_equipment_maintenance_task",
    {
      p_task_id: input.taskId,
      p_equipment_id: input.equipmentId,
      p_due_date: input.dueDate,
    }
  );

  if (error) {
    throw new Error(`Не вдалося перенести планове ТО: ${error.message}`);
  }

  if (!isRescheduleResult(data)) {
    throw new Error("Система отримала некоректний результат перенесення ТО.");
  }

  await recordActivity({
    action: "equipment.maintenance_rescheduled",
    entityType: "equipment",
    entityId: data.equipment_id,
    entityName: data.equipment_name,
    description: `Перенесено планове ТО техніки «${data.equipment_name}»: ${
      formatDateValue(data.previous_due_date) || "без дати"
    } → ${formatDateValue(data.new_due_date) || data.new_due_date}.`,
    metadata: {
      task_id: data.task_id,
      previous_next_service_date: data.previous_due_date,
      new_next_service_date: data.new_due_date,
    },
  });

  revalidateEquipmentMaintenancePages();
  return { id: data.task_id, dueDate: data.new_due_date };
}

export async function completeEquipmentMaintenanceCycle(input: {
  equipmentId: number;
  taskId?: number | null;
  cost?: number;
  description?: string | null;
}): Promise<EquipmentMaintenanceCompletionResult> {
  const profile = await requireEquipmentMaintenanceManagement();
  const cost = input.cost ?? 0;

  if (!Number.isInteger(input.equipmentId) || input.equipmentId <= 0) {
    throw new Error("Не вдалося визначити техніку.");
  }

  if (
    input.taskId !== undefined &&
    input.taskId !== null &&
    (!Number.isInteger(input.taskId) || input.taskId <= 0)
  ) {
    throw new Error("Не вдалося визначити завдання ТО.");
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("Вартість ТО не може бути від’ємною.");
  }

  const performedBy =
    profile.full_name?.trim() ||
    profile.email?.trim() ||
    "Користувач ViCourt";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "complete_equipment_maintenance",
    {
      p_equipment_id: input.equipmentId,
      p_task_id: input.taskId ?? null,
      p_cost: cost,
      p_performed_by: performedBy,
      p_description: input.description?.trim() || null,
    }
  );

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("maintenance interval")) {
      throw new Error("Спочатку налаштуйте періодичність ТО.");
    }

    if (message.includes("already completed")) {
      throw new Error("Планове ТО вже відмічено виконаним сьогодні.");
    }

    throw new Error(`Не вдалося завершити планове ТО: ${error.message}`);
  }

  if (!isCompletionResult(data)) {
    throw new Error("Система отримала некоректний результат завершення ТО.");
  }

  await recordActivity({
    action: "equipment.maintenance_completed",
    entityType: "equipment",
    entityId: input.equipmentId,
    entityName: data.equipment_name,
    description: `Виконано планове ТО техніки «${data.equipment_name}». Наступне ТО: ${
      formatDateValue(data.new_next_service_date) || data.new_next_service_date
    }.`,
    metadata: {
      previous_last_maintenance_date: data.previous_last_maintenance_date,
      new_last_maintenance_date: data.new_last_maintenance_date,
      previous_next_service_date: data.previous_next_service_date,
      new_next_service_date: data.new_next_service_date,
      maintenance_interval_days: data.maintenance_interval_days,
      service_history_id: data.service_history_id,
      completed_task_id: data.completed_task_id,
      next_task_id: data.next_task_id,
    },
  });

  revalidateEquipmentMaintenancePages();
  return data;
}
