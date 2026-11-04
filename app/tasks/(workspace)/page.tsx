import TaskWorkspaceResults from "@/components/tasks/TaskWorkspaceResults";
import { canManageTasks } from "@/lib/auth/permissions";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { getKyivDateValue } from "@/lib/kyivDate";
import { normalizeTaskWorkspace, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import { getEmployees } from "@/services/employeeService";
import { getTaskTemplateSummaries } from "@/services/taskTemplateWorkspaceService";
import { getTaskWorkspaceResults } from "@/services/taskWorkspaceService";

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskWorkspaceQuery> }) {
  const [profile, query] = await Promise.all([
    requireSectionAccess("tasks"),
    searchParams,
  ]);
  const { filters, page: requestedPage } = normalizeTaskWorkspace(query);
  if (filters.assignee && filters.assignee !== "unassigned") {
    const employees = await getEmployees();
    if (!employees.some((employee) => String(employee.id) === filters.assignee)) filters.assignee = "";
  }
  const today = getKyivDateValue();
  const result = await getTaskWorkspaceResults(filters, requestedPage, profile.employee_id, today);
  const templates = canManageTasks(profile.role)
    ? await getTaskTemplateSummaries(result.tasks.flatMap((task) => task.task_template_id === null ? [] : [task.task_template_id]))
    : [];

  return <TaskWorkspaceResults filters={filters} templates={templates} {...result} />;
}
