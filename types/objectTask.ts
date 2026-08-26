export type TaskPriority =
  | "Низький"
  | "Середній"
  | "Високий"
  | "Терміновий";

export type TaskSource =
  | "manual"
  | "supervision";

export interface ObjectTask {
  id: number;
  object_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  assignee: string | null;
  assigned_employee_id: number | null;
  priority: TaskPriority;
  status: string;
  task_source: TaskSource;
  created_at: string;
}
