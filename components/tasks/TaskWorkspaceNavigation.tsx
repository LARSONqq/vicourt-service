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
    { name: "status", label: "Статус", options: workspaceTaskStatuses.map((value) => [value, value]) },
    { name: "priority", label: "Пріоритет", options: workspaceTaskPriorities.map((value) => [value, value]) },
    { name: "assignee", label: "Відповідальний", options: [["unassigned", "Без відповідального"], ...employees.map((employee) => [String(employee.id), `${employee.last_name} ${employee.first_name}`])] },
    { name: "target", label: "Зв’язок", options: [["object", "Об’єкт"], ["equipment", "Техніка"]] },
    { name: "source", label: "Джерело", options: [["manual", "Вручну"], ["supervision", "Періодичний огляд"], ["equipment_maintenance", "Планове ТО"]] },
    { name: "recurrence", label: "Повторення", options: [["once", "Разові"], ["recurring", "Повторювані"]] },
  ];
  return <section className="min-w-0 space-y-4">
    <nav aria-label="Види завдань" className="flex flex-wrap gap-2">
      {Object.entries(taskViews).map(([view, label]) => <Link key={view}
        href={taskWorkspaceHref({ ...filters, view: view as TaskView })}
        aria-current={filters.view === view ? "page" : undefined}
        className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${filters.view === view ? "border-green-700 bg-green-700 text-white" : "bg-white text-gray-700 hover:bg-green-50"}`}>
        {label} <span className="ml-1 text-xs">{counts[view as TaskView]}</span>
      </Link>)}
    </nav>
    <p className="text-xs text-gray-500">Лічильники — усі доступні завдання у відповідному виді, без додаткових фільтрів.</p>
    <form key={JSON.stringify(filters)} action="/tasks" method="get" className="grid min-w-0 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="view" value={filters.view} />
      <label className="min-w-0 text-sm text-gray-600">Пошук
        <input type="search" name="q" defaultValue={filters.q} maxLength={200} placeholder="Назва або опис" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" />
      </label>
      {selects.map(({ name, label, options }) => <label key={name} className="min-w-0 text-sm text-gray-600">{label}
        <select name={name} defaultValue={filters[name as keyof TaskWorkspaceFilters]} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2">
          <option value="">Усі</option>
          {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>)}
      <div className="flex flex-wrap items-end gap-3">
        <button type="submit" className="min-h-11 rounded-lg bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800">Застосувати</button>
        <Link href={`/tasks?view=${filters.view}`} className="py-3 text-sm text-green-700 hover:underline">Очистити</Link>
      </div>
    </form>
  </section>;
}

export function TaskWorkspacePagination({ filters, page, pageCount, total }: { filters: TaskWorkspaceFilters; page: number; pageCount: number; total: number }) {
  return <nav aria-label="Сторінки завдань" className="flex flex-wrap items-center justify-between gap-3 text-sm">
    <p className="text-gray-600">{total ? `${(page - 1) * TASK_WORKSPACE_PAGE_SIZE + 1}–${Math.min(page * TASK_WORKSPACE_PAGE_SIZE, total)}` : "0"} із {total} · Сторінка {page} з {pageCount}</p>
    <div className="flex gap-2">
      {page > 1 ? <Link href={taskWorkspaceHref(filters, page - 1)} className="rounded-lg border bg-white px-4 py-3">Назад</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-3 text-gray-400">Назад</span>}
      {page < pageCount ? <Link href={taskWorkspaceHref(filters, page + 1)} className="rounded-lg border bg-white px-4 py-3">Далі</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-3 text-gray-400">Далі</span>}
    </div>
  </nav>;
}
