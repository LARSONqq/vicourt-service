"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  recordActivity,
} from "@/services/activityLogService";
import {
  activateTaskTemplateSeries,
  createManualTaskFromTemplate,
  createTaskTemplate,
  disableTaskTemplate,
  updateTaskTemplate,
} from "@/services/taskTemplateService";

import type {
  ActivateTaskTemplateSeriesInput,
  CreateTaskFromTemplateInput,
  ManualTaskTemplateSnapshot,
  RecurringTaskSnapshot,
  TaskTemplate,
  TaskTemplateInput,
  UpdateTaskTemplateInput,
} from "@/types/taskTemplate";

function refreshTaskTemplatePages(
  task?: {
    object_id: number | null;
    equipment_id: number | null;
  }
) {
  revalidatePath("/");
  revalidatePath("/task");
  revalidatePath("/calendar");
  revalidatePath("/employees");
  revalidatePath("/objects");
  revalidatePath("/equipment");
  revalidatePath("/notifications");

  if (task?.object_id) {
    revalidatePath(
      `/objects/${task.object_id}`
    );
  }
}

function getTemplateObjectId(
  template: TaskTemplate
) {
  return template.target_type ===
    "object"
    ? template.object_id
    : null;
}

function getTargetMetadata(
  task:
    | RecurringTaskSnapshot
    | ManualTaskTemplateSnapshot
) {
  if (task.object_id) {
    return {
      objectId: task.object_id,
      targetType: "object",
      targetId: task.object_id,
    } as const;
  }

  return {
    objectId: null,
    targetType: "equipment",
    targetId: task.equipment_id,
  } as const;
}

async function recordCreatedTask(
  task:
    | RecurringTaskSnapshot
    | ManualTaskTemplateSnapshot,
  recurrenceType?: string
) {
  const target =
    getTargetMetadata(task);

  await recordActivity({
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    entityName: task.title,
    objectId: target.objectId,
    description: `Створено завдання «${task.title}» із шаблону.`,
    metadata: {
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      target_type: target.targetType,
      target_id: target.targetId,
      task_template_id:
        task.task_template_id,
      recurrence_sequence:
        task.recurrence_sequence,
      recurrence_type:
        recurrenceType ?? null,
    },
  });
}

export async function createTaskTemplateAction(
  input: TaskTemplateInput
) {
  const result =
    await createTaskTemplate(input);

  await recordActivity({
    action: "task_template.created",
    entityType: "task",
    entityId: result.template.id,
    entityName: result.template.title,
    objectId: getTemplateObjectId(
      result.template
    ),
    description: result.template.is_active
      ? `Створено серію завдань «${result.template.title}».`
      : `Створено шаблон завдання «${result.template.title}».`,
    metadata: {
      recurrence_type:
        result.template.recurrence_type,
      recurrence_interval:
        result.template.recurrence_interval,
      anchor_due_date:
        result.template.anchor_due_date,
      target_type:
        result.template.target_type,
      target_id:
        result.template.object_id ??
        result.template.equipment_id,
      is_active:
        result.template.is_active,
    },
  });

  if (result.first_task) {
    await recordCreatedTask(
      result.first_task,
      result.template.recurrence_type
    );
  }

  refreshTaskTemplatePages(
    result.first_task ?? undefined
  );
  return result;
}

export async function updateTaskTemplateAction(
  input: UpdateTaskTemplateInput
) {
  const result =
    await updateTaskTemplate(input);

  await recordActivity({
    action: "task_template.updated",
    entityType: "task",
    entityId: result.template.id,
    entityName: result.template.title,
    objectId: getTemplateObjectId(
      result.template
    ),
    description: `Оновлено шаблон завдання «${result.template.title}».`,
    metadata: {
      recurrence_type:
        result.template.recurrence_type,
      recurrence_interval:
        result.template.recurrence_interval,
      anchor_due_date:
        result.template.anchor_due_date,
      target_type:
        result.template.target_type,
      target_id:
        result.template.object_id ??
        result.template.equipment_id,
      is_active:
        result.template.is_active,
    },
  });

  refreshTaskTemplatePages(
    result.first_task ?? undefined
  );
  return result;
}

export async function activateTaskTemplateSeriesAction(
  input: ActivateTaskTemplateSeriesInput
) {
  const result =
    await activateTaskTemplateSeries(
      input
    );

  if (!result.reused_existing_series) {
    await recordActivity({
      action: "task_template.created",
      entityType: "task",
      entityId: result.template.id,
      entityName: result.template.title,
      objectId: getTemplateObjectId(
        result.template
      ),
      description: `Створено серію завдань «${result.template.title}» із шаблону.`,
      metadata: {
        source_template_id:
          result.template.source_template_id,
        recurrence_type:
          result.template.recurrence_type,
        recurrence_interval:
          result.template.recurrence_interval,
        anchor_due_date:
          result.template.anchor_due_date,
        target_type:
          result.template.target_type,
        target_id:
          result.template.object_id ??
          result.template.equipment_id,
        is_active: true,
      },
    });

    if (result.first_task) {
      await recordCreatedTask(
        result.first_task,
        result.template.recurrence_type
      );
    }
  }

  refreshTaskTemplatePages(
    result.first_task ?? undefined
  );
  return result;
}

export async function disableTaskTemplateAction(
  templateId: number
) {
  const result =
    await disableTaskTemplate(
      templateId
    );

  await recordActivity({
    action: "task_template.disabled",
    entityType: "task",
    entityId: result.template.id,
    entityName: result.template.title,
    objectId: getTemplateObjectId(
      result.template
    ),
    description: `Вимкнено серію завдань «${result.template.title}». Поточне завдання залишено без змін.`,
    metadata: {
      recurrence_type:
        result.template.recurrence_type,
      target_type:
        result.template.target_type,
      target_id:
        result.template.object_id ??
        result.template.equipment_id,
      is_active: false,
    },
  });

  refreshTaskTemplatePages(
    result.first_task ?? undefined
  );
  return result;
}

export async function createTaskFromTemplateAction(
  input: CreateTaskFromTemplateInput
) {
  const task =
    await createManualTaskFromTemplate(
      input
    );

  await recordCreatedTask(task);
  refreshTaskTemplatePages(task);
  return task;
}
