import type {
  TaskPriority,
  TaskTargetType,
} from "@/types/objectTask";

export type TaskRecurrenceType =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "custom";

export interface TaskTemplate {
  id: number;
  source_template_id: number | null;
  title: string;
  description: string | null;
  target_type: TaskTargetType;
  object_id: number | null;
  equipment_id: number | null;
  priority: TaskPriority;
  assigned_employee_id: number | null;
  assignee: string | null;
  recurrence_type: TaskRecurrenceType;
  recurrence_interval: number | null;
  anchor_due_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTaskSnapshot {
  id: number;
  object_id: number | null;
  equipment_id: number | null;
  title: string;
  description: string | null;
  due_date: string | null;
  assignee: string | null;
  assigned_employee_id: number | null;
  priority: TaskPriority;
  status: string;
  task_source: "manual";
  task_template_id: number;
  recurrence_sequence: number;
}

export type ManualTaskTemplateSnapshot = Omit<
  RecurringTaskSnapshot,
  "task_template_id" | "recurrence_sequence"
> & {
  task_template_id: null;
  recurrence_sequence: null;
};

export interface TaskTemplateMutationResult {
  template: TaskTemplate;
  first_task:
    | RecurringTaskSnapshot
    | ManualTaskTemplateSnapshot
    | null;
  reused_existing_series?: boolean;
}

export interface RecurringTaskCompletionResult {
  already_completed: boolean;
  template_id: number;
  completed_task: RecurringTaskSnapshot;
  next_task: RecurringTaskSnapshot | null;
}

export type TaskTemplateInput = {
  title: string;
  description?: string | null;
  targetType: TaskTargetType;
  objectId?: number | null;
  equipmentId?: number | null;
  priority: TaskPriority;
  assignedEmployeeId?: number | null;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval?: number | null;
  anchorDueDate?: string | null;
  isActive: boolean;
};

export type UpdateTaskTemplateInput = Omit<
  TaskTemplateInput,
  "targetType" | "objectId" | "equipmentId" | "isActive"
> & {
  templateId: number;
};

export type ActivateTaskTemplateSeriesInput = {
  templateId: number;
  targetType: TaskTargetType;
  objectId?: number | null;
  equipmentId?: number | null;
  anchorDueDate: string;
};

export type CreateTaskFromTemplateInput = {
  templateId: number;
  targetType: TaskTargetType;
  objectId?: number | null;
  equipmentId?: number | null;
  dueDate?: string | null;
  assignedEmployeeId?: number | null;
};
