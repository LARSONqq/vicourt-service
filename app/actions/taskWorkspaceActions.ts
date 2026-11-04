"use server";

import { canManageTasks } from "@/lib/auth/permissions";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { getKyivDateValue } from "@/lib/kyivDate";
import { normalizeTaskWorkspace, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import { getEmployees } from "@/services/employeeService";
import { getTaskTemplateSummaries } from "@/services/taskTemplateWorkspaceService";
import { getTaskWorkspaceResults } from "@/services/taskWorkspaceService";

export async function loadTaskWorkspaceAction(query: TaskWorkspaceQuery) {
  const profile = await requireSectionAccess("tasks");
  const { filters, page: requestedPage } = normalizeTaskWorkspace(query);

  if (filters.assignee && filters.assignee !== "unassigned") {
    const employees = await getEmployees();
    if (!employees.some((employee) => String(employee.id) === filters.assignee)) {
      filters.assignee = "";
    }
  }

  const today = getKyivDateValue();
  const result = await getTaskWorkspaceResults(
    filters,
    requestedPage,
    profile.employee_id,
    today
  );
  const templates = canManageTasks(profile.role)
    ? await getTaskTemplateSummaries(
        result.tasks.flatMap((task) =>
          task.task_template_id === null ? [] : [task.task_template_id]
        )
      )
    : [];

  return { filters, result, templates, today };
}
