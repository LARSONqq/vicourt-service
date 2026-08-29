"use server";

import { revalidatePath } from "next/cache";

import {
  EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE,
  EQUIPMENT_MAINTENANCE_TASK_SOURCE,
  MANUAL_TASK_SOURCE,
  SUPERVISION_TASK_MANAGED_MESSAGE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import { createClient } from "@/lib/supabase/server";
import { recordActivity } from "@/services/activityLogService";
import {
  completeEquipmentMaintenanceCycle,
  rescheduleEquipmentMaintenanceTask,
} from "@/services/equipmentMaintenanceTaskService";
import { getCurrentUserProfile } from "@/services/profileService";
import {
  completeSupervisionCycle,
  requireSupervisionTaskManagement,
  rescheduleSupervisionTask,
} from "@/services/supervisionTaskService";

import type {
  TaskPriority,
  TaskSource,
  TaskTargetType,
} from "@/types/objectTask";

const allowedStatuses = ["Заплановано", "В роботі", "Виконано"];
const allowedPriorities: TaskPriority[] = [
  "Низький",
  "Середній",
  "Високий",
  "Терміновий",
];

type TaskSnapshot = {
  id: number;
  object_id: number | null;
  equipment_id: number | null;
  title: string;
  status: string;
  due_date: string | null;
  priority: TaskPriority;
  task_source: TaskSource;
  object: { id: number; name: string } | null;
  equipment: {
    id: number;
    name: string;
    inventory_number: string | null;
  } | null;
};

type ParsedTaskTarget =
  | {
      type: Extract<TaskTargetType, "object">;
      objectId: number;
      equipmentId: null;
    }
  | {
      type: Extract<TaskTargetType, "equipment">;
      objectId: null;
      equipmentId: number;
    };

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

async function requireAuthenticatedUser() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error("Потрібно увійти в систему.");
  }

  return profile;
}

function refreshTaskPages(task?: {
  object_id: number | null;
  equipment_id: number | null;
}) {
  revalidatePath("/");
  revalidatePath("/task");
  revalidatePath("/calendar");
  revalidatePath("/employees");
  revalidatePath("/objects");
  revalidatePath("/equipment");
  revalidatePath("/notifications");

  if (task?.object_id) {
    revalidatePath(`/objects/${task.object_id}`);
  }
}

function validateTaskId(taskId: number) {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("Не вдалося визначити завдання.");
  }
}

function validateStatus(status: string) {
  if (!allowedStatuses.includes(status)) {
    throw new Error("Вибрано неправильний статус завдання.");
  }
}

function validatePriority(
  priority: string
): asserts priority is TaskPriority {
  if (!allowedPriorities.includes(priority as TaskPriority)) {
    throw new Error("Вибрано неправильний пріоритет завдання.");
  }
}

function validateDueDate(dueDate: string) {
  if (!dueDate) return;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) {
    throw new Error("Дата завдання має неправильний формат.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    throw new Error("Вказано неправильну дату завдання.");
  }
}

function parsePositiveId(value: string) {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseTaskTarget(formData: FormData): ParsedTaskTarget {
  const objectValue = getText(formData, "object_id");
  const equipmentValue = getText(formData, "equipment_id");
  const objectId = parsePositiveId(objectValue);
  const equipmentId = parsePositiveId(equipmentValue);

  if (
    (objectValue && objectId === null) ||
    (equipmentValue && equipmentId === null) ||
    (objectId === null && equipmentId === null) ||
    (objectId !== null && equipmentId !== null)
  ) {
    throw new Error(
      "Завдання повинно бути пов’язане рівно з одним об’єктом або технікою."
    );
  }

  if (objectId !== null) {
    return { type: "object", objectId, equipmentId: null };
  }

  if (equipmentId !== null) {
    return { type: "equipment", objectId: null, equipmentId };
  }

  throw new Error(
    "Завдання повинно бути пов’язане рівно з одним об’єктом або технікою."
  );
}

async function ensureTaskTargetExists(target: ParsedTaskTarget) {
  const supabase = await createClient();

  if (target.type === "object") {
    const { data, error } = await supabase
      .from("objects")
      .select("id")
      .eq("id", target.objectId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        error
          ? `Не вдалося перевірити об’єкт: ${error.message}`
          : "Вибраний об’єкт не знайдено."
      );
    }
    return;
  }

  const { data, error } = await supabase
    .from("equipment")
    .select("id")
    .eq("id", target.equipmentId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error
        ? `Не вдалося перевірити техніку: ${error.message}`
        : "Вибрану техніку не знайдено."
    );
  }
}

