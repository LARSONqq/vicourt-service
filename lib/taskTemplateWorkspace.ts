import { taskQueryValue, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import type { TaskTemplate } from "@/types/taskTemplate";

export const templateStatuses = { all: "Усі", active: "Активні", inactive: "Неактивні" } as const;
export function normalizeTemplateQuery(query: TaskWorkspaceQuery) {
  const status = taskQueryValue(query.status);
  const page = taskQueryValue(query.page);
  return {
    q: taskQueryValue(query.q).trim().slice(0, 200),
    status: (Object.keys(templateStatuses).includes(status) ? status : "all") as keyof typeof templateStatuses,
    page: /^[1-9]\d*$/.test(page) && Number.isSafeInteger(Number(page)) ? Number(page) : 1,
  };
}
export function templateWorkspaceHref(filters: ReturnType<typeof normalizeTemplateQuery>, page = 1) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "all") params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  return `/tasks/templates${params.size ? `?${params}` : ""}`;
}
export function isBoundTemplate(template: Pick<TaskTemplate, "object_id" | "equipment_id" | "source_template_id">) {
  return template.object_id !== null || template.equipment_id !== null || template.source_template_id !== null;
}
export function templateStateLabel(template: Pick<TaskTemplate, "object_id" | "equipment_id" | "source_template_id" | "is_active">) {
  return template.is_active ? "Активна серія" : isBoundTemplate(template) ? "Зупинена серія" : "Шаблон";
}
