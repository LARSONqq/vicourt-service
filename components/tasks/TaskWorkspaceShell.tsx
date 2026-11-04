"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { loadTaskWorkspaceAction } from "@/app/actions/taskWorkspaceActions";
import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import TaskWorkspaceNavigation from "@/components/tasks/TaskWorkspaceNavigation";
import TaskWorkspaceResults from "@/components/tasks/TaskWorkspaceResults";
import { normalizeTaskWorkspace, taskWorkspaceHref, type TaskView, type TaskWorkspaceFilters, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";
import { recurringTaskCopy } from "@/lib/taskTemplateWorkspace";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";
import type { TaskTemplate } from "@/types/taskTemplate";

type TaskResult = {
  tasks: TaskWithObject[];
  page: number;
  pageCount: number;
  total: number;
};

type TaskTemplateSummary = Pick<
  TaskTemplate,
  "id" | "recurrence_type" | "recurrence_interval"
>;

type CachedWorkspace = {
  result: TaskResult;
  templates: TaskTemplateSummary[];
  today: string;
};

type Props = {
  initialFilters: TaskWorkspaceFilters;
  initialResult: TaskResult;
  initialTemplates: TaskTemplateSummary[];
  initialToday: string;
  counts: Record<TaskView, number>;
  employeeId: number | null;
  objects: ObjectItem[];
  employees: Employee[];
  equipment: Equipment[];
  canManageObjects: boolean;
  canManageEquipment: boolean;
  canManageRecurrence: boolean;
};

function workspaceQuery(filters: TaskWorkspaceFilters, page: number): TaskWorkspaceQuery {
  return {
    ...filters,
    page: page > 1 ? String(page) : undefined,
  };
}

function queryFromSearchParams(searchParams: URLSearchParams): TaskWorkspaceQuery {
  const query: TaskWorkspaceQuery = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
}

function normalizeForEmployees(
  query: TaskWorkspaceQuery,
  employees: Employee[]
) {
  const normalized = normalizeTaskWorkspace(query);
  if (
    normalized.filters.assignee &&
    normalized.filters.assignee !== "unassigned" &&
    !employees.some(
      (employee) => String(employee.id) === normalized.filters.assignee
    )
  ) {
    normalized.filters.assignee = "";
  }
  return normalized;
}

export default function TaskWorkspaceShell({
  initialFilters,
  initialResult,
  initialTemplates,
  initialToday,
  counts,
  employeeId,
  objects,
  employees,
  equipment,
  canManageObjects,
  canManageEquipment,
  canManageRecurrence,
}: Props) {
  const initialKey = taskWorkspaceHref(initialFilters, initialResult.page);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialResult.page);
  const [workspace, setWorkspace] = useState<CachedWorkspace>({
    result: initialResult,
    templates: initialTemplates,
    today: initialToday,
  });
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestId = useRef(0);
  const cache = useRef(new Map<string, CachedWorkspace>([
    [initialKey, { result: initialResult, templates: initialTemplates, today: initialToday }],
  ]));

  const openWorkspace = useCallback(async (
    nextFilters: TaskWorkspaceFilters,
    requestedPage: number,
    historyMode: "push" | "none"
  ) => {
    const normalized = normalizeForEmployees(
      workspaceQuery(nextFilters, requestedPage),
      employees
    );
    const href = taskWorkspaceHref(normalized.filters, normalized.page);
    const nextRequestId = ++requestId.current;

    if (
      historyMode === "push" &&
      href !== `${window.location.pathname}${window.location.search}`
    ) {
      window.history.pushState(null, "", href);
    }

    setFilters(normalized.filters);
    setPage(normalized.page);
    setErrorMessage("");

    const cached = cache.current.get(href);
    if (cached) {
      setWorkspace(cached);
      setPage(cached.result.page);
      setPending(false);
      return;
    }

    setPending(true);
    try {
      const loaded = await loadTaskWorkspaceAction(
        workspaceQuery(normalized.filters, normalized.page)
      );
      const nextWorkspace = {
        result: loaded.result,
        templates: loaded.templates,
        today: loaded.today,
      };
      cache.current.set(href, nextWorkspace);
      if (requestId.current !== nextRequestId) return;
      setFilters(loaded.filters);
      setPage(loaded.result.page);
      setWorkspace(nextWorkspace);
      setPending(false);
    } catch (error) {
      if (requestId.current !== nextRequestId) return;
      setPending(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося завантажити завдання. Спробуйте ще раз."
      );
    }
  }, [employees]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname !== "/tasks") return;
      const next = normalizeForEmployees(
        queryFromSearchParams(new URLSearchParams(window.location.search)),
        employees
      );
      void openWorkspace(next.filters, next.page, "none");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [employees, openWorkspace]);

  const changeFilters = (nextFilters: TaskWorkspaceFilters) => {
    void openWorkspace(nextFilters, 1, "push");
  };

  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Робочий простір команди</p>
        <h1 className="vc-page-title mt-1 break-words">Завдання</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workspace.today.split("-").reverse().join(".")} · Київ</p>
      </div>
      {canManageRecurrence && <Link href="/tasks/templates" className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-primary transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-fit">{recurringTaskCopy.title} →</Link>}
    </header>
    <AddGlobalTaskForm objects={objects} equipment={equipment} employees={employees} canManageRecurrence={canManageRecurrence} />
    <TaskWorkspaceNavigation
      filters={filters}
      counts={counts}
      employees={employees}
      onViewChange={(view) => changeFilters({ ...filters, view })}
      onFiltersChange={changeFilters}
    />
    {filters.view === "my" && employeeId === null && <p className="vc-panel-warning rounded-md border p-4 text-sm">Ваш профіль не прив’язаний до працівника. Для виду «Мої» попросіть адміністратора налаштувати цей зв’язок. Інші види залишаються доступними.</p>}
    <TaskWorkspaceResults
      filters={filters}
      result={workspace.result}
      templates={workspace.templates}
      today={workspace.today}
      employees={employees}
      objects={objects}
      equipment={equipment}
      canManageObjects={canManageObjects}
      canManageEquipment={canManageEquipment}
      canManageRecurrence={canManageRecurrence}
      pending={pending}
      errorMessage={errorMessage}
      onPageChange={(nextPage) => void openWorkspace(filters, nextPage, "push")}
      onRetry={() => void openWorkspace(filters, page, "none")}
    />
  </div>;
}