async function getAssignedEmployee(
  employeeValue: string,
  oldAssigneeValue: string
) {
  if (!employeeValue) {
    return { employeeId: null, assignee: oldAssigneeValue || null };
  }

  const employeeId = Number(employeeValue);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new Error("Неправильно вибраний працівник.");
  }

  const supabase = await createClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не вдалося завантажити працівника: ${error.message}`);
  }
  if (!employee) {
    throw new Error("Вибраного працівника не знайдено.");
  }

  return {
    employeeId: Number(employee.id),
    assignee:
      [employee.last_name, employee.first_name].filter(Boolean).join(" ") ||
      null,
  };
}

async function getTaskSnapshot(taskId: number): Promise<TaskSnapshot> {
  validateTaskId(taskId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("object_tasks")
    .select(`
      id,
      object_id,
      equipment_id,
      title,
      status,
      due_date,
      priority,
      task_source,
      object:objects (id, name),
      equipment:equipment (id, name, inventory_number)
    `)
    .eq("id", taskId)
    .maybeSingle()
    .overrideTypes<TaskSnapshot | null, { merge: false }>();

  if (error) {
    throw new Error(`Не вдалося завантажити завдання: ${error.message}`);
  }
  if (!data) {
    throw new Error("Завдання не знайдено.");
  }
  return data;
}

function getTaskTargetMetadata(task: TaskSnapshot) {
  if (task.object_id && task.object) {
    return {
      objectId: task.object_id,
      targetType: "object" as const,
      targetId: task.object_id,
      targetName: task.object.name,
    };
  }

  return {
    objectId: undefined,
    targetType: "equipment" as const,
    targetId: task.equipment_id,
    targetName: task.equipment?.name || "Техніка",
  };
}

function assertManualTask(task: TaskSnapshot) {
  if (task.task_source === SUPERVISION_TASK_SOURCE) {
    throw new Error(SUPERVISION_TASK_MANAGED_MESSAGE);
  }
  if (task.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE) {
    throw new Error(EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE);
  }
}

export async function createObjectTask(formData: FormData) {
  await requireAuthenticatedUser();
  const target = parseTaskTarget(formData);
  await ensureTaskTargetExists(target);

  const title = getText(formData, "title");
  const description = getText(formData, "description");
  const dueDate = getText(formData, "due_date");
  const employeeValue = getText(formData, "assigned_employee_id");
  const oldAssigneeValue = getText(formData, "assignee");
  const status = getText(formData, "status") || "Заплановано";
  const priority = getText(formData, "priority") || "Середній";

  if (!title) throw new Error("Введи назву завдання.");
  validateDueDate(dueDate);
  validateStatus(status);
  validatePriority(priority);

  const assignment = await getAssignedEmployee(
    employeeValue,
    oldAssigneeValue
  );
  const supabase = await createClient();
  const { data: createdTask, error } = await supabase
    .from("object_tasks")
    .insert({
      object_id: target.objectId,
      equipment_id: target.equipmentId,
      title,
      description: description || null,
      due_date: dueDate || null,
      assigned_employee_id: assignment.employeeId,
      assignee: assignment.assignee,
      priority,
      status,
      task_source: MANUAL_TASK_SOURCE,
    })
    .select(`
      id, object_id, equipment_id, title, status, due_date, priority, task_source,
      object:objects (id, name),
      equipment:equipment (id, name, inventory_number)
    `)
    .single()
    .overrideTypes<TaskSnapshot, { merge: false }>();

  if (error) {
    throw new Error(`Не вдалося створити завдання: ${error.message}`);
  }

  const targetMetadata = getTaskTargetMetadata(createdTask);
  await recordActivity({
    action: "task.created",
    entityType: "task",
    entityId: createdTask.id,
    entityName: createdTask.title,
    objectId: targetMetadata.objectId,
    description: `Створив завдання «${createdTask.title}».`,
    metadata: {
      status: createdTask.status,
      priority: createdTask.priority,
      due_date: createdTask.due_date,
      target_type: targetMetadata.targetType,
      target_id: targetMetadata.targetId,
      target_name: targetMetadata.targetName,
    },
  });
  refreshTaskPages(createdTask);
}

export async function updateObjectTask(formData: FormData) {
  await requireAuthenticatedUser();
  const taskId = Number(formData.get("task_id"));
  const previousTask = await getTaskSnapshot(taskId);
  assertManualTask(previousTask);
  const target = parseTaskTarget(formData);
  await ensureTaskTargetExists(target);

  const title = getText(formData, "title");
  const description = getText(formData, "description");
  const dueDate = getText(formData, "due_date");
  const employeeValue = getText(formData, "assigned_employee_id");
  const oldAssigneeValue = getText(formData, "assignee");
  const status = getText(formData, "status") || "Заплановано";
  const priority = getText(formData, "priority") || "Середній";

  if (!title) throw new Error("Введи назву завдання.");
  validateDueDate(dueDate);
  validateStatus(status);
  validatePriority(priority);

  const assignment = await getAssignedEmployee(
    employeeValue,
    oldAssigneeValue
  );
  const supabase = await createClient();
  const { error } = await supabase
    .from("object_tasks")
    .update({
      object_id: target.objectId,
      equipment_id: target.equipmentId,
      title,
      description: description || null,
      due_date: dueDate || null,
      assigned_employee_id: assignment.employeeId,
      assignee: assignment.assignee,
      priority,
      status,
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Не вдалося оновити завдання: ${error.message}`);
  }

  const completed = previousTask.status !== "Виконано" && status === "Виконано";
  const nextTask = await getTaskSnapshot(taskId);
  const targetMetadata = getTaskTargetMetadata(nextTask);
  await recordActivity({
    action: completed ? "task.completed" : "task.updated",
    entityType: "task",
    entityId: taskId,
    entityName: title,
    objectId: targetMetadata.objectId,
    description: completed
      ? `Виконав завдання «${title}».`
      : `Відредагував завдання «${title}».`,
    metadata: {
      previous_status: previousTask.status,
      new_status: status,
      previous_due_date: previousTask.due_date,
      new_due_date: dueDate || null,
      priority,
      target_type: targetMetadata.targetType,
      target_id: targetMetadata.targetId,
      target_name: targetMetadata.targetName,
    },
  });
  refreshTaskPages(previousTask);
  refreshTaskPages(nextTask);
}

