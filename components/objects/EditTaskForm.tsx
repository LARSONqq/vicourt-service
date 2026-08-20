"use client";

import { useState } from "react";

import { updateObjectTask } from "@/app/actions/taskActions";

import TaskChecklist from "@/components/tasks/TaskChecklist";

import type { Employee } from "@/types/employee";

import type {
  ObjectTask,
  TaskPriority,
} from "@/types/objectTask";

type Props = {
  task: ObjectTask;
  objectId: number;
  employees: Employee[];
  onCancel: () => void;
};

const priorities: TaskPriority[] = [
  "Низький",
  "Середній",
  "Високий",
  "Терміновий",
];

export default function EditTaskForm({
  task,
  objectId,
  employees,
  onCancel,
}: Props) {
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateObjectTask(
        formData
      );

      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити завдання."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-xl border bg-gray-50 p-4 sm:p-5"
    >
      <input
        type="hidden"
        name="task_id"
        value={task.id}
      />

      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      <input
        type="hidden"
        name="assignee"
        value={task.assignee || ""}
      />

      <div>
        <h3 className="text-base font-semibold text-gray-800">
          Редагування завдання
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Зміни дані завдання або його статус
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Назва завдання
        </label>

        <input
          type="text"
          name="title"
          defaultValue={task.title}
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          required
        />
      </div>

      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Опис
        </label>

        <textarea
          name="description"
          rows={4}
          defaultValue={
            task.description || ""
          }
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Термін виконання
          </label>

          <input
            type="date"
            name="due_date"
            defaultValue={
              task.due_date || ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Відповідальний працівник
          </label>

          <select
            name="assigned_employee_id"
            defaultValue={
              task.assigned_employee_id
                ? String(
                    task.assigned_employee_id
                  )
                : ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Не призначати
            </option>

            {employees.map(
              (employee) => (
                <option
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.last_name}{" "}
                  {employee.first_name}
                  {employee.position
                    ? ` — ${employee.position}`
                    : ""}
                  {employee.status !==
                  "Активний"
                    ? ` (${employee.status})`
                    : ""}
                </option>
              )
            )}
          </select>

          {!task.assigned_employee_id &&
            task.assignee && (
              <p className="mt-2 break-words text-xs text-orange-600">
                Раніше було вказано вручну:{" "}
                {task.assignee}
              </p>
            )}

          {employees.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Працівників ще не додано.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Пріоритет
          </label>

          <select
            name="priority"
            defaultValue={
              task.priority ||
              "Середній"
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            {priorities.map(
              (priority) => (
                <option
                  key={priority}
                  value={priority}
                >
                  {priority}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Статус
          </label>

          <select
            name="status"
            defaultValue={task.status}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="Заплановано">
              Заплановано
            </option>

            <option value="В роботі">
              В роботі
            </option>

            <option value="Виконано">
              Виконано
            </option>
          </select>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
        <TaskChecklist
          taskId={task.id}
          objectId={objectId}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 border-t pt-5 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg border bg-white px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 sm:w-fit"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}