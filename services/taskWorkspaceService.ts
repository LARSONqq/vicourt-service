import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TASK_WORKSPACE_PAGE_SIZE, taskSearchOperand, taskViews, type TaskView, type TaskWorkspaceFilters } from "@/lib/taskWorkspace";
import { TASK_LIST_SELECT } from "@/services/taskService";
import type { TaskWithObject } from "@/types/taskWithObject";
import { COMPLETED_TASK_STATUS } from "@/lib/taskPresentation";
import { getCurrentUserProfile } from "@/services/profileService";
import { canAccessSection } from "@/lib/auth/permissions";
import { getKyivDateValue } from "@/lib/kyivDate";

function taskQuery(supabase: Awaited<ReturnType<typeof createClient>>, head = false) {
  return supabase.from("object_tasks").select(head ? "id" : TASK_LIST_SELECT, head ? { count: "exact", head: true } : undefined);
}

// Shared by workspace and future Dashboard. "Мої" includes all statuses in
// the workspace; Dashboard explicitly asks for myOpen below.
function applyTaskView(query: ReturnType<typeof taskQuery>, view: TaskView, employeeId: number | null, today: string) {
  if (view === "my") return employeeId === null
    ? query.is("assigned_employee_id", null).not("assigned_employee_id", "is", null)
    : query.eq("assigned_employee_id", employeeId);
  if (view === "completed") return query.eq("status", COMPLETED_TASK_STATUS);
  if (view === "today") return query.neq("status", COMPLETED_TASK_STATUS).eq("due_date", today);
  if (view === "overdue") return query.neq("status", COMPLETED_TASK_STATUS).lt("due_date", today);
  if (view === "upcoming") return query.neq("status", COMPLETED_TASK_STATUS).gt("due_date", today);
  return query;
}

/** Exact, RLS-scoped operational counts; no task rows or selector/finance data.
 * Derive identity and Kyiv date on the server, never accept a caller's employee ID.
 * Does not replace the current home Dashboard UI/data flow in this phase.
 */
export async function getTaskDashboardSummary() {
  const profile = await getCurrentUserProfile();
  if (!profile || !canAccessSection(profile.role, "tasks")) throw new Error("Недостатньо прав для перегляду завдань.");
  const businessDate = getKyivDateValue();
  const supabase = await createClient();
  const count = (view: TaskView) => applyTaskView(taskQuery(supabase, true), view, profile.employee_id, businessDate);
  const [today, overdue, myOpen, open] = await Promise.all([
    count("today"), count("overdue"),
    profile.employee_id === null ? Promise.resolve({ count: 0, error: null }) : count("my").neq("status", COMPLETED_TASK_STATUS),
    count("all").neq("status", COMPLETED_TASK_STATUS),
  ]);
  if ([today, overdue, myOpen, open].some((result) => result.error)) throw new Error("Не вдалося завантажити підсумок завдань.");
  return { businessDate, hasEmployeeLink: profile.employee_id !== null,
    today: today.count ?? 0, overdue: overdue.count ?? 0, myOpen: myOpen.count ?? 0, open: open.count ?? 0 };
}

// All filters/counts/ranges run under the request user's existing RLS, never service_role.
export async function getTaskWorkspacePage(filters: TaskWorkspaceFilters, requestedPage: number, employeeId: number | null, today: string) {
  const supabase = await createClient();
  const base = (head = false) => taskQuery(supabase, head);
  const viewQuery = (query: ReturnType<typeof base>, view: TaskView) => applyTaskView(query, view, employeeId, today);
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

  const hasFilters = Object.entries(filters).some(([key, value]) => key !== "view" && Boolean(value));
  const views = Object.keys(taskViews) as TaskView[];
  const [filteredCount, ...viewResults] = await Promise.all([
    hasFilters ? filtered(true) : Promise.resolve(null),
    ...views.map((view) => view === "my" && employeeId === null ? Promise.resolve({ count: 0, error: null }) : viewQuery(base(true), view)),
  ]);
  const countResult = filteredCount ?? viewResults[views.indexOf(filters.view)];
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
