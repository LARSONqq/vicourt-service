// Stored statuses and date-only values keep their existing meaning.
export const COMPLETED_TASK_STATUS = "Виконано";

export function isTaskOverdue(task: { status: string; due_date: string | null }, today: string) {
  return Boolean(task.due_date && task.due_date < today && task.status !== COMPLETED_TASK_STATUS);
}

export function getTaskStatusStyle(status: string) {
  switch (status) {
    case "Заплановано": return "bg-blue-50 text-blue-700";
    case "В роботі": return "bg-yellow-100 text-yellow-800";
    case COMPLETED_TASK_STATUS: return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export function getTaskPriorityStyle(priority: string) {
  switch (priority) {
    case "Терміновий": return "bg-red-100 text-red-700";
    case "Високий": return "bg-orange-100 text-orange-700";
    case "Середній": return "bg-violet-100 text-violet-700";
    default: return "bg-gray-100 text-gray-600";
  }
}
