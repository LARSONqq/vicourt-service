"use server";

import {
  updateTaskDueDate,
  updateTaskStatus,
} from "@/app/actions/taskActions";

export async function completeDashboardTask(taskId: number) {
  return updateTaskStatus(taskId, "Виконано");
}

export async function rescheduleDashboardTask(
  taskId: number,
  dueDate: string
) {
  const result = await updateTaskDueDate(taskId, dueDate);

  if (!result.dueDate) {
    throw new Error("Не вдалося зберегти нову дату завдання.");
  }

  return {
    id: result.id,
    dueDate: result.dueDate,
  };
}
