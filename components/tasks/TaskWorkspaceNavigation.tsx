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
  const filterLabels: Record<string, string> = {
    q: filters.q,
    status: filters.status === "open" ? "Відкриті" : filters.status,
    priority: filters.priority,
    assignee: filters.assignee === "unassigned" ? "Без відповідального" : (() => {
      const employee = employees.find((item) => String(item.id) === filters.assignee);
      return employee ? `${employee.last_name} ${employee.first_name}` : filters.assignee;
    })(),
    target: filters.target === "object" ? "Об’єкт" : filters.target === "equipment" ? "Техніка" : "",
    source: ({ manual: "Вручну", supervision: "Періодичний огляд", equipment_maintenance: "Планове ТО" } as Record<string, string>)[filters.source] || "",
    recurrence: filters.recurrence === "once" ? "Разові" : filters.recurrence === "recurring" ? "Повторювані" : "",
  };
  const activeFilters = Object.entries(filterLabels).filter(([, value]) => Boolean(value));
  return <section className="vc-task-panel min-w-0 space-y-3">
    <nav aria-label="Види завдань" className="vc-surface grid grid-cols-2 overflow-hidden p-1 sm:grid-cols-3 lg:grid-cols-6">
      {Object.entries(taskViews).map(([view, label]) => <Link key={view}
        href={taskWorkspaceHref({ ...filters, view: view as TaskView })}
        aria-current={filters.view === view ? "page" : undefined}
        className={`inline-flex min-h-10 items-center justify-between gap-2 rounded-md border-b-2 px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${filters.view === view ? "border-primary bg-primary text-primary-foreground" : "border-transparent text-foreground hover:bg-muted"}`}>
        {label} <span className={`tabular-nums ${filters.view === view ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{counts[view as TaskView]}</span>
      </Link>)}
    </nav>
    <div className="flex flex-wrap items-center gap-2">
      <details className="group min-w-0 basis-full">
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Фільтри <span aria-hidden="true" className="text-muted-foreground transition group-open:rotate-180">⌄</span>
        </summary>
        <form key={JSON.stringify(filters)} action="/tasks" method="get" className="vc-surface mt-2 grid min-w-0 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </details>
      {activeFilters.map(([key, label]) => (
        <Link
          key={key}
          href={taskWorkspaceHref({ ...filters, [key]: "" })}
          aria-label={`Прибрати фільтр: ${label}`}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate">{label}</span><span aria-hidden="true" className="text-muted-foreground">×</span>
        </Link>
      ))}
    </div>
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
