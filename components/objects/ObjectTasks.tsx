"use client";

import {
  Fragment,
  useState,
} from "react";
import { deleteObjectTask } from "@/app/actions/taskActions";
import type { Employee } from "@/types/employee";
import type { ObjectTask } from "@/types/objectTask";
import AddTaskForm from "./AddTaskForm";
import EditTaskForm from "./EditTaskForm";

type Props = {
  tasks: ObjectTask[];
  objectId: number;
  employees: Employee[];
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function getStatusStyle(status: string) {
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
}: Props) {
  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">
          Завдання
        </h2>

        <button
          type="button"
          onClick={() =>
            setShowForm(
              (previous) => !previous
            )
          }
          className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          {showForm
            ? "Закрити"
            : "+ Додати завдання"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border bg-gray-50 p-4">
          <AddTaskForm
            objectId={objectId}
            employees={employees}
          />
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-gray-500">
          Завдань поки що немає.
        </p>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Fragment key={task.id}>
              <article className="rounded-xl border p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusStyle(
                      task.status
                    )}`}
                  >
                    {task.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm text-gray-500">
                  <p>
                    Термін:{" "}
                    <span className="font-medium text-gray-700">
                      {task.due_date
                        ? formatDate(
                            task.due_date
                          )
                        : "Не вказано"}
                    </span>
                  </p>

                  <p>
                    Відповідальний:{" "}
                    <span className="font-medium text-gray-700">
                      {task.assignee ||
                        "Не призначено"}
                    </span>
                  </p>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingId(
                        editingId === task.id
                          ? null
                          : task.id
                      )
                    }
                    className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Редагувати
                  </button>

                  <form
                    action={deleteObjectTask.bind(
                      null,
                      task.id,
                      objectId
                    )}
                    onSubmit={(event) => {
                      const confirmed =
                        window.confirm(
                          `Видалити завдання «${task.title}»?`
                        );

                      if (!confirmed) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Видалити
                    </button>
                  </form>
                </div>
              </article>

              {editingId === task.id && (
                <EditTaskForm
                  task={task}
                  objectId={objectId}
                   employees={employees}
                  onCancel={() =>
                    setEditingId(null)
                  }
                />
              )}
            </Fragment>
          ))}
        </div>
      )}
    </section>
  );
}