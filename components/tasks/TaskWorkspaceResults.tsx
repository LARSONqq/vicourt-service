"use client";

import TasksList from "@/components/tasks/TasksList";
import { TaskWorkspacePagination } from "@/components/tasks/TaskWorkspaceNavigation";
import { useTaskWorkspace } from "@/components/tasks/TaskWorkspaceShell";
import { taskWorkspaceEmptyMessage, taskWorkspaceHref, type TaskWorkspaceFilters } from "@/lib/taskWorkspace";

import type { TaskWithObject } from "@/types/taskWithObject";
import type { TaskTemplate } from "@/types/taskTemplate";

type Props = {
  filters: TaskWorkspaceFilters;
  tasks: TaskWithObject[];
  page: number;
  pageCount: number;
  total: number;
  templates: Pick<TaskTemplate, "id" | "recurrence_type" | "recurrence_interval">[];
};

export default function TaskWorkspaceResults({ filters, tasks, page, pageCount, total, templates }: Props) {
  const workspace = useTaskWorkspace();
  const pagination = { page, pageCount, total };

  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <TaskWorkspacePagination filters={filters} {...pagination} />
    <TasksList
      emptyMessage={taskWorkspaceEmptyMessage(filters)}
      workspaceReturnTo={taskWorkspaceHref(filters, page)}
      serverPaged
      businessDate={workspace.today}
      tasks={tasks}
      employees={workspace.employees}
      objects={workspace.objects}
      equipment={workspace.equipment}
      canManageSupervision={workspace.canManageObjects}
      canManageEquipment={workspace.canManageEquipment}
      canManageRecurrence={workspace.canManageRecurrence}
      taskTemplates={templates}
    />
    {pageCount > 1 && <TaskWorkspacePagination filters={filters} {...pagination} />}
  </div>;
}
