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
      await updateObjectTask(formData);
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
      className="space-y-5 rounded-xl border bg-gray-50 p-5"
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

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Назва завдання
        </label>

        <input
          type="text"
          name="title"
          defaultValue={task.title}
          className="w-full rounded-lg border bg-white p-3"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Опис
        </label>

        <textarea
          name="description"
          rows={4}
          defaultValue={
            task.description || ""
          }
          className="w-full resize-none rounded-lg border bg-white p-3"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Термін виконання
          </label>

          <input
            type="date"
            name="due_date"
            defaultValue={
              task.due_date || ""
            }
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
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
            className="w-full rounded-lg border bg-white p-3"
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
              <p className="mt-2 text-xs text-orange-600">
                Раніше було вказано
                вручну:{" "}
                {task.assignee}
              </p>
            )}

          {employees.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Працівників ще не додано.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Пріоритет
          </label>

          <select
            name="priority"
            defaultValue={
              task.priority || "Середній"
            }
            className="w-full rounded-lg border bg-white p-3"
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

        <div>
          <label className="mb-2 block text-sm font-medium">
            Статус
          </label>

          <select
            name="status"
            defaultValue={task.status}
            className="w-full rounded-lg border bg-white p-3"
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

      <TaskChecklist
        taskId={task.id}
        objectId={objectId}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-100 disabled:opacity-60"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}