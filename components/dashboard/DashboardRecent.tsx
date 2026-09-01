import Link from "next/link";

import EquipmentMaintenanceTaskBadge from "@/components/tasks/EquipmentMaintenanceTaskBadge";
import SupervisionTaskBadge from "@/components/tasks/SupervisionTaskBadge";
import {
  EQUIPMENT_MAINTENANCE_TASK_SOURCE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import {
  formatDateValue,
} from "@/lib/kyivDate";
import {
  getTaskTarget,
} from "@/lib/taskTarget";

import type {
  DashboardData,
} from "@/types/dashboard";

type Props = {
  nearestTasks: DashboardData["nearestTasks"];
  recentObjects: DashboardData["objects"]["recent"];
};

function getObjectStatusStyle(
  status: string
) {
  switch (status) {
    case "Новий":
      return "bg-blue-100 text-blue-700";
    case "В роботі":
      return "bg-green-100 text-green-700";
    case "На постійному обслуговуванні":
      return "bg-purple-100 text-purple-700";
    case "Під періодичним наглядом":
      return "bg-rose-100 text-rose-700";
    case "Призупинено":
      return "bg-yellow-100 text-yellow-700";
    case "Завершено":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getPriorityStyle(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return "bg-red-100 text-red-700";
    case "Високий":
      return "bg-orange-100 text-orange-700";
    case "Середній":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function DashboardRecent({
  nearestTasks,
  recentObjects,
}: Props) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <article className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between gap-3 border-b p-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">
              Найближчі завдання
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Наступні сім днів
            </p>
          </div>
          <Link
            href="/task"
            className="shrink-0 text-sm font-medium text-green-700 hover:underline"
          >
            Усі →
          </Link>
        </div>

        {nearestTasks.length ===
        0 ? (
          <p className="p-5 text-sm text-gray-500">
            На найближчі сім днів завдань немає.
          </p>
        ) : (
          <div className="divide-y">
            {nearestTasks.map(
              (task) => {
                const target =
                  getTaskTarget(
                    task
                  );

                return (
                  <div
                    key={task.id}
                    className="min-w-0 p-4 sm:px-5"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-gray-900">
                          {task.title}
                        </p>
                        {target && (
                          <Link
                            href={
                              target.href
                            }
                            className="mt-1 block break-words text-sm text-gray-500 hover:text-green-700 hover:underline"
                          >
                            {target.type ===
                            "equipment"
                              ? "🔧"
                              : "📍"}{" "}
                            {target.name}
                          </Link>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${getPriorityStyle(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">
                        До:{" "}
                        {formatDateValue(
                          task.due_date
                        )}
                      </span>
                      {task.task_source ===
                        SUPERVISION_TASK_SOURCE && (
                        <SupervisionTaskBadge compact />
                      )}
                      {task.task_source ===
                        EQUIPMENT_MAINTENANCE_TASK_SOURCE && (
                        <EquipmentMaintenanceTaskBadge compact />
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </article>

      <article className="min-w-0 overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between gap-3 border-b p-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">
              Останні об’єкти
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Нещодавно додані
            </p>
          </div>
          <Link
            href="/objects"
            className="shrink-0 text-sm font-medium text-green-700 hover:underline"
          >
            Усі →
          </Link>
        </div>

        {recentObjects.length ===
        0 ? (
          <p className="p-5 text-sm text-gray-500">
            Об’єктів поки немає.
          </p>
        ) : (
          <div className="divide-y">
            {recentObjects.map(
              (object) => (
                <Link
                  key={object.id}
                  href={`/objects/${object.id}`}
                  className="flex min-w-0 flex-col gap-2 p-4 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-medium text-gray-900">
                      {object.name}
                    </span>
                    <span className="mt-1 block break-words text-sm text-gray-500">
                      {object.manager ||
                        object.customer ||
                        "Відповідального не вказано"}
                    </span>
                  </span>

                  <span className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getObjectStatusStyle(
                        object.status
                      )}`}
                    >
                      {object.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateValue(
                        object.createdAt.slice(
                          0,
                          10
                        )
                      )}
                    </span>
                  </span>
                </Link>
              )
            )}
          </div>
        )}
      </article>
    </section>
  );
}
