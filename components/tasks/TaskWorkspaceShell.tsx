"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import TaskWorkspaceNavigation from "@/components/tasks/TaskWorkspaceNavigation";
import { normalizeTaskWorkspace, type TaskView, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import { recurringTaskCopy } from "@/lib/taskTemplateWorkspace";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import type { ObjectItem } from "@/types/object";

type WorkspaceContext = {
  objects: ObjectItem[];
  employees: Employee[];
  equipment: Equipment[];
  today: string;
  canManageObjects: boolean;
  canManageEquipment: boolean;
  canManageRecurrence: boolean;
};

type Props = WorkspaceContext & {
  children: ReactNode;
  counts: Record<TaskView, number>;
  employeeId: number | null;
};

const TaskWorkspaceContext = createContext<WorkspaceContext | null>(null);

export function useTaskWorkspace() {
  const value = useContext(TaskWorkspaceContext);
  if (!value) throw new Error("TaskWorkspaceResults must be rendered inside TaskWorkspaceShell.");
  return value;
}

export default function TaskWorkspaceShell({
  children,
  counts,
  employeeId,
  objects,
  employees,
  equipment,
  today,
  canManageObjects,
  canManageEquipment,
  canManageRecurrence,
}: Props) {
  const searchParams = useSearchParams();
  const filters = useMemo(() => {
    const query: TaskWorkspaceQuery = {};
    for (const key of new Set(searchParams.keys())) {
      const values = searchParams.getAll(key);
      query[key] = values.length > 1 ? values : values[0];
    }
    const normalized = normalizeTaskWorkspace(query).filters;
    if (
      normalized.assignee &&
      normalized.assignee !== "unassigned" &&
      !employees.some((employee) => String(employee.id) === normalized.assignee)
    ) {
      normalized.assignee = "";
    }
    return normalized;
  }, [employees, searchParams]);
  const context = useMemo(() => ({
    objects,
    employees,
    equipment,
    today,
    canManageObjects,
    canManageEquipment,
    canManageRecurrence,
  }), [objects, employees, equipment, today, canManageObjects, canManageEquipment, canManageRecurrence]);

  return <TaskWorkspaceContext.Provider value={context}>
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Робочий простір команди</p>
          <h1 className="vc-page-title mt-1 break-words">Завдання</h1>
          <p className="mt-1 text-sm text-muted-foreground">{today.split("-").reverse().join(".")} · Київ</p>
        </div>
        {canManageRecurrence && <Link href="/tasks/templates" className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-primary transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-fit">{recurringTaskCopy.title} →</Link>}
      </header>
      <AddGlobalTaskForm objects={objects} equipment={equipment} employees={employees} canManageRecurrence={canManageRecurrence} />
      <TaskWorkspaceNavigation filters={filters} counts={counts} employees={employees} />
      {filters.view === "my" && employeeId === null && <p className="vc-panel-warning rounded-md border p-4 text-sm">Ваш профіль не прив’язаний до працівника. Для виду «Мої» попросіть адміністратора налаштувати цей зв’язок. Інші види залишаються доступними.</p>}
      {children}
    </div>
  </TaskWorkspaceContext.Provider>;
}
