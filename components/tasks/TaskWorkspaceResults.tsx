"use client";

import TasksList from "@/components/tasks/TasksList";
import { TaskWorkspacePagination } from "@/components/tasks/TaskWorkspaceNavigation";
import { taskWorkspaceEmptyMessage, taskWorkspaceHref, type TaskWorkspaceFilters } from "@/lib/taskWorkspace";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";
import type { TaskTemplate } from "@/types/taskTemplate";

type Props = {
  filters: TaskWorkspaceFilters;
  result: {
    tasks: TaskWithObject[];
    page: number;
    pageCount: number;
    total: number;
  };
  templates: Pick<TaskTemplate, "id" | "recurrence_type" | "recurrence_interval">[];
  today: string;
  employees: Employee[];
  objects: ObjectItem[];
  equipment: Equipment[];
  canManageObjects: boolean;
  canManageEquipment: boolean;
  canManageRecurrence: boolean;
  pending: boolean;
  errorMessage: string;
  onPageChange: (page: number) => void;
  onRetry: () => void;
};

export default function TaskWorkspaceResults({
  filters,
  result,
  templates,
  today,
  employees,
  objects,
  equipment,
  canManageObjects,
  canManageEquipment,
  canManageRecurrence,
  pending,
  errorMessage,
  onPageChange,
  onRetry,
}: Props) {
  const pagination = {
    page: result.page,
    pageCount: result.pageCount,
    total: result.total,
    disabled: pending,
    onPageChange,
  };

  return <div className="min-w-0 space-y-5 sm:space-y-6" aria-busy={pending}>
    <TaskWorkspacePagination {...pagination} />
    {pending ? <div role="status" aria-label="Завантаження списку завдань" className="vc-task-panel min-w-0 animate-pulse space-y-4 motion-reduce:animate-none">
      {[1, 2, 3].map((id) => <div key={id} className="vc-surface h-36 bg-muted/70" />)}
      <span className="sr-only">Завантаження списку завдань…</span>
    </div> : errorMessage ? <div role="alert" className="vc-task-panel vc-surface space-y-3 p-4 text-sm">
      <p>{errorMessage}</p>
      <button type="button" onClick={onRetry} className="min-h-10 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">Спробувати ще раз</button>
    </div> : <TasksList
      emptyMessage={taskWorkspaceEmptyMessage(filters)}
      workspaceReturnTo={taskWorkspaceHref(filters, result.page)}
      serverPaged
      businessDate={today}
      tasks={result.tasks}
      employees={employees}
      objects={objects}
      equipment={equipment}
      canManageSupervision={canManageObjects}
      canManageEquipment={canManageEquipment}
      canManageRecurrence={canManageRecurrence}
      taskTemplates={templates}
    />}
    {!pending && !errorMessage && result.pageCount > 1 && <TaskWorkspacePagination {...pagination} />}
  </div>;
}
