import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canAccessSection, canManageTasks } from "@/lib/auth/permissions";
import { parseTaskDetailId, safeTaskReturnTo, taskDetailCapabilities } from "@/lib/taskDetail";
import { getKyivDateValue, formatDateValue, formatKyivTimestamp } from "@/lib/kyivDate";
import { getTaskTarget } from "@/lib/taskTarget";
import { getTaskAssignee, getTaskDetail } from "@/services/taskDetailService";
import { getTaskChecklistItems } from "@/app/actions/taskChecklistActions";
import { createClient } from "@/lib/supabase/server";
import TaskChecklist from "@/components/tasks/TaskChecklist";
import TaskDetailActions from "@/components/tasks/TaskDetailActions";
import RecurringTaskBadge from "@/components/tasks/RecurringTaskBadge";
import EquipmentMaintenanceTaskBadge from "@/components/tasks/EquipmentMaintenanceTaskBadge";
import SupervisionTaskBadge from "@/components/tasks/SupervisionTaskBadge";
import type { TaskTemplate } from "@/types/taskTemplate";
import { getTaskRecurrenceLabel } from "@/lib/taskRecurrence";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }> };
type RecurrenceContext = Pick<TaskTemplate, "title" | "is_active" | "recurrence_type" | "recurrence_interval">;

export default async function TaskDetailPage({ params, searchParams }: Props) {
  const profile = await requireSectionAccess("tasks");
  const id = parseTaskDetailId((await params).id);
  if (id === null) notFound();
  const task = await getTaskDetail(id);
  if (!task) notFound();
  const query = await searchParams;
  const returnTo = safeTaskReturnTo(Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo);
  const [assignee, checklist] = await Promise.all([
    getTaskAssignee(task.assigned_employee_id),
    getTaskChecklistItems(id).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
  ]);
  let recurrence: RecurrenceContext | null = null;
  if (task.task_source === "manual" && task.task_template_id !== null && canManageTasks(profile.role)) {
    const supabase = await createClient();
    const { data } = await supabase.from("task_templates").select("title, is_active, recurrence_type, recurrence_interval")
      .eq("id", task.task_template_id).maybeSingle();
    recurrence = data as RecurrenceContext | null;
  }
  const target = getTaskTarget(task);
  const overdue = Boolean(task.due_date && task.due_date < getKyivDateValue() && task.status !== "Виконано");
  const assigneeName = assignee ? `${assignee.last_name} ${assignee.first_name}` : task.assignee || "Не призначено";
  const capabilities = taskDetailCapabilities(task, profile.role);
  return <div className="min-w-0 space-y-5">
    <Link href={returnTo} className="inline-block py-2 text-sm font-medium text-green-700 hover:underline">← Назад до завдань</Link>
    <header className="min-w-0 space-y-4 rounded-xl border bg-white p-4 sm:p-6">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 ${task.status === "Виконано" ? "bg-green-100 text-green-800" : "bg-blue-50 text-blue-800"}`}>{task.status}</span>
        <span className="rounded-full bg-gray-100 px-3 py-1">{task.priority}</span>
        {overdue && <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">Прострочене</span>}
        {task.task_source === "manual" && <span className="rounded-full bg-gray-50 px-3 py-1">Створено вручну</span>}
        {task.task_source === "supervision" && <SupervisionTaskBadge />}
        {task.task_source === "equipment_maintenance" && <EquipmentMaintenanceTaskBadge />}
        {task.task_template_id !== null && <RecurringTaskBadge recurrenceType={recurrence?.recurrence_type} recurrenceInterval={recurrence?.recurrence_interval} />}
      </div>
      <h1 className="break-words text-2xl font-bold sm:text-3xl">{task.title}</h1>
      <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-gray-500">Термін виконання</dt><dd className={`mt-1 font-medium ${overdue ? "text-red-700" : ""}`}>{formatDateValue(task.due_date) ?? "Не вказано"}</dd></div>
        <div className="min-w-0"><dt className="text-gray-500">Відповідальний</dt><dd className="mt-1 break-words font-medium">{assignee && canAccessSection(profile.role, "employees") ? <Link href={`/employees/${assignee.id}`} className="text-green-700 hover:underline">{assigneeName}</Link> : assigneeName}</dd></div>
        <div className="min-w-0"><dt className="text-gray-500">{target?.label ?? "Пов’язаний запис"}</dt><dd className="mt-1 break-words font-medium">{target ? <Link href={target.href} className="text-green-700 hover:underline">{target.name}</Link> : "Пов’язаний запис недоступний"}</dd></div>
        <div><dt className="text-gray-500">Створено</dt><dd className="mt-1">{formatKyivTimestamp(task.created_at) ?? "Не вказано"}</dd></div>
        {task.task_template_id !== null && <div><dt className="text-gray-500">Повторення</dt><dd className="mt-1">{task.recurrence_sequence ? `№ ${task.recurrence_sequence}` : "За серією"} · {task.status === "Виконано" ? "Завершене" : "Поточне"}</dd></div>}
      </dl>
    </header>
    {task.task_source === "manual" && task.task_template_id !== null && <section className="min-w-0 space-y-2 rounded-xl border bg-teal-50 p-4 text-sm">
      <h2 className="font-semibold">Окреме повторення серії № {task.task_template_id}</h2>
      <p>Редагування цього завдання стосується лише цього повторення, а не правила серії. Після виконання поточного завдання наступне створює сервер. Завершене повторення залишається історичним.</p>
      {recurrence && <><Link href={`/tasks/templates/${task.task_template_id}`} className="block break-words font-medium text-green-800 hover:underline">{recurrence.title} →</Link><p>Поточне правило: {getTaskRecurrenceLabel(recurrence.recurrence_type, recurrence.recurrence_interval)} · {recurrence.is_active ? "Активна серія" : "Серію зупинено"}</p><p className="text-xs text-gray-500">Правило показано станом на зараз, не на дату цього повторення. Зміна серії доступна на її окремій сторінці.</p></>}
      {!recurrence && <p className="text-gray-600">Розклад і керування серією доступні керівнику.</p>}
    </section>}
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5"><h2 className="font-semibold">Опис</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{task.description || "Опис не додано."}</p></section>
    <TaskDetailActions key={JSON.stringify([task.id, task.title, task.description, task.status, task.priority, task.due_date, task.assigned_employee_id, assigneeName])} task={task} assignee={assignee} capabilities={capabilities} />
    {checklist.failed ? <section role="alert" className="rounded-xl border bg-white p-4 text-sm text-red-700">Не вдалося завантажити чекліст. <Link href={`/tasks/${id}?${new URLSearchParams({ returnTo })}`} className="underline">Спробувати ще раз</Link></section>
      : <TaskChecklist taskId={id} initialItems={checklist.items} />}
  </div>;
}
