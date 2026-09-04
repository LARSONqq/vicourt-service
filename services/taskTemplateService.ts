import "server-only";

import {
  canManageTasks,
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
  TaskPriority,
  TaskTargetType,
} from "@/types/objectTask";
import type {
  ActivateTaskTemplateSeriesInput,
  CreateTaskFromTemplateInput,
  ManualTaskTemplateSnapshot,
  RecurringTaskCompletionResult,
  RecurringTaskSnapshot,
  TaskRecurrenceType,
  TaskTemplate,
  TaskTemplateInput,
  TaskTemplateMutationResult,
  UpdateTaskTemplateInput,
} from "@/types/taskTemplate";

const TASK_TEMPLATE_SELECT = `
  id,
  source_template_id,
  title,
  description,
  target_type,
  object_id,
  equipment_id,
  priority,
  assigned_employee_id,
  assignee,
  recurrence_type,
  recurrence_interval,
  anchor_due_date,
  is_active,
  created_by,
  created_at,
  updated_at
`;

const priorities: TaskPriority[] = [
  "Низький",
  "Середній",
  "Високий",
  "Терміновий",
];

const recurrenceTypes: TaskRecurrenceType[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "custom",
];

function isRecord(
  value: unknown
): value is Record<string, unknown> {
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

function isNullableString(
  value: unknown
): value is string | null {
  return (
    typeof value === "string" ||
    value === null
  );
}

function isTaskTemplate(
  value: unknown
): value is TaskTemplate {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    isNullableNumber(
      value.source_template_id
    ) &&
    typeof value.title === "string" &&
    isNullableString(
      value.description
    ) &&
    (value.target_type === "object" ||
      value.target_type === "equipment") &&
    isNullableNumber(value.object_id) &&
    isNullableNumber(value.equipment_id) &&
    priorities.includes(
      value.priority as TaskPriority
    ) &&
    isNullableNumber(
      value.assigned_employee_id
    ) &&
    isNullableString(value.assignee) &&
    recurrenceTypes.includes(
      value.recurrence_type as TaskRecurrenceType
    ) &&
    isNullableNumber(
      value.recurrence_interval
    ) &&
    isNullableString(
      value.anchor_due_date
    ) &&
    typeof value.is_active === "boolean" &&
    isNullableString(value.created_by) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isRecurringTaskSnapshot(
  value: unknown
): value is RecurringTaskSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    isNullableNumber(value.object_id) &&
    isNullableNumber(value.equipment_id) &&
    typeof value.title === "string" &&
    isNullableString(value.description) &&
    isNullableString(value.due_date) &&
    isNullableString(value.assignee) &&
    isNullableNumber(
      value.assigned_employee_id
    ) &&
    priorities.includes(
      value.priority as TaskPriority
    ) &&
    typeof value.status === "string" &&
    value.task_source === "manual" &&
    typeof value.task_template_id ===
      "number" &&
    typeof value.recurrence_sequence ===
      "number"
  );
}

function isManualTaskTemplateSnapshot(
  value: unknown
): value is ManualTaskTemplateSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    isNullableNumber(value.object_id) &&
    isNullableNumber(value.equipment_id) &&
    typeof value.title === "string" &&
    isNullableString(value.description) &&
    isNullableString(value.due_date) &&
    isNullableString(value.assignee) &&
    isNullableNumber(
      value.assigned_employee_id
    ) &&
    priorities.includes(
      value.priority as TaskPriority
    ) &&
    typeof value.status === "string" &&
    value.task_source === "manual" &&
    value.task_template_id === null &&
    value.recurrence_sequence === null
  );
}

function isTemplateMutationResult(
  value: unknown
): value is TaskTemplateMutationResult {
  return (
    isRecord(value) &&
    isTaskTemplate(value.template) &&
    (value.first_task === null ||
      isRecurringTaskSnapshot(
        value.first_task
      ) ||
      isManualTaskTemplateSnapshot(
        value.first_task
      )) &&
    (value.reused_existing_series ===
      undefined ||
      typeof value.reused_existing_series ===
        "boolean")
  );
}

function isCompletionResult(
  value: unknown
): value is RecurringTaskCompletionResult {
  return (
    isRecord(value) &&
    typeof value.already_completed ===
      "boolean" &&
    typeof value.template_id === "number" &&
    isRecurringTaskSnapshot(
      value.completed_task
    ) &&
    (value.next_task === null ||
      isRecurringTaskSnapshot(
        value.next_task
      ))
  );
}

function validatePositiveId(
  value: number,
  message: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(message);
  }
}

function normalizeOptionalId(
  value: number | null | undefined,
  message: string
) {
  if (value === null || value === undefined) {
    return null;
  }

  validatePositiveId(value, message);
  return value;
}

