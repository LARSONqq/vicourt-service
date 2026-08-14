"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { completeDashboardTask } from "@/app/actions/dashboardTaskActions";
import RescheduleTaskButton from "@/components/dashboard/RescheduleTaskButton";
import type { TaskWithObject } from "@/types/taskWithObject";

type Props = {
  tasks: TaskWithObject[];
  today: string;
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
}: Props) {
  const router = useRouter();

  const [localTasks, setLocalTasks] =
    useState<TaskWithObject[]>(tasks);

  const [
    updatingTaskId,
    setUpdatingTaskId,
  ] = useState<number | null>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  async function handleCompleteTask(
    task: TaskWithObject
  ) {
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
      <section className="flex flex-col gap-3 rounded-xl border bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
            ✓
          </div>

          <div>
            <h2 className="font-semibold text-gray-800">
              Завдань на сьогодні немає
            </h2>

            <p className="text-sm text-gray-500">
              Усі завдання виконано або
              перенесено
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
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              Завдання на сьогодні
            </h2>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {localTasks.length}
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            Активні завдання, заплановані
            на сьогодні
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
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
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

            return (
              <div
                key={task.id}
                className="flex flex-col gap-4 px-5 py-4 transition hover:bg-gray-50 xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/calendar"
                      className="font-medium hover:text-green-700 hover:underline"
                    >
                      {task.title}
                    </Link>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getPriorityStyle(
                        priority
                      )}`}
                    >
                      {priority}
                    </span>
                  </div>

                  {task.object ? (
                    <Link
                      href={`/objects/${task.object.id}`}
                      className="mt-1 block text-sm text-gray-500 hover:text-green-700 hover:underline"
                    >
                      {task.object.name}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      Об’єкт не вказано
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center xl:shrink-0">
                  <div className="md:text-right">
                    <p className="text-xs text-gray-400">
                      Відповідальний
                    </p>

                    <p className="mt-1 text-sm font-medium text-gray-700">
                      {task.assignee ||
                        "Не призначено"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <RescheduleTaskButton
                      taskId={task.id}
                      objectId={
                        task.object_id
                      }
                      currentDate={
                        task.due_date
                      }
                      compact
                      onRescheduled={(
                        newDate
                      ) =>
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
                        null
                      }
                      onClick={() =>
                        handleCompleteTask(
                          task
                        )
                      }
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating
                        ? "Збереження..."
                        : "✓ Виконано"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {localTasks.length > 5 && (
        <div className="border-t bg-gray-50 px-5 py-3 text-center">
          <Link
            href="/calendar"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            Ще завдань:{" "}
            {localTasks.length - 5}
          </Link>
        </div>
      )}
    </section>
  );
}