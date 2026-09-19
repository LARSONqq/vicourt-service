"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { completeDashboardTask } from "@/app/actions/dashboardTaskActions";
import RescheduleTaskButton from "@/components/dashboard/RescheduleTaskButton";
import EquipmentMaintenanceTaskBadge from "@/components/tasks/EquipmentMaintenanceTaskBadge";
import RecurringTaskBadge from "@/components/tasks/RecurringTaskBadge";
import SupervisionTaskBadge from "@/components/tasks/SupervisionTaskBadge";
import {
  EQUIPMENT_MAINTENANCE_TASK_SOURCE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import { getTaskTarget } from "@/lib/taskTarget";
import { taskDashboardLinks } from "@/lib/taskWorkspace";
import { formatDateValue } from "@/lib/kyivDate";

import type { TaskWithObject } from "@/types/taskWithObject";

type Props = {
  tasks: TaskWithObject[];
  today: string;
  canManageSupervision: boolean;
  canManageEquipment: boolean;
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

export default function TodayTasksSection({
  tasks,
  today,
  canManageSupervision,
  canManageEquipment,
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

    if (
      task.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE &&
      !canManageEquipment
    ) {
      setErrorMessage("Планове ТО може виконати лише адміністратор.");
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
        task.id
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
      <section className="flex h-full min-h-56 min-w-0 flex-col overflow-hidden rounded-xl border bg-white">
        <div className="flex min-h-20 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold">Завдання на сьогодні</h2>
            <p className="mt-1 text-sm text-gray-500">
              До 5 відкритих завдань
            </p>
          </div>
          <Link href={taskDashboardLinks.today} className="inline-flex min-h-10 shrink-0 items-center py-2 text-sm font-medium text-green-700 hover:underline">Переглянути всі →</Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center sm:p-5">
          <div><div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-green-700">✓</div><p className="mt-3 text-sm text-gray-500">На сьогодні термінових задач немає.</p></div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white">
      <div className="flex min-h-20 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">Завдання на сьогодні</h2>
          <p className="mt-1 text-sm text-gray-500">
            Показано: {localTasks.length} · до 5 відкритих
          </p>
        </div>

        <Link
          href={taskDashboardLinks.today}
          className="inline-flex min-h-10 shrink-0 items-center py-2 text-sm font-medium text-green-700 hover:underline"
        >
          Переглянути всі →
        </Link>
      </div>

      {errorMessage && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 divide-y">
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
            const isProtectedMaintenance =
              task.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE &&
              !canManageEquipment;
            const target = getTaskTarget(task);

            return (
              <article
                key={task.id}
                className="min-w-0 px-3 py-3 transition hover:bg-gray-50 sm:px-4"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="min-w-0 flex-1 break-words font-medium hover:text-green-700 hover:underline sm:line-clamp-2"
                      >
                        {task.title}
                      </Link>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getPriorityStyle(priority)}`}>{priority}</span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getStatusStyle(task.status)}`}>{task.status}</span>
                      </div>
                    </div>

                    {(task.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE || task.task_source === SUPERVISION_TASK_SOURCE || task.task_template_id !== null) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {task.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE && <EquipmentMaintenanceTaskBadge compact />}
                        {task.task_source === SUPERVISION_TASK_SOURCE && <SupervisionTaskBadge compact />}
                        {task.task_template_id !== null && <RecurringTaskBadge compact />}
                      </div>
                    )}

                    {target ? (
                      <Link
                        href={target.href}
                        className="mt-1 block break-words text-sm text-gray-500 hover:text-green-700 hover:underline sm:line-clamp-1"
                      >
                        {target.type === "equipment" ? "🔧" : "📍"} {target.name}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">
                        Пов’язаний запис не знайдено
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        {formatDateValue(task.due_date)} · Відповідальний
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-gray-700">
                        {task.assignee || "Не призначено"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <RescheduleTaskButton
                        taskId={task.id}
                        currentDate={task.due_date}
                        taskSource={
                          task.task_source
                        }
                        canManageSupervision={
                          canManageSupervision
                        }
                        canManageEquipment={
                          canManageEquipment
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
                          isProtectedSupervision ||
                          isProtectedMaintenance
                        }
                        title={
                          isProtectedSupervision
                            ? "Періодичний огляд можуть виконати адміністратор або менеджер об’єктів."
                            : isProtectedMaintenance
                              ? "Планове ТО може виконати лише адміністратор."
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