function validateTarget(input: {
  targetType: TaskTargetType;
  objectId?: number | null;
  equipmentId?: number | null;
}, requireTarget: boolean) {
  const objectId = normalizeOptionalId(
    input.objectId,
    "Некоректний об’єкт шаблону."
  );
  const equipmentId = normalizeOptionalId(
    input.equipmentId,
    "Некоректна техніка шаблону."
  );

  if (
    input.targetType !== "object" &&
    input.targetType !== "equipment"
  ) {
    throw new Error(
      "Некоректний тип цілі шаблону."
    );
  }

  if (
    (input.targetType === "object" &&
      equipmentId !== null) ||
    (input.targetType === "equipment" &&
      objectId !== null)
  ) {
    throw new Error(
      "Шаблон може бути пов’язаний лише з одним типом цілі."
    );
  }

  const targetId =
    input.targetType === "object"
      ? objectId
      : equipmentId;

  if (requireTarget && targetId === null) {
    throw new Error(
      "Для серії потрібно вибрати об’єкт або техніку."
    );
  }

  return { objectId, equipmentId };
}

function validateTemplateFields(input: {
  title: string;
  description?: string | null;
  priority: TaskPriority;
  assignedEmployeeId?: number | null;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval?: number | null;
  anchorDueDate?: string | null;
  isActive: boolean;
}) {
  const title = input.title.trim();
  const description =
    input.description?.trim() || null;
  const assignedEmployeeId =
    normalizeOptionalId(
      input.assignedEmployeeId,
      "Некоректний відповідальний працівник."
    );
  const anchorDueDate =
    input.anchorDueDate?.trim() || null;

  if (!title || title.length > 300) {
    throw new Error(
      "Назва шаблону повинна містити від 1 до 300 символів."
    );
  }
  if (
    description &&
    description.length > 4000
  ) {
    throw new Error(
      "Опис шаблону не може перевищувати 4000 символів."
    );
  }
  if (!priorities.includes(input.priority)) {
    throw new Error(
      "Некоректний пріоритет шаблону."
    );
  }
  if (
    !recurrenceTypes.includes(
      input.recurrenceType
    )
  ) {
    throw new Error(
      "Некоректна періодичність шаблону."
    );
  }

  const recurrenceInterval =
    input.recurrenceInterval ?? null;

  if (
    input.recurrenceType === "custom"
  ) {
    if (
      !Number.isInteger(
        recurrenceInterval
      ) ||
      (recurrenceInterval ?? 0) <= 0
    ) {
      throw new Error(
        "Для власного інтервалу вкажи додатну кількість днів."
      );
    }
  } else if (
    input.recurrenceType === "none"
  ) {
    if (recurrenceInterval !== null) {
      throw new Error(
        "Неповторюваний шаблон не повинен мати інтервал."
      );
    }
  } else if (
    recurrenceInterval !== 1
  ) {
    throw new Error(
      "Стандартна періодичність повинна мати інтервал 1."
    );
  }

  if (
    anchorDueDate &&
    !isValidDateValue(anchorDueDate)
  ) {
    throw new Error(
      "Некоректна опорна дата повторення."
    );
  }
  if (
    input.isActive &&
    (input.recurrenceType === "none" ||
      !anchorDueDate)
  ) {
    throw new Error(
      "Активна серія повинна мати періодичність та опорну дату."
    );
  }

  return {
    title,
    description,
    assignedEmployeeId,
    recurrenceInterval,
    anchorDueDate,
  };
}

async function requireTemplateManagement() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }
  if (!canManageTasks(profile.role)) {
    throw new Error(
      "Шаблонами завдань можуть керувати лише адміністратор або керівник об’єкта."
    );
  }

  return profile;
}

async function requireTaskCompletionAccess() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }

  return profile;
}

export async function getTaskTemplates(): Promise<
  TaskTemplate[]
