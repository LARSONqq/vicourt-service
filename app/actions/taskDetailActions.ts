"use server";

import { revalidatePath } from "next/cache";
import { updateObjectTask, updateTaskDueDate, updateTaskStatus } from "@/app/actions/taskActions";
import { getCurrentUserProfile } from "@/services/profileService";
import { getTaskDetail } from "@/services/taskDetailService";
import { taskDetailCapabilities, taskMutationMessage } from "@/lib/taskDetail";
import { taskSearchOperand } from "@/lib/taskWorkspace";
import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/types/employee";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
type DetailMutation = { kind: "status"; status: string } | { kind: "date"; date: string };

async function context(taskId: number) {
  const profile = await getCurrentUserProfile();
  if (!profile) throw new Error("Потрібно увійти в систему.");
  if (!Number.isSafeInteger(taskId) || taskId <= 0) throw new Error("Завдання не знайдено.");
  const task = await getTaskDetail(taskId);
  if (!task) throw new Error("Завдання не знайдено.");
  return { task, capabilities: taskDetailCapabilities(task, profile.role) };
}

function failure(error: unknown): Result<never> {
  const message = taskMutationMessage(error);
  // Keep diagnostics on the server; never return SQL details through the action result.
  console.error("[Task detail] Operation failed", error);
  return { ok: false, error: message };
}

export async function mutateTaskDetail(taskId: number, input: DetailMutation): Promise<Result> {
  try {
    const { task, capabilities } = await context(taskId);
    if (input.kind === "status") {
      if (!(input.status === "Виконано" ? capabilities.complete : capabilities.status)) throw new Error("Недостатньо прав для цієї дії.");
      await updateTaskStatus(taskId, input.status);
    } else if (input.kind === "date") {
      if (!capabilities.dueDate) throw new Error("Недостатньо прав для цієї дії.");
      if (task.task_source !== "manual" && !input.date) throw new Error("Автоматичне завдання повинно мати дату.");
      await updateTaskDueDate(taskId, input.date);
    } else throw new Error("Недостатньо прав для цієї дії.");
    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, data: null };
  } catch (error) { return failure(error); }
}

export async function saveTaskDetail(formData: FormData): Promise<Result> {
  try {
    const id = Number(formData.get("task_id"));
    const { task, capabilities } = await context(id);
    if (!capabilities.edit) throw new Error("Недостатньо прав для цієї дії.");
    // Editing this occurrence must not accidentally change its target or complete it.
    // The separate status action uses the canonical source-aware completion dispatcher.
    formData.set("status", task.status);
    formData.delete("object_id");
    formData.delete("equipment_id");
    if (task.object_id !== null) formData.set("object_id", String(task.object_id));
    if (task.equipment_id !== null) formData.set("equipment_id", String(task.equipment_id));
    formData.set("assignee", !formData.get("assigned_employee_id") && task.assigned_employee_id !== null ? "" : task.assignee ?? "");
    await updateObjectTask(formData);
    return { ok: true, data: null };
  } catch (error) { return failure(error); }
}

export async function searchTaskAssignees(taskId: number, search: string, page = 1): Promise<Result<{ employees: Employee[]; page: number; hasMore: boolean }>> {
  try {
    const { capabilities } = await context(taskId);
    if (!capabilities.edit) throw new Error("Недостатньо прав для цієї дії.");
    const supabase = await createClient();
    const safePage = Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1;
    let query = supabase.from("employees").select("id, first_name, last_name, position, status");
    const term = String(search).trim().slice(0, 100);
    if (term) {
      const pattern = taskSearchOperand(term);
      query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`);
    }
    const { data, error } = await query.order("last_name").order("first_name").order("id")
      .range((safePage - 1) * 20, safePage * 20);
    if (error) throw new Error("Не вдалося завантажити працівників.");
    const rows = (data ?? []) as Employee[];
    return { ok: true, data: { employees: rows.slice(0, 20), page: safePage, hasMore: rows.length > 20 } };
  } catch (error) { return failure(error); }
}
