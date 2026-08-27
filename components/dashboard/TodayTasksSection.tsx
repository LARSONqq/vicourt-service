"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { completeDashboardTask } from "@/app/actions/dashboardTaskActions";
import RescheduleTaskButton from "@/components/dashboard/RescheduleTaskButton";
import { SUPERVISION_TASK_SOURCE } from "@/constants/taskSource";

import type { TaskWithObject } from "@/types/taskWithObject";

type Props = {
  tasks: TaskWithObject[];
  today: string;
  canManageSupervision: boolean;
};

function getPriorityStyle(priority: string) {
  switch (priority) {
    case "Терміновий":
      return "bg-red-100 text-red-700";

    case "Високий":
      return "bg-orange-100 text-orange-700";

    case "Середній":
      return "bg-violet-100 text-violet-700";

    case "Низький":
      return "bg-gray-100 text-gray-600";

    default:
      return "bg-violet-100 text-violet-700";
  }
}

export default function TodayTasksSection({
  tasks,
  today,
  canManageSupervision,
}: Props) {
  const router = useRouter();

  const [localTasks, setLocalTasks] =
    useState<TaskWithObject[]>(tasks);

  const [previousTasks, setPreviousTasks] =
    useState(tasks);

  const [updatingTaskId, setUpdatingTaskId] =
    useState<number | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  if (tasks !== previousTasks) {
    setPreviousTasks(tasks);
    setLocalTasks(tasks);
  }

  async function handleCompleteTask(
    task: TaskWithObject
  ) {
    if (
      task.task_source ===
        SUPERVISION_TASK_SOURCE &&
      !canManageSupervision
    ) {
      setErrorMessage(
        "Періодичний огляд можуть виконати адміністратор або менеджер об’єктів."
      );

      return;
    }

    if (updatingTaskId !== null) {
      return;
    }

    const previousTasks = localTasks;

    setUpdatingTaskId(task.id);
    setErrorMessage("");

    setLocalTasks((currentTasks) =>
      currentTasks.filter(
        (currentTask) =>
          currentTask.id !== task.id
      )
    );

    try {
      await completeDashboardTask(
        task.id,
        task.object_id
      );

      router.refresh();
    } catch (error) {
      setLocalTasks(previousTasks);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося виконати завдання."
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function handleRescheduled(
    taskId: number,
    newDate: string
  ) {
    if (newDate === today) {
      return;
    }

    setLocalTasks((currentTasks) =>
      currentTasks.filter(
        (currentTask) =>
          currentTask.id !== taskId
      )
    );
  }

  if (localTasks.length === 0) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
            ✓
          </div>

          <div className="min-w-0">
            <h2 className="font-semibold text-gray-800">
              Завдань на сьогодні немає
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Усі завдання виконано або перенесено
            </p>
          </div>
        </div>

        <Link
          href="/calendar"
          className="text-sm font-medium text-green-700 hover:underline"
        >
          Відкрити календар
        </Link>
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-lg font-semibold">
              Завдання на сьогодні
            </h2>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {localTasks.length}
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            Активні завдання, заплановані на сьогодні
          </p>
        </div>

        <Link
          href="/calendar"
          className="w-fit text-sm font-medium text-green-700 hover:underline"
        >
          Відкрити календар →
        </Link>
      </div>

      {errorMessage && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5">
          {errorMessage}
        </div>
      )}

      <div className="divide-y">
        {localTasks
          .slice(0, 5)
          .map((task) => {
            const priority =
              task.priority || "Середній";

            const isUpdating =
              updatingTaskId === task.id;

            const isProtectedSupervision =
              task.task_source ===
                SUPERVISION_TASK_SOURCE &&
              !canManageSupervision;

            return (
              <article
                key={task.id}
                className="min-w-0 p-4 transition hover:bg-gray-50 sm:px-5"
              >
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start gap-2">
                      <Link
                        href="/calendar"
                        className="min-w-0 break-words font-medium hover:text-green-700 hover:underline"
                      >
                        {task.title}
                      </Link>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${getPriorityStyle(
                          priority
                        )}`}
                      >
                        {priority}
                      </span>
                    </div>

                    {task.object ? (
                      <Link
                        href={`/objects/${task.object.id}`}
                        className="mt-1 block break-words text-sm text-gray-500 hover:text-green-700 hover:underline"
                      >
                        {task.object.name}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">
                        Об’єкт не вказано
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        Відповідальний
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-gray-700">
                        {task.assignee || "Не призначено"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <RescheduleTaskButton
                        taskId={task.id}
                        objectId={task.object_id}
                        currentDate={task.due_date}
                        taskSource={
                          task.task_source
                        }
                        canManageSupervision={
                          canManageSupervision
                        }
                        compact
                        onRescheduled={(newDate) =>
                          handleRescheduled(
                            task.id,
                            newDate
                          )
                        }
                      />

                      <button
                        type="button"
                        disabled={
                          updatingTaskId !==
                            null ||
                          isProtectedSupervision
                        }
                        title={
                          isProtectedSupervision
                            ? "Періодичний огляд можуть виконати адміністратор або менеджер об’єктів."
                            : undefined
                        }
                        onClick={() =>
                          handleCompleteTask(task)
                        }
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdating
                          ? "Збереження..."
                          : "✓ Виконано"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
      </div>

      {localTasks.length > 5 && (
        <div className="border-t bg-gray-50 px-4 py-3 text-center sm:px-5">
          <Link
            href="/calendar"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            Ще завдань: {localTasks.length - 5}
          </Link>
        </div>
      )}
    </section>
  );
}
