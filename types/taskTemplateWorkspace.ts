import type { TaskTemplate } from "@/types/taskTemplate";

export type TaskTemplateView = Omit<TaskTemplate, "created_by"> & {
  object: { id: number; name: string } | null;
  equipment: { id: number; name: string } | null;
  employee: { id: number; first_name: string; last_name: string } | null;
};
export type TemplateLookupKind = "employee" | "object" | "equipment";
export type TemplateOption = { id: number; label: string };
