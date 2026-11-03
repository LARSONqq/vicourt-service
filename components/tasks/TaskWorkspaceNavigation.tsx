import Link from "next/link";
import { taskViews, taskWorkspaceHref, workspaceTaskPriorities, workspaceTaskStatuses, TASK_WORKSPACE_PAGE_SIZE, type TaskView, type TaskWorkspaceFilters } from "@/lib/taskWorkspace";
import type { Employee } from "@/types/employee";

type Props = {
  filters: TaskWorkspaceFilters;
  counts: Record<TaskView, number>;
  employees: Employee[];
};

export default function TaskWorkspaceNavigation({ filters, counts, employees }: Props) {
  const selects = [
    { name: "status", label: "Статус", options: [["open", "Відкриті"], ...workspaceTaskStatuses.map((value) => [value, value])] },
    { name: "priority", label: "Пріоритет", options: workspaceTaskPriorities.map((value) => [value, value]) },
    { name: "assignee", label: "Відповідальний", options: [["unassigned", "Без відповідального"], ...employees.map((employee) => [String(employee.id), `${employee.last_name} ${employee.first_name}`])] },
    { name: "target", label: "Зв’язок", options: [["object", "Об’єкт"], ["equipment", "Техніка"]] },
    { name: "source", label: "Джерело", options: [["manual", "Вручну"], ["supervision", "Періодичний огляд"], ["equipment_maintenance", "Планове ТО"]] },
    { name: "recurrence", label: "Повторення", options: [["once", "Разові"], ["recurring", "Повторювані"]] },
  ];
  return <section className="vc-task-panel min-w-0 space-y-3">
    <nav aria-label="Види завдань" className="flex flex-wrap gap-2">
      {Object.entries(taskViews).map(([view, label]) => <Link key={view}
        href={taskWorkspaceHref({ ...filters, view: view as TaskView })}
        aria-current={filters.view === view ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${filters.view === view ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}>
        {label} <span className={`ml-2 rounded-md px-2 py-0.5 text-xs ${filters.view === view ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{counts[view as TaskView]}</span>
      </Link>)}
    </nav>
    <p className="text-xs text-muted-foreground">Лічильники — усі доступні завдання у відповідному виді, без додаткових фільтрів.</p>
    <form key={JSON.stringify(filters)} action="/tasks" method="get" className="vc-surface grid min-w-0 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="view" value={filters.view} />
      <label className="min-w-0 text-sm text-muted-foreground">Пошук
        <input type="search" name="q" defaultValue={filters.q} maxLength={200} placeholder="Назва або опис" className="vc-field mt-1 min-h-11 min-w-0" />
      </label>
      {selects.map(({ name, label, options }) => <label key={name} className="min-w-0 text-sm text-muted-foreground">{label}
        <select name={name} defaultValue={filters[name as keyof TaskWorkspaceFilters]} className="vc-field mt-1 min-h-11 min-w-0">
          <option value="">Усі</option>
          {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>)}
      <div className="flex flex-wrap items-end gap-3">
        <button type="submit" className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Застосувати</button>
        <Link href={`/tasks?view=${filters.view}`} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Очистити</Link>
      </div>
    </form>
  </section>;
}

export function TaskWorkspacePagination({ filters, page, pageCount, total }: { filters: TaskWorkspaceFilters; page: number; pageCount: number; total: number }) {
  return <nav aria-label="Сторінки завдань" className="vc-task-panel flex flex-wrap items-center justify-between gap-3 text-sm">
    <p className="text-muted-foreground">{total ? `${(page - 1) * TASK_WORKSPACE_PAGE_SIZE + 1}–${Math.min(page * TASK_WORKSPACE_PAGE_SIZE, total)}` : "0"} із {total} · Сторінка {page} з {pageCount}</p>
    <div className="flex gap-2">
      {page > 1 ? <Link href={taskWorkspaceHref(filters, page - 1)} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-4 py-2 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Назад</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2 text-muted-foreground opacity-60">Назад</span>}
      {page < pageCount ? <Link href={taskWorkspaceHref(filters, page + 1)} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-4 py-2 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Далі</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2 text-muted-foreground opacity-60">Далі</span>}
    </div>
  </nav>;
}
