import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TASK_WORKSPACE_PAGE_SIZE, taskSearchOperand, taskViews, type TaskView, type TaskWorkspaceFilters } from "@/lib/taskWorkspace";
import { TASK_LIST_SELECT } from "@/services/taskService";
import type { TaskWithObject } from "@/types/taskWithObject";

// All filters/counts/ranges run under the request user's existing RLS, never service_role.
export async function getTaskWorkspacePage(filters: TaskWorkspaceFilters, requestedPage: number, employeeId: number | null, today: string) {
  const supabase = await createClient();
  const base = (head = false) => supabase.from("object_tasks")
    .select(head ? "id" : TASK_LIST_SELECT, { count: "exact", head });
  const viewQuery = (query: ReturnType<typeof base>, view: TaskView) => {
    if (view === "my") {
      // No guessed employee ID: an unlinked profile must match no rows.
      return employeeId === null
        ? query.is("assigned_employee_id", null).not("assigned_employee_id", "is", null)
        : query.eq("assigned_employee_id", employeeId);
    }
    if (view === "completed") return query.eq("status", "Виконано");
    if (view === "today") return query.neq("status", "Виконано").eq("due_date", today);
    if (view === "overdue") return query.neq("status", "Виконано").lt("due_date", today);
    if (view === "upcoming") return query.neq("status", "Виконано").gt("due_date", today);
    return query;
  };
  const filtered = (head = false) => {
    let query = viewQuery(base(head), filters.view);
    if (filters.q) {
      const term = taskSearchOperand(filters.q);
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    if (filters.assignee === "unassigned") query = query.is("assigned_employee_id", null);
    else if (filters.assignee) query = query.eq("assigned_employee_id", Number(filters.assignee));
    if (filters.target) query = query.not(`${filters.target}_id`, "is", null);
    if (filters.source) query = query.eq("task_source", filters.source);
    if (filters.recurrence === "once") query = query.is("task_template_id", null);
    if (filters.recurrence === "recurring") query = query.not("task_template_id", "is", null);
    return query;
  };

  const [countResult, ...viewResults] = await Promise.all([
    filtered(true),
    ...Object.keys(taskViews).map((view) => viewQuery(base(true), view as TaskView)),
  ]);
  if (countResult.error || viewResults.some((result) => result.error)) {
    throw new Error("Не вдалося завантажити завдання. Спробуйте ще раз.");
  }
  const total = countResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / TASK_WORKSPACE_PAGE_SIZE));
  const page = Math.min(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, pageCount);
  const from = (page - 1) * TASK_WORKSPACE_PAGE_SIZE;
  const { data, error } = await filtered()
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, from + TASK_WORKSPACE_PAGE_SIZE - 1)
    .overrideTypes<TaskWithObject[], { merge: false }>();
  if (error) throw new Error("Не вдалося завантажити завдання. Спробуйте ще раз.");
  const counts = Object.fromEntries(Object.keys(taskViews).map((view, index) => [view, viewResults[index].count ?? 0])) as Record<TaskView, number>;
  return { tasks: data ?? [], page, pageCount, total, counts };
}
