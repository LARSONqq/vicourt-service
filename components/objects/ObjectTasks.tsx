"use client";

import {
  Fragment,
  useState,
} from "react";

import { deleteObjectTask } from "@/app/actions/taskActions";
import RecurringTaskBadge from "@/components/tasks/RecurringTaskBadge";
import StopRecurringTaskButton from "@/components/tasks/StopRecurringTaskButton";
import SupervisionTaskBadge from "@/components/tasks/SupervisionTaskBadge";
import {
  SUPERVISION_TASK_MANAGED_MESSAGE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";

import type { Employee } from "@/types/employee";
import type { ObjectTask } from "@/types/objectTask";

import AddTaskForm from "./AddTaskForm";
import EditTaskForm from "./EditTaskForm";

type Props = {
  tasks: ObjectTask[];
  objectId: number;
  employees: Employee[];
  canManageRecurrence?: boolean;
};

function formatDate(
  date: string
) {
  const [
    year,
    month,
    day,
  ] = date.split("-");

  return `${day}.${month}.${year}`;
}

function getStatusStyle(
  status: string
) {
  switch (status) {
    case "Заплановано":
      return "bg-blue-50 text-blue-700";

    case "В роботі":
      return "bg-yellow-50 text-yellow-700";

    case "Виконано":
      return "bg-green-50 text-green-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function ObjectTasks({
  tasks,
  objectId,
  employees,
  canManageRecurrence = false,
}: Props) {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
            Завдання
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Завдань: {tasks.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowForm(
              (previous) =>
                !previous
            )
          }
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-fit ${
            showForm
              ? "border bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {showForm
            ? "Закрити форму"
            : "+ Додати завдання"}
        </button>
      </div>

      {/* ADD FORM */}
      {showForm && (
        <div className="mb-5 min-w-0 rounded-xl border bg-gray-50 p-3 sm:mb-6 sm:p-4">
          <AddTaskForm
            objectId={
              objectId
            }
            employees={
              employees
            }
            canManageRecurrence={
              canManageRecurrence
            }
          />
        </div>
      )}

      {/* EMPTY */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400">
            ✓
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Завдань поки немає
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Додай перше завдання для цього об’єкта.
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {tasks.map(
            (task) => {
              const isSupervisionTask =
                task.task_source ===
                SUPERVISION_TASK_SOURCE;

              return (
                <Fragment
                  key={task.id}
                >
                <article className="min-w-0 rounded-xl border p-4 sm:p-5">
                  {/* TOP */}
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-gray-900">
                        {
                          task.title
                        }
                      </h3>

                      {isSupervisionTask && (
                        <div className="mt-2">
                          <SupervisionTaskBadge />
                        </div>
                      )}

                      {task.task_template_id !== null && (
                        <div className="mt-2">
                          <RecurringTaskBadge />
                        </div>
                      )}

                      {task.description && (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                          {
                            task.description
                          }
                        </p>
                      )}
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${getStatusStyle(
                        task.status
                      )}`}
                    >
                      {
                        task.status
                      }
                    </span>
                  </div>

                  {/* INFO */}
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        Термін
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-gray-700">
                        {task.due_date
                          ? formatDate(
                              task.due_date
                            )
                          : "Не вказано"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        Відповідальний
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-gray-700">
                        {task.assignee ||
                          "Не призначено"}
                      </p>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  {isSupervisionTask ? (
                    <p className="mt-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {
                        SUPERVISION_TASK_MANAGED_MESSAGE
                      }
                    </p>
                  ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId(
                          editingId ===
                            task.id
                            ? null
                            : task.id
                        )
                      }
                      className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        editingId ===
                        task.id
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      {editingId ===
                      task.id
                        ? "Закрити"
                        : "Редагувати"}
                    </button>

                    {task.task_template_id === null ? (
                      <form
                        action={deleteObjectTask.bind(
                          null,
                          task.id
                        )}
                        onSubmit={(
                          event
                        ) => {
                          const confirmed =
                            window.confirm(
                              `Видалити завдання «${task.title}»?`
                            );

                          if (!confirmed) {
                            event.preventDefault();
                          }
                        }}
                        className="w-full sm:w-auto"
                      >
                        <button
                          type="submit"
                          className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:w-auto"
                        >
                          Видалити
                        </button>
                      </form>
                    ) : canManageRecurrence &&
                      task.status !== "Виконано" ? (
                      <StopRecurringTaskButton
                        templateId={task.task_template_id}
                        taskTitle={task.title}
                        compact
                      />
                    ) : (
                      <p className="col-span-2 text-xs leading-5 text-gray-500 sm:max-w-xs sm:text-right">
                        {task.status === "Виконано"
                          ? "Історичне повторення не видаляється."
                          : "Серією керує адміністратор або керівник об’єкта."}
                      </p>
                    )}
                  </div>
                  )}
                </article>

                {/* EDIT FORM */}
                {!isSupervisionTask &&
                  editingId ===
                    task.id && (
                  <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:p-4">
                    <EditTaskForm
                      task={
                        task
                      }
                      objectId={
                        objectId
                      }
                      employees={
                        employees
                      }
                      canManageRecurrence={
                        canManageRecurrence
                      }
                      onCancel={() =>
                        setEditingId(
                          null
                        )
                      }
                    />
                  </div>
                )}
                </Fragment>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}