> {
  await requireTemplateManagement();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_templates")
    .select(TASK_TEMPLATE_SELECT)
    .order("updated_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .overrideTypes<TaskTemplate[]>();

  if (error) {
    throw new Error(
      `Не вдалося завантажити шаблони завдань: ${error.message}`
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function createTaskTemplate(
  input: TaskTemplateInput
): Promise<TaskTemplateMutationResult> {
  await requireTemplateManagement();
  const fields = validateTemplateFields(
    input
  );
  const target = validateTarget(
    input,
    input.isActive
  );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_task_template",
    {
      p_title: fields.title,
      p_description: fields.description,
      p_target_type: input.targetType,
      p_object_id: target.objectId,
      p_equipment_id: target.equipmentId,
      p_priority: input.priority,
      p_assigned_employee_id:
        fields.assignedEmployeeId,
      p_recurrence_type:
        input.recurrenceType,
      p_recurrence_interval:
        fields.recurrenceInterval,
      p_anchor_due_date:
        fields.anchorDueDate,
      p_is_active: input.isActive,
    }
  );

  if (error) {
    throw new Error(
      `Не вдалося створити шаблон завдання: ${error.message}`
    );
  }
  if (!isTemplateMutationResult(data)) {
    throw new Error(
      "Система отримала некоректний результат створення шаблону."
    );
  }

  return data;
}

export async function updateTaskTemplate(
  input: UpdateTaskTemplateInput
): Promise<TaskTemplateMutationResult> {
  await requireTemplateManagement();
  validatePositiveId(
    input.templateId,
    "Не вдалося визначити шаблон."
  );
  const fields = validateTemplateFields({
    ...input,
    isActive: false,
  });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "update_task_template",
    {
      p_template_id: input.templateId,
      p_title: fields.title,
      p_description: fields.description,
      p_priority: input.priority,
      p_assigned_employee_id:
        fields.assignedEmployeeId,
      p_recurrence_type:
        input.recurrenceType,
      p_recurrence_interval:
        fields.recurrenceInterval,
      p_anchor_due_date:
        fields.anchorDueDate,
    }
  );

  if (error) {
    throw new Error(
      `Не вдалося оновити шаблон завдання: ${error.message}`
    );
  }
  if (!isTemplateMutationResult(data)) {
    throw new Error(
      "Система отримала некоректний результат оновлення шаблону."
    );
  }

  return data;
}

export async function activateTaskTemplateSeries(
  input: ActivateTaskTemplateSeriesInput
): Promise<TaskTemplateMutationResult> {
  await requireTemplateManagement();
  validatePositiveId(
    input.templateId,
    "Не вдалося визначити шаблон."
  );
  if (!isValidDateValue(input.anchorDueDate)) {
    throw new Error(
      "Некоректна опорна дата серії."
    );
  }
  const target = validateTarget(input, true);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "activate_task_template_series",
    {
      p_template_id: input.templateId,
      p_target_type: input.targetType,
      p_object_id: target.objectId,
      p_equipment_id: target.equipmentId,
      p_anchor_due_date:
        input.anchorDueDate,
    }
  );

  if (error) {
    throw new Error(
      `Не вдалося активувати серію завдань: ${error.message}`
    );
  }
  if (!isTemplateMutationResult(data)) {
    throw new Error(
      "Система отримала некоректний результат активації серії."
    );
  }

  return data;
}

export async function disableTaskTemplate(
  templateId: number
): Promise<TaskTemplateMutationResult> {
  await requireTemplateManagement();
  validatePositiveId(
    templateId,
    "Не вдалося визначити шаблон."
  );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "disable_task_template",
    { p_template_id: templateId }
  );

  if (error) {
    throw new Error(
      `Не вдалося вимкнути серію завдань: ${error.message}`
    );
  }
  if (!isTemplateMutationResult(data)) {
    throw new Error(
      "Система отримала некоректний результат вимкнення серії."
    );
  }

  return data;
}

export async function createManualTaskFromTemplate(
  input: CreateTaskFromTemplateInput
): Promise<ManualTaskTemplateSnapshot> {
  await requireTemplateManagement();
  validatePositiveId(
    input.templateId,
    "Не вдалося визначити шаблон."
  );
  if (
    input.dueDate &&
    !isValidDateValue(input.dueDate)
  ) {
    throw new Error(
      "Некоректна дата завдання."
    );
  }
  const target = validateTarget(input, true);
  const assignedEmployeeId =
    normalizeOptionalId(
      input.assignedEmployeeId,
      "Некоректний відповідальний працівник."
    );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_manual_task_from_template",
    {
      p_template_id: input.templateId,
      p_target_type: input.targetType,
      p_object_id: target.objectId,
      p_equipment_id: target.equipmentId,
      p_due_date: input.dueDate ?? null,
      p_assigned_employee_id:
        assignedEmployeeId,
    }
  );

  if (error) {
    throw new Error(
      `Не вдалося створити завдання із шаблону: ${error.message}`
    );
  }

  if (!isManualTaskTemplateSnapshot(data)) {
    throw new Error(
      "Система отримала некоректний результат створення завдання."
    );
  }

  return data;
}

export async function completeManualRecurringTask(
  taskId: number
): Promise<RecurringTaskCompletionResult> {
  await requireTaskCompletionAccess();
  validatePositiveId(
    taskId,
    "Не вдалося визначити повторюване завдання."
  );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "complete_manual_recurring_task",
    { p_task_id: taskId }
  );

  if (error) {
    throw new Error(
      `Не вдалося завершити повторюване завдання: ${error.message}`
    );
  }
  if (!isCompletionResult(data)) {
    throw new Error(
      "Система отримала некоректний результат завершення повторюваного завдання."
    );
  }

  return data;
}
