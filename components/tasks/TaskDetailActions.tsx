"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EditTaskForm from "@/components/objects/EditTaskForm";
import { mutateTaskDetail, saveTaskDetail, searchTaskAssignees } from "@/app/actions/taskDetailActions";
import { taskMutationMessage, type taskDetailCapabilities } from "@/lib/taskDetail";
import { workspaceTaskStatuses } from "@/lib/taskWorkspace";
import type { TaskWithObject } from "@/types/taskWithObject";
import type { Employee } from "@/types/employee";

function AssigneePicker({ taskId, initial }: { taskId: number; initial: Employee | null }) {
  const [selected, setSelected] = useState(initial);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [loadedSearch, setLoadedSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function load(query: string, nextPage: number) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const result = await searchTaskAssignees(taskId, query, nextPage);
      if (!result.ok) { setError(result.error); return; }
      setResults(result.data.employees);
      setPage(result.data.page);
      setLoadedSearch(query);
      setHasMore(result.data.hasMore);
      setSearched(true);
    } catch { setError("Не вдалося знайти працівників. Спробуйте ще раз."); }
    finally { lock.current = false; setPending(false); }
  }
  const options = selected ? [selected, ...results.filter((employee) => employee.id !== selected.id)] : results;
  return <div className="min-w-0 space-y-2">
    <select aria-label="Відповідальний працівник" name="assigned_employee_id" value={selected?.id ?? ""}
      onChange={(event) => setSelected(options.find((employee) => employee.id === Number(event.target.value)) ?? null)}
      className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2">
      <option value="">Не призначати</option>
      {options.map((employee) => <option key={employee.id} value={employee.id}>{employee.last_name} {employee.first_name}{employee.status !== "Активний" ? ` (${employee.status})` : ""}</option>)}
    </select>
    <input aria-label="Пошук працівника" type="search" value={search} maxLength={100} disabled={pending} onChange={(event) => setSearch(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void load(search, 1); } }}
      placeholder="Прізвище або ім’я" className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
    <div className="flex flex-wrap gap-2 text-sm">
      <button type="button" disabled={pending} onClick={() => void load(search, 1)} className="min-h-10 rounded-lg border bg-white px-3 py-2 disabled:opacity-50">{pending ? "Пошук…" : "Знайти працівника"}</button>
      {page > 1 && <button type="button" disabled={pending} onClick={() => void load(loadedSearch, page - 1)} className="min-h-10 rounded-lg border px-3">Назад</button>}
      {hasMore && <button type="button" disabled={pending} onClick={() => void load(loadedSearch, page + 1)} className="min-h-10 rounded-lg border px-3">Далі</button>}
    </div>
    <p className="text-xs text-gray-500">Пошук завантажує до 20 працівників. Після пошуку оберіть відповідального у списку вище.</p>
    {searched && !results.length && <p className="text-xs text-gray-500">За цим пошуком працівників не знайдено.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}

type Props = {
  task: TaskWithObject;
  assignee: Employee | null;
  capabilities: ReturnType<typeof taskDetailCapabilities>;
};

export default function TaskDetailActions({ task, assignee, capabilities }: Props) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState(task.status);
  const [date, setDate] = useState(task.due_date ?? "");

  async function mutate(input: Parameters<typeof mutateTaskDetail>[1]) {
    if (lock.current) return;
    lock.current = true;
    setPending(true); setError(""); setSuccess("");
    try {
      const result = await mutateTaskDetail(task.id, input);
      if (!result.ok) { setError(result.error); return; }
      setSuccess("Зміни збережено.");
      router.refresh();
    } catch { setError("Не вдалося зберегти зміни. Перевірте з’єднання та спробуйте ще раз."); }
    finally { lock.current = false; setPending(false); }
  }

  if (!capabilities.edit && !capabilities.complete && !capabilities.dueDate && !capabilities.status) {
    return <p className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">Для цього завдання доступний перегляд. Завершені повторення та автоматичні цикли не відкриваються повторно.</p>;
  }
  return <section className="min-w-0 space-y-4 rounded-xl border bg-white p-4 sm:p-5">
    <h2 className="font-semibold">Дії із завданням</h2>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="text-sm text-green-700">{success}</p>}
    <div className="flex flex-wrap gap-2">
      {capabilities.complete && <button type="button" disabled={pending || editing} onClick={() => void mutate({ kind: "status", status: "Виконано" })} className="min-h-11 rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? "Збереження…" : "✓ Виконати"}</button>}
      {capabilities.edit && <button type="button" disabled={pending || editing} onClick={() => setEditing(true)} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Редагувати / призначити</button>}
    </div>
    {!editing && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {capabilities.status && <form onSubmit={(event) => { event.preventDefault(); void mutate({ kind: "status", status }); }} className="min-w-0 space-y-2">
        <label className="block text-sm text-gray-600">Статус<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2">{workspaceTaskStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <button disabled={pending || status === task.status} className="min-h-10 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Змінити статус</button>
      </form>}
      {capabilities.dueDate && <form onSubmit={(event) => { event.preventDefault(); void mutate({ kind: "date", date }); }} className="min-w-0 space-y-2">
        <label className="block text-sm text-gray-600">Термін виконання<input type="date" value={date} required={task.task_source !== "manual"} onChange={(event) => setDate(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3 py-2" /></label>
        <button disabled={pending || date === (task.due_date ?? "")} className="min-h-10 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Зберегти дату</button>
      </form>}
    </div>}
    {editing && <EditTaskForm task={task} employees={assignee ? [assignee] : []} hideChecklist separateStatusAction
      assignmentField={<AssigneePicker taskId={task.id} initial={assignee} />}
      onSave={async (data) => {
        try {
          const result = await saveTaskDetail(data);
          if (!result.ok) throw new Error(result.error);
          setSuccess("Зміни збережено.");
          router.refresh();
        } catch (error) { throw new Error(taskMutationMessage(error)); }
      }}
      onCancel={() => setEditing(false)} />}
    {task.task_template_id !== null && <p className="text-sm text-teal-800">Виконання створює наступне повторення за чинною серією. Зміни полів збережіть перед виконанням.</p>}
  </section>;
}
