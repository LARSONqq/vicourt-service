import Link from "next/link";
import { notFound } from "next/navigation";
import TaskTemplatesPanel from "@/components/tasks/TaskTemplatesPanel";
import { getTaskTemplateView, getTemplateOccurrencesPreview } from "@/services/taskTemplateWorkspaceService";
import { parseTaskDetailId } from "@/lib/taskDetail";
import { templateStateLabel } from "@/lib/taskTemplateWorkspace";
import { getTaskRecurrenceLabel } from "@/lib/taskRecurrence";
import { formatDateValue, formatKyivTimestamp } from "@/lib/kyivDate";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseTaskDetailId((await params).id);
  if (id === null) notFound();
  const template = await getTaskTemplateView(id);
  if (!template) notFound();
  const occurrences = await getTemplateOccurrencesPreview(id);
  return <div className="min-w-0 space-y-5">
    <Link href="/tasks/templates" className="inline-block py-2 text-sm text-green-700">← До шаблонів</Link>
    <header className="min-w-0 space-y-4 rounded-xl border bg-white p-4 sm:p-6">
      <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-green-50 px-3 py-1">{templateStateLabel(template)}</span><span className="px-2 py-1">{getTaskRecurrenceLabel(template.recurrence_type, template.recurrence_interval)}</span></div>
      <h1 className="break-words text-2xl font-bold">{template.title}</h1>
      <p className="whitespace-pre-wrap break-words text-sm text-gray-600">{template.description || "Опис не додано."}</p>
      <dl className="grid min-w-0 gap-4 break-words text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Ціль</dt><dd>{template.object ? <Link href={`/objects/${template.object.id}`} className="text-green-700">{template.object.name}</Link> : template.equipment ? <Link href={`/equipment/${template.equipment.id}`} className="text-green-700">{template.equipment.name}</Link> : template.object_id || template.equipment_id ? "Пов’язаний запис недоступний" : "Обирається під час використання шаблону"}</dd></div>
        <div><dt className="text-gray-500">Відповідальний</dt><dd>{template.employee ? `${template.employee.last_name} ${template.employee.first_name}` : template.assignee || "Не призначено"}</dd></div>
        <div><dt className="text-gray-500">Пріоритет</dt><dd>{template.priority}</dd></div>
        <div><dt className="text-gray-500">Опорна дата правила</dt><dd>{formatDateValue(template.anchor_due_date) ?? "Не задана"}</dd></div>
        <div><dt className="text-gray-500">Оновлено</dt><dd>{formatKyivTimestamp(template.updated_at) ?? "Не вказано"}</dd></div>
        {template.source_template_id && <div><dt className="text-gray-500">Створено з шаблону</dt><dd><Link href={`/tasks/templates/${template.source_template_id}`} className="text-green-700 hover:underline">Шаблон № {template.source_template_id}</Link></dd></div>}
      </dl>
      <p className="text-sm text-gray-500">Це поточне правило, а не історичний знімок розкладу. Наступне повторення створюється після виконання поточного; опорна дата не є прогнозом наступного завдання.</p>
    </header>
    <TaskTemplatesPanel key={`${template.id}:${template.updated_at}:${template.is_active}`} template={template} />
    <section className="min-w-0 space-y-3 rounded-xl border bg-white p-4 sm:p-5">
      <h2 className="font-semibold">Останні повторення · до 5 записів</h2>
      {occurrences === null ? <p role="alert" className="text-sm text-red-700">Не вдалося завантажити повторення. Оновіть сторінку, щоб спробувати ще раз.</p> : occurrences.length === 0 ? <p className="text-sm text-gray-500">Пов’язаних повторень ще немає.</p> : <ul className="divide-y">{occurrences.map((task) => <li key={task.id} className="min-w-0 py-3"><Link href={`/tasks/${task.id}`} className="break-words font-medium text-green-700 hover:underline">№ {task.recurrence_sequence} · {task.title}</Link><p className="mt-1 text-sm text-gray-500">{task.status} · {formatDateValue(task.due_date) ?? "Без терміну"}</p></li>)}</ul>}
      <p className="text-xs text-gray-500">Після зупинки незавершене завдання залишається в робочому просторі як разове й більше не входить до цієї серії. Завершена історія зберігається.</p>
    </section>
  </div>;
}
