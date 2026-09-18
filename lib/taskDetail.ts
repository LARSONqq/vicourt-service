import { canManageEquipment, canManageObjects } from "@/lib/auth/permissions";
import type { ObjectTask } from "@/types/objectTask";
import type { UserRole } from "@/types/userProfile";

export function parseTaskDetailId(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

// Only the workspace itself, never an external URL or another application route.
export function safeTaskReturnTo(value: string | undefined) {
  if (!value || /[\\\r\n]/.test(value)) return "/tasks";
  try {
    const url = new URL(value, "https://vicourt.invalid");
    if (!value.startsWith("/tasks") || url.origin !== "https://vicourt.invalid" || url.pathname !== "/tasks") return "/tasks";
    return `/tasks${url.search}`;
  } catch { return "/tasks"; }
}

export function taskDetailHref(id: number, returnTo = "/tasks") {
  return `/tasks/${id}?${new URLSearchParams({ returnTo: safeTaskReturnTo(returnTo) })}`;
}

/** Mirrors existing active-user manual-task actions and source-specific guards. */
export function taskDetailCapabilities(task: Pick<ObjectTask, "task_source" | "task_template_id" | "status">, role: UserRole) {
  const completed = task.status === "Виконано";
  const manual = task.task_source === "manual";
  const sourceManager = task.task_source === "supervision" ? canManageObjects(role)
    : task.task_source === "equipment_maintenance" ? canManageEquipment(role) : false;
  const protectedHistory = completed && (!manual || task.task_template_id !== null);
  return {
    edit: manual && !protectedHistory,
    status: manual && !protectedHistory,
    complete: !completed && (manual || sourceManager),
    dueDate: !protectedHistory && (manual || sourceManager),
  };
}

const safeMessages = new Set([
  "Потрібно увійти в систему.", "Завдання не знайдено.",
  "Недостатньо прав для цієї дії.", "Введи назву завдання.",
  "Дата завдання має неправильний формат.", "Вказано неправильну дату завдання.",
  "Вибрано неправильний статус завдання.", "Вибрано неправильний пріоритет завдання.",
  "Неправильно вибраний працівник.", "Вибраного працівника не знайдено.",
  "Спочатку збережи зміни повторюваного завдання, а потім познач його виконаним окремою дією.",
  "Введи назву пункту чекліста.", "Назва пункту не може бути довшою за 250 символів.",
  "Пункт чекліста не знайдено.", "Автоматичне завдання повинно мати дату.",
  "Спочатку налаштуйте періодичність ТО.", "Планове ТО вже відмічено виконаним сьогодні.",
]);
export function taskMutationMessage(error: unknown, fallback = "Не вдалося зберегти зміни. Перевірте дані та права доступу й спробуйте ще раз.") {
  return error instanceof Error && safeMessages.has(error.message) ? error.message : fallback;
}
