"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { activateTaskTemplateSeriesAction, createTaskFromTemplateAction, createTaskTemplateAction, updateTaskTemplateAction } from "@/app/actions/taskTemplateActions";
import TaskRecurrenceFields from "@/components/tasks/TaskRecurrenceFields";
import TaskTemplateLookup from "@/components/tasks/TaskTemplateLookup";
import StopRecurringTaskButton from "@/components/tasks/StopRecurringTaskButton";
import { isBoundTemplate } from "@/lib/taskTemplateWorkspace";
import { taskMutationMessage } from "@/lib/taskDetail";
import { workspaceTaskPriorities } from "@/lib/taskWorkspace";
import type { TaskTemplateView } from "@/types/taskTemplateWorkspace";
import type { TaskRecurrenceType } from "@/types/taskTemplate";
import type { TaskPriority, TaskTargetType } from "@/types/objectTask";

// Same canonical actions; the former all-template panel is now one scoped editor.
export default function TaskTemplatesPanel({ template }: { template?: TaskTemplateView }) {
  const router = useRouter();
  const lock = useRef(false);
  const [mode, setMode] = useState<"edit" | "use" | null>(template ? null : "edit");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(template?.priority ?? "Середній");
  const [employee, setEmployee] = useState(template?.assigned_employee_id ? String(template.assigned_employee_id) : "");
  const [targetType, setTargetType] = useState<TaskTargetType>(template?.target_type ?? "object");
  const [target, setTarget] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrenceType>(template?.recurrence_type ?? "weekly");
  const [interval, setInterval] = useState(String(template?.recurrence_interval ?? 14));
  const [date, setDate] = useState(template?.anchor_due_date ?? "");
  const [active, setActive] = useState(false);
  const [useEmployee, setUseEmployee] = useState("");
  const bound = template ? isBoundTemplate(template) : false;
  const using = mode === "use";

  function open(nextMode: "edit" | "use") {
    setError(""); setMessage(""); setMode(nextMode);
    setTitle(template?.title ?? ""); setDescription(template?.description ?? ""); setPriority(template?.priority ?? "Середній");
    setEmployee(template?.assigned_employee_id ? String(template.assigned_employee_id) : "");
    setRecurrence(template?.recurrence_type ?? "weekly"); setInterval(String(template?.recurrence_interval ?? 14));
    setDate(template?.anchor_due_date ?? ""); setTarget(""); setUseEmployee("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setPending(true); setError(""); setMessage("");
    try {
      if (using && template) {
        const relation = { templateId: template.id, targetType: template.target_type,
          objectId: template.target_type === "object" ? Number(target) : null,
          equipmentId: template.target_type === "equipment" ? Number(target) : null };
        if (template.recurrence_type === "none") {
          const task = await createTaskFromTemplateAction({ ...relation, dueDate: date || null, assignedEmployeeId: useEmployee ? Number(useEmployee) : null });
          router.push(`/tasks/${task.id}`);
        } else {
          const result = await activateTaskTemplateSeriesAction({ ...relation, anchorDueDate: date });
          router.push(`/tasks/templates/${result.template.id}`);
        }
      } else {
        const fields = { title, description, priority, assignedEmployeeId: employee ? Number(employee) : null,
          recurrenceType: recurrence, recurrenceInterval: recurrence === "none" ? null : recurrence === "custom" ? Number(interval) : 1,
          anchorDueDate: date || null };
        if (template) {
          await updateTaskTemplateAction({ ...fields, templateId: template.id });
          setMessage("Зміни збережено. Завершена історія не змінюється.");
        } else {
          const result = await createTaskTemplateAction({ ...fields, targetType, isActive: active,
            objectId: active && targetType === "object" ? Number(target) : null,
            equipmentId: active && targetType === "equipment" ? Number(target) : null });
          router.push(`/tasks/templates/${result.template.id}`);
        }
      }
      setMode(null); router.refresh();
    } catch (error) { setError(taskMutationMessage(error, "Не вдалося зберегти. Перевірте поля, ціль, працівника та права доступу. Спробуйте ще раз.")); }
    finally { lock.current = false; setPending(false); }
  }

  return <section className="min-w-0 space-y-4 rounded-xl border bg-white p-4 sm:p-5">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    {template && mode === null && <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => open("edit")} className="min-h-11 rounded-lg border px-4 py-2">Редагувати {template.is_active ? "серію" : "визначення"}</button>
      {!bound && !template.is_active && <button type="button" onClick={() => open("use")} className="min-h-11 rounded-lg bg-green-700 px-4 py-2 text-white">{template.recurrence_type === "none" ? "Створити разове завдання" : "Створити серію з шаблону"}</button>}
      {template.is_active && <StopRecurringTaskButton templateId={template.id} taskTitle={template.title} />}
      {bound && !template.is_active && <p className="w-full text-sm text-gray-500">Серію зупинено. Повторна активація цієї серії не підтримується; створіть нову серію. Історію збережено.</p>}
    </div>}
    {mode !== null && <form onSubmit={submit} className="min-w-0 space-y-4">
      <h2 className="font-semibold">{using ? "Використати шаблон" : template ? "Редагування визначення" : "Новий шаблон / серія"}</h2>
      <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{using
        ? template?.recurrence_type === "none" ? "Буде створено одне разове завдання без повторення." : "Буде створено окрему серію для вибраної цілі та одне актуальне повторення. Далі завдання створюються після виконання поточного. Якщо активна серія для цієї цілі вже існує, відкриється вона."
        : template?.is_active ? "Зміни вплинуть на правило серії та поточне незавершене завдання, включно з перерахунком його дати. Завершені завдання не зміняться. Ціль серії незмінна."
        : "Ви редагуєте визначення, не історію завдань. Зміна неприв’язаного шаблону не переписує вже створені з нього серії."}</p>
      <fieldset disabled={pending} className="min-w-0 space-y-4 disabled:opacity-60">
        {!using && <>
          <label className="block text-sm">Назва<input required maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm">Опис<textarea maxLength={4000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2" /></label>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block text-sm">Пріоритет<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 py-2">{workspaceTaskPriorities.map((value) => <option key={value}>{value}</option>)}</select></label>
            <TaskTemplateLookup key={`employee-${mode}`} kind="employee" label="Відповідальний" value={employee} onChange={setEmployee} initial={template?.assigned_employee_id ? { id: template.assigned_employee_id, label: template.employee ? `${template.employee.last_name} ${template.employee.first_name}` : template.assignee ?? `Працівник №${template.assigned_employee_id}` } : undefined} />
          </div>
          {!template && <label className="block text-sm">Тип цілі<select value={targetType} onChange={(event) => { setTargetType(event.target.value as TaskTargetType); setTarget(""); }} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 py-2"><option value="object">Об’єкт</option><option value="equipment">Техніка</option></select></label>}
          <TaskRecurrenceFields idPrefix="template" templateDefinition allowNone={!active && !template?.is_active} value={recurrence} customInterval={interval} onChange={setRecurrence} onCustomIntervalChange={setInterval} />
          {!template && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} disabled={recurrence === "none"} onChange={(event) => setActive(event.target.checked)} />Одразу запустити серію для обраної цілі</label>}
        </>}
        {(using || active) && <TaskTemplateLookup key={targetType} kind={targetType} label={targetType === "object" ? "Об’єкт" : "Техніка"} value={target} onChange={setTarget} required />}
        {(recurrence !== "none" || using) && <label className="block text-sm">{recurrence === "none" ? "Термін разового завдання" : "Опорна дата серії"}<input type="date" value={date} required={recurrence !== "none" && (active || using || template?.is_active)} onChange={(event) => setDate(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" /></label>}
        {using && template?.recurrence_type === "none" && <TaskTemplateLookup kind="employee" label="Відповідальний" emptyLabel="Як у шаблоні" value={useEmployee} onChange={setUseEmployee} />}
        <div className="flex flex-wrap gap-2"><button type="submit" className="min-h-11 rounded-lg bg-green-700 px-4 py-2 text-white">{pending ? "Збереження…" : using ? "Створити" : "Зберегти"}</button><button type="button" onClick={() => template ? setMode(null) : router.push("/tasks/templates")} className="min-h-11 rounded-lg border px-4 py-2">Скасувати</button></div>
      </fieldset>
    </form>}
  </section>;
}
