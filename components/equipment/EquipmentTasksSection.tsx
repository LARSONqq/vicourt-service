import Link from "next/link";

import RecurringTaskBadge from "@/components/tasks/RecurringTaskBadge";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  EquipmentScopedPage,
} from "@/types/equipmentProfile";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";

type Props = {
  page: EquipmentScopedPage<TaskWithObject>;
  today: string;
};

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "Заплановано":
      return "bg-blue-50 text-blue-700";
    case "В роботі":
      return "bg-amber-50 text-amber-700";
    case "Виконано":
      return "bg-green-50 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getPriorityClasses(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return "bg-red-50 text-red-700";
    case "Високий":
      return "bg-orange-50 text-orange-700";
    case "Середній":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getSourceLabel(
  task: TaskWithObject
) {
  switch (task.task_source) {
    case "supervision":
      return "Періодичний огляд";
    case "equipment_maintenance":
      return "Планове ТО";
    default:
      return "Ручне завдання";
  }
}

export default function EquipmentTasksSection({
  page,
  today,
}: Props) {
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Завдання техніки
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            Ручні завдання й автоматичне планове ТО, прив’язані до цієї техніки.
          </p>
        </div>

        <Link
          href="/task"
          className="inline-flex min-h-10 w-fit shrink-0 items-center text-sm font-medium text-green-700 hover:underline"
        >
          Відкрити завдання →
        </Link>
      </div>

      {page.items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-6 text-center">
          <p className="font-medium text-gray-700">
            Завдань для цієї техніки немає
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Нові ручні завдання або планове ТО з’являться тут автоматично.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
          {page.items.map((task) => {
            const isOverdue =
              task.status !== "Виконано" &&
              task.due_date !== null &&
              task.due_date < today;

            return (
              <article
                key={task.id}
                className="min-w-0 rounded-xl border bg-white p-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href="/task"
                      className="break-words font-semibold text-gray-900 hover:text-green-700 hover:underline"
                    >
                      {task.title}
                    </Link>

                    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        {getSourceLabel(task)}
                      </span>
                      {task.task_template_id !== null && (
                        <RecurringTaskBadge compact />
                      )}
                    </div>
                  </div>

                  <span
                    className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                      task.status
                    )}`}
                  >
                    {task.status}
                  </span>
                </div>

                {task.description && (
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-gray-600">
                    {task.description}
                  </p>
                )}

                <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-gray-400">
                      Термін
                    </dt>
                    <dd
                      className={`mt-1 break-words font-medium ${
                        isOverdue
                          ? "text-red-700"
                          : "text-gray-700"
                      }`}
                    >
                      {formatDateValue(
                        task.due_date
                      ) || "Не вказано"}
                      {isOverdue
                        ? " · Прострочено"
                        : ""}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-gray-400">
                      Відповідальний
                    </dt>
                    <dd className="mt-1 break-words font-medium text-gray-700">
                      {task.assignee ||
                        "Не призначено"}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}

      {page.total > page.items.length && (
        <p className="text-xs leading-5 text-gray-500">
          Показано {page.items.length} із {page.total}. Повний список доступний у розділі завдань.
        </p>
      )}
    </section>
  );
}