export async function updateTaskStatus(taskId: number, status: string) {
  await requireAuthenticatedUser();
  validateStatus(status);
  const previousTask = await getTaskSnapshot(taskId);

  if (previousTask.task_source === SUPERVISION_TASK_SOURCE) {
    if (!previousTask.object_id) {
      throw new Error("Автоматичний огляд не має коректного об’єкта.");
    }
    if (status === "Виконано") {
      await completeSupervisionCycle({
        objectId: previousTask.object_id,
        taskId,
      });
      refreshTaskPages(previousTask);
      return { id: taskId, status: "Виконано" };
    }
    if (previousTask.status === "Виконано") {
      throw new Error("Завершений періодичний огляд не можна повернути в роботу.");
    }
    await requireSupervisionTaskManagement();
  }

  if (previousTask.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE) {
    if (!previousTask.equipment_id) {
      throw new Error("Автоматичне ТО не має коректної техніки.");
    }
    if (status !== "Виконано") {
      throw new Error(EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE);
    }
    await completeEquipmentMaintenanceCycle({
      equipmentId: previousTask.equipment_id,
      taskId,
    });
    return { id: taskId, status: "Виконано" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("object_tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) throw new Error(`Не вдалося змінити статус: ${error.message}`);

  const completed = previousTask.status !== "Виконано" && status === "Виконано";
  const targetMetadata = getTaskTargetMetadata(previousTask);
  await recordActivity({
    action: completed ? "task.completed" : "task.status_changed",
    entityType: "task",
    entityId: taskId,
    entityName: previousTask.title,
    objectId: targetMetadata.objectId,
    description: completed
      ? `Виконав завдання «${previousTask.title}».`
      : `Змінив статус завдання «${previousTask.title}»: ${previousTask.status} → ${status}.`,
    metadata: {
      previous_status: previousTask.status,
      new_status: status,
      target_type: targetMetadata.targetType,
      target_id: targetMetadata.targetId,
      target_name: targetMetadata.targetName,
    },
  });
  refreshTaskPages(previousTask);
  return { id: taskId, status };
}

export async function updateTaskDueDate(
  taskId: number,
  dueDate: string | null
) {
  await requireAuthenticatedUser();
  const normalizedDueDate = String(dueDate ?? "").trim();
  validateDueDate(normalizedDueDate);
  const savedDueDate = normalizedDueDate || null;
  const previousTask = await getTaskSnapshot(taskId);

  if (previousTask.task_source === SUPERVISION_TASK_SOURCE) {
    if (!previousTask.object_id || !savedDueDate) {
      throw new Error(
        "Автоматичний огляд повинен мати дату. Змініть налаштування через об’єкт."
      );
    }
    const result = await rescheduleSupervisionTask({
      taskId,
      objectId: previousTask.object_id,
      dueDate: savedDueDate,
    });
    refreshTaskPages(previousTask);
    return result;
  }

  if (previousTask.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE) {
    if (!previousTask.equipment_id || !savedDueDate) {
      throw new Error("Автоматичне ТО повинно мати дату. Змініть її через техніку.");
    }
    return rescheduleEquipmentMaintenanceTask({
      taskId,
      equipmentId: previousTask.equipment_id,
      dueDate: savedDueDate,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("object_tasks")
    .update({ due_date: savedDueDate })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Не вдалося змінити дату завдання: ${error.message}`);
  }

  const targetMetadata = getTaskTargetMetadata(previousTask);
  await recordActivity({
    action: "task.rescheduled",
    entityType: "task",
    entityId: taskId,
    entityName: previousTask.title,
    objectId: targetMetadata.objectId,
    description: `Переніс дату завдання «${previousTask.title}»: ${
      previousTask.due_date || "без дати"
    } → ${savedDueDate || "без дати"}.`,
    metadata: {
      previous_due_date: previousTask.due_date,
      new_due_date: savedDueDate,
      target_type: targetMetadata.targetType,
      target_id: targetMetadata.targetId,
      target_name: targetMetadata.targetName,
    },
  });
  refreshTaskPages(previousTask);
  return { id: taskId, dueDate: savedDueDate };
}

export async function deleteObjectTask(taskId: number) {
  await requireAuthenticatedUser();
  const task = await getTaskSnapshot(taskId);
  assertManualTask(task);
  const supabase = await createClient();
  const { error } = await supabase.from("object_tasks").delete().eq("id", taskId);

  if (error) throw new Error(`Не вдалося видалити завдання: ${error.message}`);

  const targetMetadata = getTaskTargetMetadata(task);
  await recordActivity({
    action: "task.deleted",
    entityType: "task",
    entityId: task.id,
    entityName: task.title,
    objectId: targetMetadata.objectId,
    description: `Видалив завдання «${task.title}».`,
    metadata: {
      status: task.status,
      due_date: task.due_date,
      priority: task.priority,
      target_type: targetMetadata.targetType,
      target_id: targetMetadata.targetId,
      target_name: targetMetadata.targetName,
    },
  });
  refreshTaskPages(task);
}
