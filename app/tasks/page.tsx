import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import Link from "next/link";
import TasksList from "@/components/tasks/TasksList";
import TaskWorkspaceNavigation, { TaskWorkspacePagination } from "@/components/tasks/TaskWorkspaceNavigation";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canManageEquipment, canManageObjects, canManageTasks } from "@/lib/auth/permissions";
import { getKyivDateValue } from "@/lib/kyivDate";
import { normalizeTaskWorkspace, taskWorkspaceHref, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import { getEmployees } from "@/services/employeeService";
import { getEquipment } from "@/services/equipmentService";
import { getObjects } from "@/services/objectService";
import { getTaskTemplateSummaries } from "@/services/taskTemplateWorkspaceService";
import { getTaskWorkspacePage } from "@/services/taskWorkspaceService";

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskWorkspaceQuery> }) {
  const profile = await requireSectionAccess("tasks");
  const { filters, page } = normalizeTaskWorkspace(await searchParams);
  const today = getKyivDateValue();
  const recurrence = canManageTasks(profile.role);
  // These existing operational selectors also support the existing worker manual-task flow.
  // No employee rates, equipment costs or management-only template data for workers.
  const [objects, employees, equipment] = await Promise.all([
    getObjects(), getEmployees(), getEquipment(),
  ]);
  if (filters.assignee && filters.assignee !== "unassigned" && !employees.some((employee) => String(employee.id) === filters.assignee)) filters.assignee = "";
  const result = await getTaskWorkspacePage(filters, page, profile.employee_id, today);
  const templates = recurrence ? await getTaskTemplateSummaries(result.tasks.flatMap((task) => task.task_template_id === null ? [] : [task.task_template_id])) : [];
  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <header>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Завдання</h1>
      <p className="mt-1 text-sm text-gray-500">Робочий простір команди · {today.split("-").reverse().join(".")} · Київ</p>
      {recurrence && <Link href="/tasks/templates" className="mt-3 inline-block rounded-lg border bg-white px-4 py-3 text-sm font-medium text-green-700">Шаблони та повторення →</Link>}
    </header>
    <AddGlobalTaskForm objects={objects} equipment={equipment} employees={employees} canManageRecurrence={recurrence} />
    <TaskWorkspaceNavigation filters={filters} counts={result.counts} employees={employees} />
    {filters.view === "my" && profile.employee_id === null && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Ваш профіль не прив’язаний до працівника. Для виду «Мої» попросіть адміністратора налаштувати цей зв’язок. Інші види залишаються доступними.</p>}
    <TaskWorkspacePagination filters={filters} {...result} />
    <TasksList workspaceReturnTo={taskWorkspaceHref(filters, result.page)} serverPaged businessDate={today} tasks={result.tasks} employees={employees} objects={objects} equipment={equipment}
      canManageSupervision={canManageObjects(profile.role)} canManageEquipment={canManageEquipment(profile.role)} canManageRecurrence={recurrence} taskTemplates={templates} />
    {result.pageCount > 1 && <TaskWorkspacePagination filters={filters} {...result} />}
  </div>;
}
