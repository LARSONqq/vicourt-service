import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireTemplateManagement } from "@/services/taskTemplateService";
import { normalizeTemplateQuery } from "@/lib/taskTemplateWorkspace";
import { taskSearchOperand, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import type { TaskTemplateView } from "@/types/taskTemplateWorkspace";
import type { TaskTemplate } from "@/types/taskTemplate";

const TEMPLATE_VIEW_SELECT = `id, source_template_id, title, description, target_type,
  object_id, equipment_id, priority, assigned_employee_id, assignee, recurrence_type,
  recurrence_interval, anchor_due_date, is_active, created_at, updated_at,
  object:objects!task_templates_object_fkey(id, name),
  equipment:equipment!task_templates_equipment_fkey(id, name),
  employee:employees!task_templates_employee_fkey(id, first_name, last_name)`;

export async function getTaskTemplatesPage(query: TaskWorkspaceQuery) {
  await requireTemplateManagement();
  const filters = normalizeTemplateQuery(query);
  const supabase = await createClient();
  const base = (head: boolean) => {
    let request = supabase.from("task_templates").select(head ? "id" : TEMPLATE_VIEW_SELECT, head ? { count: "exact", head: true } : undefined);
    if (filters.q) {
      const term = taskSearchOperand(filters.q);
      request = request.or(`title.ilike.${term},description.ilike.${term}`);
    }
    if (filters.status !== "all") request = request.eq("is_active", filters.status === "active");
    return request;
  };
  const count = await base(true);
  if (count.error) throw new Error("Не вдалося завантажити шаблони.");
  const total = count.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(filters.page, pageCount);
  const { data, error } = await base(false).order("updated_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1).overrideTypes<TaskTemplateView[], { merge: false }>();
  if (error) throw new Error("Не вдалося завантажити шаблони.");
  return { templates: data ?? [], filters, page, pageCount, total };
}

export async function getTaskTemplateView(id: number) {
  await requireTemplateManagement();
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_templates").select(TEMPLATE_VIEW_SELECT).eq("id", id)
    .maybeSingle().overrideTypes<TaskTemplateView | null, { merge: false }>();
  if (error) throw new Error("Не вдалося завантажити шаблон.");
  return data;
}

export async function getTaskTemplateSummaries(ids: number[]) {
  await requireTemplateManagement();
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_templates").select("id, recurrence_type, recurrence_interval")
    .in("id", [...new Set(ids)]).overrideTypes<Pick<TaskTemplate, "id" | "recurrence_type" | "recurrence_interval">[], { merge: false }>();
  if (error) throw new Error("Не вдалося завантажити правила повторення.");
  return data ?? [];
}

export async function getTemplateOccurrencesPreview(id: number) {
  await requireTemplateManagement();
  const supabase = await createClient();
  const { data, error } = await supabase.from("object_tasks").select("id, title, status, due_date, recurrence_sequence")
    .eq("task_template_id", id).eq("task_source", "manual")
    .order("recurrence_sequence", { ascending: false }).order("id", { ascending: false }).limit(5);
  if (error) return null;
  return data as { id: number; title: string; status: string; due_date: string | null; recurrence_sequence: number }[];
}
