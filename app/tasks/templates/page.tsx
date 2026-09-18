import Link from "next/link";
import { getTaskTemplatesPage } from "@/services/taskTemplateWorkspaceService";
import { templateStateLabel, templateStatuses, templateWorkspaceHref } from "@/lib/taskTemplateWorkspace";
import { getTaskRecurrenceLabel } from "@/lib/taskRecurrence";
import { formatDateValue } from "@/lib/kyivDate";
import type { TaskWorkspaceQuery } from "@/lib/taskWorkspace";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<TaskWorkspaceQuery> }) {
  // The service guards independently: layouts do not serialize child server rendering.
  const { templates, filters, page, pageCount, total } = await getTaskTemplatesPage(await searchParams);
  return <div className="min-w-0 space-y-5">
    <Link href="/tasks" className="inline-block py-2 text-sm text-green-700">← До завдань</Link>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Шаблони та повторення</h1><p className="mt-1 text-sm text-gray-500">Шаблон — визначення для повторного використання. Активна серія — повторення для конкретної цілі.</p></div>
      <Link href="/tasks/templates/new" className="min-h-11 rounded-lg bg-green-700 px-4 py-3 text-sm text-white">Створити шаблон / серію</Link>
    </header>
    <form key={`${filters.q}:${filters.status}`} action="/tasks/templates" className="flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row">
      <label className="min-w-0 flex-1 text-sm">Пошук<input name="q" defaultValue={filters.q} maxLength={200} placeholder="Назва або опис" className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3" /></label>
      <label className="text-sm">Стан<select name="status" defaultValue={filters.status} className="mt-1 min-h-11 w-full rounded-lg border px-3">{Object.entries(templateStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="min-h-11 self-end rounded-lg border px-4 py-2">Застосувати</button>
      <Link href="/tasks/templates" className="self-end px-2 py-3 text-sm text-gray-600">Скинути</Link>
    </form>
    <p className="text-sm text-gray-500">Знайдено: {total} · Сторінка {page} з {pageCount}</p>
    {templates.length === 0 && <div className="rounded-xl border bg-white p-6 text-gray-500">Шаблонів за цими умовами немає.</div>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">{templates.map((template) => <article key={template.id} className="min-w-0 space-y-3 rounded-xl border bg-white p-4">
      <div className="flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-3 py-1 ${template.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{templateStateLabel(template)}</span><span className="rounded-full bg-teal-50 px-3 py-1">{getTaskRecurrenceLabel(template.recurrence_type, template.recurrence_interval)}</span><span className="px-2 py-1">{template.priority}</span></div>
      <h2 className="break-words font-semibold"><Link href={`/tasks/templates/${template.id}`} className="text-green-800 hover:underline">{template.title}</Link></h2>
      <dl className="space-y-2 break-words text-sm">
        <div><dt className="text-gray-500">Ціль</dt><dd>{template.object ? <Link href={`/objects/${template.object.id}`} className="text-green-700">{template.object.name}</Link> : template.equipment ? <Link href={`/equipment/${template.equipment.id}`} className="text-green-700">{template.equipment.name}</Link> : template.object_id || template.equipment_id ? "Пов’язаний запис недоступний" : template.target_type === "object" ? "Шаблон для об’єкта" : "Шаблон для техніки"}</dd></div>
        <div><dt className="text-gray-500">Відповідальний</dt><dd>{template.employee ? `${template.employee.last_name} ${template.employee.first_name}` : template.assignee || "Не призначено"}</dd></div>
        <div><dt className="text-gray-500">Опорна дата правила (не прогноз)</dt><dd>{formatDateValue(template.anchor_due_date) ?? "Не задана"}</dd></div>
      </dl>
    </article>)}</div>
    <nav aria-label="Сторінки шаблонів" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {page > 1 ? <Link href={templateWorkspaceHref(filters, page - 1)} className="rounded-lg border bg-white px-4 py-3">Назад</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-3 text-gray-400">Назад</span>}
      <span>{page} / {pageCount}</span>
      {page < pageCount ? <Link href={templateWorkspaceHref(filters, page + 1)} className="rounded-lg border bg-white px-4 py-3">Далі</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-3 text-gray-400">Далі</span>}
    </nav>
  </div>;
}
