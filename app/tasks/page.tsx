import TaskWorkspaceShell from "@/components/tasks/TaskWorkspaceShell";
import { canManageEquipment, canManageObjects, canManageTasks } from "@/lib/auth/permissions";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { getKyivDateValue } from "@/lib/kyivDate";
import { normalizeTaskWorkspace, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import { getEmployees } from "@/services/employeeService";
import { getEquipment } from "@/services/equipmentService";
import { getObjects } from "@/services/objectService";
import { getTaskTemplateSummaries } from "@/services/taskTemplateWorkspaceService";
import { getTaskWorkspaceCounts, getTaskWorkspaceResults } from "@/services/taskWorkspaceService";

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskWorkspaceQuery> }) {
  const [profile, query] = await Promise.all([
    requireSectionAccess("tasks"),
    searchParams,
  ]);
  const { filters, page: requestedPage } = normalizeTaskWorkspace(query);
  const today = getKyivDateValue();
  // These operational selectors contain no rates/costs and preserve the worker task flow.
  const [objects, employees, equipment, counts] = await Promise.all([
    getObjects(),
    getEmployees(),
    getEquipment(),
    getTaskWorkspaceCounts(profile.employee_id, today),
  ]);
  if (
    filters.assignee &&
    filters.assignee !== "unassigned" &&
    !employees.some((employee) => String(employee.id) === filters.assignee)
  ) {
    filters.assignee = "";
  }
  const result = await getTaskWorkspaceResults(
    filters,
    requestedPage,
    profile.employee_id,
    today
  );
  const canManageRecurrence = canManageTasks(profile.role);
  const templates = canManageRecurrence
    ? await getTaskTemplateSummaries(
        result.tasks.flatMap((task) =>
          task.task_template_id === null ? [] : [task.task_template_id]
        )
      )
    : [];
  const workspaceVersion = JSON.stringify([
    filters,
    result,
    templates,
    today,
    counts,
  ]);

  return <TaskWorkspaceShell
    key={workspaceVersion}
    initialFilters={filters}
    initialResult={result}
    initialTemplates={templates}
    initialToday={today}
    counts={counts}
    employeeId={profile.employee_id}
    objects={objects}
    employees={employees}
    equipment={equipment}
    canManageObjects={canManageObjects(profile.role)}
    canManageEquipment={canManageEquipment(profile.role)}
    canManageRecurrence={canManageRecurrence}
  />;
}
