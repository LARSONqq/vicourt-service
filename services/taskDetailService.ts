import "server-only";
import { createClient } from "@/lib/supabase/server";
import { TASK_LIST_SELECT } from "@/services/taskService";
import type { TaskWithObject } from "@/types/taskWithObject";
import type { Employee } from "@/types/employee";

export async function getTaskDetail(taskId: number): Promise<TaskWithObject | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("object_tasks").select(TASK_LIST_SELECT)
    .eq("id", taskId).maybeSingle().overrideTypes<TaskWithObject | null, { merge: false }>();
  if (error) throw new Error("Не вдалося завантажити завдання.");
  return data;
}

export async function getTaskAssignee(employeeId: number | null): Promise<Employee | null> {
  if (employeeId === null) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees")
    .select("id, first_name, last_name, position, status").eq("id", employeeId).maybeSingle();
  if (error) throw new Error("Не вдалося завантажити відповідального.");
  return data as Employee | null;
}
