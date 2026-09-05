"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useMemo,
  useState,
} from "react";

import {
  deleteEmployee,
} from "@/app/actions/employeeActions";
import {
  loadEmployeeActorHistoryPage,
  loadEmployeeChangesPage,
  loadEmployeeEquipmentPage,
  loadEmployeeObjectsPage,
  loadEmployeeTasksPage,
  loadEmployeeWorkLogsPage,
} from "@/app/actions/employeeProfileActions";
import ActivityTimelineList from "@/components/activity/ActivityTimelineList";
import RecurringTaskBadge from "@/components/tasks/RecurringTaskBadge";
import {
  evaluateEquipmentMaintenance,
  getEquipmentMaintenanceOverallKind,
  getEquipmentMaintenanceOverallLabel,
} from "@/lib/equipmentMaintenance";
import {
  formatDateValue,
} from "@/lib/kyivDate";
import {
  getObjectSupervisionState,
} from "@/lib/objectSupervision";

import type {
  ActivityLog,
} from "@/types/activityLog";
import type {
  EmployeeDetails,
  ManagementEmployee,
} from "@/types/employee";
import type {
  EmployeeActivityPage,
  EmployeeActor,
  EmployeeEquipmentPage,
  EmployeeObjectPage,
  EmployeeProfileKpis,
  EmployeeSupervisionPreview,
  EmployeeTaskPage,
  EmployeeWorkLogPage,
} from "@/types/employeeProfile";
import type {
  Equipment,
} from "@/types/equipment";
import type {
  ObjectItem,
} from "@/types/object";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";

import {
  EditEmployeeForm,
} from "./EditEmployeeForm";

type EmployeeTabId =
  | "overview"
  | "tasks"
  | "work"
  | "objects"
  | "equipment"
  | "history";

type PageKind =
  | "tasks"
  | "work"
  | "objects"
  | "equipment"
  | "changes"
  | "actions";

type Props = {
  employee: EmployeeDetails;
  hourlyRate: number | null;
  isAdmin: boolean;
  today: string;
  kpis: EmployeeProfileKpis;
  taskPreview: TaskWithObject[];
  workLogPreview: EmployeeWorkLogPage["items"];
  supervisionPreview: EmployeeSupervisionPreview[];
  initialTasksPage: EmployeeTaskPage;
  initialWorkLogsPage: EmployeeWorkLogPage;
  initialObjectsPage: EmployeeObjectPage;
  initialEquipmentPage: EmployeeEquipmentPage;
  initialChangesPage: EmployeeActivityPage;
  initialActorHistoryPage: EmployeeActivityPage;
  linkedActors: EmployeeActor[];
};

const tabs: Array<{
  id: EmployeeTabId;
  label: string;
  icon: string;
}> = [
  {
    id: "overview",
    label: "Огляд",
    icon: "◉",
  },
  {
    id: "tasks",
    label: "Завдання",
    icon: "✓",
  },
  {
    id: "work",
    label: "Роботи",
    icon: "📝",
  },
  {
    id: "objects",
    label: "Об’єкти",
    icon: "🏡",
  },
  {
    id: "equipment",
    label: "Техніка",
    icon: "🛠",
  },
  {
    id: "history",
    label: "Історія",
    icon: "🕘",
  },
];

function formatDate(
  value: string | null
) {
  return (
    formatDateValue(value) ||
    "Не вказано"
  );
}

function formatHours(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 1,
    }
  ).format(value);
}

function formatRate(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function getInitials(
  employee: EmployeeDetails
) {
  return `${employee.first_name.charAt(
    0
  )}${employee.last_name.charAt(
    0
  )}`.toLocaleUpperCase(
    "uk-UA"
  );
}

function getEmployeeStatusClasses(
  status: string
) {
  switch (status) {
    case "Активний":
      return "bg-green-50 text-green-700";
    case "У відпустці":
      return "bg-blue-50 text-blue-700";
    case "На лікарняному":
      return "bg-orange-50 text-orange-700";
    case "Неактивний":
      return "bg-red-50 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getTaskStatusClasses(
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

function getTaskSourceLabel(
  task: TaskWithObject
) {
  switch (task.task_source) {
    case "supervision":
      return "Періодичний огляд";
    case "equipment_maintenance":
      return "ТО техніки";
    default:
      return "Ручне завдання";
  }
}

function getSupervisionLabel(
  object: Pick<
    ObjectItem,
    "next_supervision_date"
  >,
  today: string
) {
  const state =
    getObjectSupervisionState(
      object.next_supervision_date,
      today
    );

  switch (state.kind) {
    case "today":
      return "Огляд сьогодні";
    case "overdue":
      return `Огляд прострочено на ${state.overdueDays} дн.`;
    case "planned":
      return `Наступний огляд: ${formatDate(
        object.next_supervision_date
      )}`;
    default:
      return "Огляд не заплановано";
  }
}

function getSupervisionClasses(
  object: Pick<
    ObjectItem,
    "next_supervision_date"
  >,
  today: string
) {
  const state =
    getObjectSupervisionState(
      object.next_supervision_date,
      today
    );

  if (state.kind === "overdue") {
    return "bg-red-50 text-red-700";
  }

  if (state.kind === "today") {
    return "bg-orange-50 text-orange-700";
  }

  if (state.kind === "planned") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-gray-100 text-gray-600";
}

function getMaintenanceClasses(
  equipment: Equipment,
  today: string
) {
  const evaluation =
    evaluateEquipmentMaintenance(
      equipment,
      today
    );
  const kind =
    getEquipmentMaintenanceOverallKind(
      evaluation
    );

  if (kind === "overdue") {
    return "bg-red-50 text-red-700";
  }

  if (
    kind === "due" ||
    kind === "today"
  ) {
    return "bg-orange-50 text-orange-700";
  }

  if (kind === "scheduled") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-gray-100 text-gray-600";
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-6 text-center">
      <p className="font-medium text-gray-700">
        {title}
      </p>

      {description && (
        <p className="mt-1 text-sm leading-5 text-gray-500">
          {description}
        </p>
      )}
    </div>
  );
}

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isLoading: boolean;
  error?: string;
  onPageChange: (
    page: number
  ) => void;
};

function EmployeePagination({
  page,
  pageSize,
  total,
  hasPreviousPage,
  hasNextPage,
  isLoading,
  error,
  onPageChange,
}: PaginationProps) {
  if (
    !hasPreviousPage &&
    !hasNextPage &&
    !error
  ) {
    return null;
  }

  const firstItemIndex =
    (page - 1) * pageSize;
  const hasVisibleItems =
    total > 0 &&
    firstItemIndex < total;
  const from = hasVisibleItems
    ? firstItemIndex + 1
    : 0;
  const to = hasVisibleItems
    ? Math.min(
        page * pageSize,
        total
      )
    : 0;

  return (
    <div className="mt-4 min-w-0 space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <nav
        aria-label="Сторінки профілю працівника"
        className="flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-center text-xs text-gray-500 sm:text-left sm:text-sm">
          {hasVisibleItems
            ? `Показано ${from}–${to} із ${total}`
            : "На цій сторінці записів немає"}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            disabled={
              !hasPreviousPage ||
              isLoading
            }
            onClick={() =>
              onPageChange(
                page - 1
              )
            }
            className="min-h-10 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Назад
          </button>

          <button
            type="button"
            disabled={
              !hasNextPage ||
              isLoading
            }
            onClick={() =>
              onPageChange(
                page + 1
              )
            }
            className="min-h-10 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading
              ? "Завантаження…"
              : "Далі →"}
          </button>
        </div>
      </nav>
    </div>
  );
}

function TaskCards({
  tasks,
  compact = false,
}: {
  tasks: TaskWithObject[];
  compact?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState title="Завдань немає" />
    );
  }

  return (
    <div
      className={`grid min-w-0 grid-cols-1 gap-3 ${
        compact
          ? ""
          : "xl:grid-cols-2"
      }`}
    >
      {tasks.map((task) => (
        <article
          key={task.id}
          className="min-w-0 rounded-xl border bg-white p-4"
        >
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="break-words font-semibold text-gray-900">
                {task.title}
              </h3>

              <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </span>

                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {getTaskSourceLabel(
                    task
                  )}
                </span>

                {task.task_template_id !==
                  null && (
                  <RecurringTaskBadge compact />
                )}
              </div>
            </div>

            <span
              className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getTaskStatusClasses(
                task.status
              )}`}
            >
              {task.status}
            </span>
          </div>

          {task.description &&
            !compact && (
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-gray-600">
              {task.description}
            </p>
          )}

          <div className="mt-4 flex min-w-0 flex-col gap-1.5 border-t pt-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
            <p className="text-gray-500">
              Термін:{" "}
              <span className="font-medium text-gray-700">
                {formatDate(
                  task.due_date
                )}
              </span>
            </p>

            {task.object ? (
              <Link
                href={`/objects/${task.object.id}`}
                className="w-fit break-words font-medium text-green-700 hover:underline"
              >
                {task.object.name}
              </Link>
            ) : task.equipment ? (
              <Link
                href="/equipment"
                className="w-fit break-words font-medium text-green-700 hover:underline"
              >
                {task.equipment.name}
              </Link>
            ) : (
              <span className="text-gray-400">
                Ціль не вказано
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function WorkLogCards({
  workLogs,
}: {
  workLogs: EmployeeWorkLogPage["items"];
}) {
  if (workLogs.length === 0) {
    return (
      <EmptyState title="Записів про роботи немає" />
    );
  }

  return (
    <div className="space-y-3">
      {workLogs.map((workLog) => (
        <article
          key={workLog.id}
          className="min-w-0 rounded-xl border bg-white p-4"
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {formatDate(
                  workLog.work_date
                )}
              </p>

              {workLog.object ? (
                <Link
                  href={`/objects/${workLog.object.id}`}
                  className="mt-1 inline-block break-words text-sm font-medium text-green-700 hover:underline"
                >
                  {workLog.object.name}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-gray-400">
                  Об’єкт не знайдено
                </p>
              )}
            </div>

            <span className="w-fit shrink-0 rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
              {formatHours(
                Number(
                  workLog.hours || 0
                )
              )}{" "}
              год.
            </span>
          </div>

          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
            {workLog.description}
          </p>
        </article>
      ))}
    </div>
  );
}

function ObjectCards({
  objects,
  today,
}: {
  objects: ObjectItem[];
  today: string;
}) {
  if (objects.length === 0) {
    return (
      <EmptyState title="Закріплених об’єктів немає" />
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
      {objects.map((object) => (
        <Link
          key={object.id}
          href={`/objects/${object.id}`}
          className="min-w-0 rounded-xl border bg-white p-4 transition hover:border-green-200 hover:bg-green-50/40"
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="break-words font-semibold text-gray-900">
              {object.name}
            </h3>

            <span className="w-fit shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {object.status}
            </span>
          </div>

          <p className="mt-2 break-words text-sm text-gray-500">
            {object.address ||
              "Адресу не вказано"}
          </p>

          <span
            className={`mt-3 inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-medium ${getSupervisionClasses(
              object,
              today
            )}`}
          >
            <span className="truncate">
              {getSupervisionLabel(
                object,
                today
              )}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function EquipmentCards({
  equipment,
  today,
}: {
  equipment: Equipment[];
  today: string;
}) {
  if (equipment.length === 0) {
    return (
      <EmptyState title="Закріпленої техніки немає" />
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
      {equipment.map((item) => {
        const evaluation =
          evaluateEquipmentMaintenance(
            item,
            today
          );

        return (
          <article
            key={item.id}
            className="min-w-0 rounded-xl border bg-white p-4"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-semibold text-gray-900">
                  {item.name}
                </h3>

                <p className="mt-1 break-all text-sm text-gray-500">
                  {item.inventory_number ||
                    "Інвентарний номер не вказано"}
                </p>
              </div>

              <span className="w-fit shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {item.status}
              </span>
            </div>

            <div className="mt-3 flex min-w-0 flex-wrap gap-2 border-t pt-3">
              <span
                className={`max-w-full rounded-full px-2.5 py-1 text-xs font-medium ${getMaintenanceClasses(
                  item,
                  today
                )}`}
              >
                {getEquipmentMaintenanceOverallLabel(
                  evaluation
                )}
              </span>

              {item.location && (
                <span className="max-w-full truncate rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                  {item.location}
                </span>
              )}
            </div>

            <Link
              href="/equipment"
              className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-green-700 hover:underline"
            >
              Відкрити техніку →
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-sm leading-5 text-gray-500">
          {description}
        </p>
      )}
    </div>
  );
}

export default function EmployeePassport({
  employee,
  hourlyRate,
  isAdmin,
  today,
  kpis,
  taskPreview,
  workLogPreview,
  supervisionPreview,
  initialTasksPage,
  initialWorkLogsPage,
  initialObjectsPage,
  initialEquipmentPage,
  initialChangesPage,
  initialActorHistoryPage,
  linkedActors,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] =
    useState<EmployeeTabId>(
      "overview"
    );
  const [isEditing, setIsEditing] =
    useState(false);
  const [showDelete, setShowDelete] =
    useState(false);
  const [isDeleting, setIsDeleting] =
    useState(false);
  const [deleteError, setDeleteError] =
    useState("");
  const [loadingPage, setLoadingPage] =
    useState<PageKind | null>(null);
  const [pageErrors, setPageErrors] =
    useState<Partial<Record<PageKind, string>>>(
      {}
    );
  const [tasksPage, setTasksPage] =
    useState(initialTasksPage);
  const [workLogsPage, setWorkLogsPage] =
    useState(initialWorkLogsPage);
  const [objectsPage, setObjectsPage] =
    useState(initialObjectsPage);
  const [equipmentPage, setEquipmentPage] =
    useState(initialEquipmentPage);
  const [changesPage, setChangesPage] =
    useState(initialChangesPage);
  const [actorHistoryPage, setActorHistoryPage] =
    useState(initialActorHistoryPage);

  const employeeName = `${employee.last_name} ${employee.first_name}`;
  const editableEmployee =
    useMemo<ManagementEmployee>(
      () => ({
        ...employee,
        hourly_rate:
          hourlyRate ?? 0,
      }),
      [employee, hourlyRate]
    );
  const existingObjectIds =
    useMemo(
      () =>
        objectsPage.items.map(
          (object) => object.id
        ),
      [objectsPage.items]
    );
  const recentActivity =
    useMemo(() => {
      const logsById = new Map<
        number,
        ActivityLog
      >();

      for (const log of [
        ...initialChangesPage.items,
        ...initialActorHistoryPage.items,
      ]) {
        logsById.set(log.id, log);
      }

      return Array.from(
        logsById.values()
      )
        .sort((first, second) => {
          const timestampOrder =
            second.created_at.localeCompare(
              first.created_at
            );

          return timestampOrder !== 0
            ? timestampOrder
            : second.id - first.id;
        })
        .slice(0, 3);
    }, [
      initialActorHistoryPage.items,
      initialChangesPage.items,
    ]);

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteEmployee(
        employee.id
      );
      router.push("/employees");
      router.refresh();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити працівника."
      );
      setIsDeleting(false);
    }
  }

  async function handlePageChange(
    kind: PageKind,
    page: number
  ) {
    if (
      loadingPage ||
      page < 1
    ) {
      return;
    }

    setLoadingPage(kind);
    setPageErrors((current) => ({
      ...current,
      [kind]: "",
    }));

    try {
      switch (kind) {
        case "tasks":
          setTasksPage(
            await loadEmployeeTasksPage(
              employee.id,
              page
            )
          );
          break;
        case "work":
          setWorkLogsPage(
            await loadEmployeeWorkLogsPage(
              employee.id,
              page
            )
          );
          break;
        case "objects":
          setObjectsPage(
            await loadEmployeeObjectsPage(
              employee.id,
              page
            )
          );
          break;
        case "equipment":
          setEquipmentPage(
            await loadEmployeeEquipmentPage(
              employee.id,
              page
            )
          );
          break;
        case "changes":
          setChangesPage(
            await loadEmployeeChangesPage(
              employee.id,
              page
            )
          );
          break;
        case "actions":
          setActorHistoryPage(
            await loadEmployeeActorHistoryPage(
              employee.id,
              page
            )
          );
          break;
      }
    } catch (error) {
      setPageErrors((current) => ({
        ...current,
        [kind]:
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити сторінку.",
      }));
    } finally {
      setLoadingPage(null);
    }
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Link
        href="/employees"
        className="inline-flex min-h-10 items-center text-sm font-medium text-green-700 hover:underline"
      >
        ← Назад до працівників
      </Link>

      <header className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
        <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-700 sm:h-16 sm:w-16 sm:text-xl">
              {getInitials(employee)}
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">
                  {employeeName}
                </h1>

                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${getEmployeeStatusClasses(
                    employee.status
                  )}`}
                >
                  {employee.status}
                </span>
              </div>

              <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
                {employee.position ||
                  "Посаду не вказано"}
                <span aria-hidden="true">
                  {" · "}
                </span>
                {employee.employment_type}
              </p>

              <div className="mt-3 flex min-w-0 flex-col gap-1.5 text-sm text-gray-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
                <span className="break-all">
                  {employee.phone ||
                    "Телефон не вказано"}
                </span>
                <span className="break-all">
                  {employee.email ||
                    "Email не вказано"}
                </span>
                <span>
                  Працює з:{" "}
                  {formatDate(
                    employee.hire_date
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap xl:justify-end">
            {employee.phone ? (
              <a
                href={`tel:${employee.phone}`}
                className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Зателефонувати
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-400">
                Немає телефону
              </span>
            )}

            {employee.email ? (
              <a
                href={`mailto:${employee.email}`}
                className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Написати
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-400">
                Немає email
              </span>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setIsEditing(
                      (current) =>
                        !current
                    )
                  }
                  className="min-h-11 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  {isEditing
                    ? "Закрити"
                    : "Редагувати"}
                </button>

                <details className="relative min-w-0">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                    Ще
                  </summary>

                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setShowDelete(true);
                      }}
                      className="min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Видалити працівника
                    </button>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      </header>

      {isAdmin && isEditing && (
        <section className="min-w-0 rounded-2xl border bg-white p-3 sm:p-5">
          <SectionHeader
            title="Редагування працівника"
            description="Зміни застосовуються до профілю та нових операційних записів."
          />

          <div className="mt-4">
            <EditEmployeeForm
              employee={
                editableEmployee
              }
              onSaved={() =>
                router.refresh()
              }
              onCancel={() =>
                setIsEditing(false)
              }
            />
          </div>
        </section>
      )}

      <nav
        aria-label="Розділи паспорта працівника"
        className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        <div
          role="tablist"
          className="flex min-w-max gap-2"
        >
          {tabs.map((tab) => {
            const isActive =
              activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={
                  isActive
                }
                aria-controls={`employee-tab-${tab.id}`}
                onClick={() =>
                  setActiveTab(
                    tab.id
                  )
                }
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  isActive
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span aria-hidden="true">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div
        id={`employee-tab-${activeTab}`}
        role="tabpanel"
        className="min-w-0"
      >
        {activeTab === "overview" && (
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
              {[
                {
                  label: "Активні",
                  value: kpis.activeTasks,
                  className:
                    "text-blue-700",
                },
                {
                  label: "Прострочені",
                  value: kpis.overdueTasks,
                  className:
                    kpis.overdueTasks > 0
                      ? "text-red-700"
                      : "text-gray-900",
                },
                {
                  label: "Виконані",
                  value: kpis.completedTasks,
                  className:
                    "text-green-700",
                },
                {
                  label: "Годин цього місяця",
                  value: formatHours(
                    kpis.monthlyHours
                  ),
                  className:
                    "text-purple-700",
                },
                {
                  label: "Годин загалом",
                  value: formatHours(
                    kpis.lifetimeHours
                  ),
                  className:
                    "text-purple-700",
                },
                {
                  label: "Об’єкти",
                  value: kpis.objects,
                  className:
                    "text-gray-900",
                },
                {
                  label: "Техніка",
                  value: kpis.equipment,
                  className:
                    "text-orange-700",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 rounded-xl border bg-white p-3 sm:p-4"
                >
                  <p className="text-xs leading-4 text-gray-500">
                    {item.label}
                  </p>
                  <p
                    className={`mt-2 break-words text-2xl font-bold ${item.className}`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
                <SectionHeader
                  title="Найближчі завдання"
                  description="До п’яти активних завдань із найближчим терміном."
                />
                <div className="mt-4">
                  <TaskCards
                    tasks={taskPreview}
                    compact
                  />
                </div>
              </div>

              <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
                <SectionHeader
                  title="Останні роботи"
                  description="Три останні записи журналу робіт."
                />
                <div className="mt-4">
                  <WorkLogCards
                    workLogs={
                      workLogPreview
                    }
                  />
                </div>
              </div>
            </section>

            <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
                <SectionHeader
                  title="Відповідальність за огляди"
                  description="Об’єкти з налаштованим періодичним наглядом."
                />

                <div className="mt-4 space-y-2">
                  {supervisionPreview.length ===
                  0 ? (
                    <EmptyState title="Огляди не закріплені" />
                  ) : (
                    supervisionPreview.map(
                      (object) => (
                        <Link
                          key={object.id}
                          href={`/objects/${object.id}`}
                          className="flex min-w-0 flex-col gap-2 rounded-xl border p-3 transition hover:border-green-200 hover:bg-green-50/40 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="min-w-0 break-words font-medium text-gray-800">
                            {object.name}
                          </span>
                          <span
                            className={`w-fit max-w-full shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getSupervisionClasses(
                              object,
                              today
                            )}`}
                          >
                            {getSupervisionLabel(
                              object,
                              today
                            )}
                          </span>
                        </Link>
                      )
                    )
                  )}
                </div>
              </div>

              <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
                <SectionHeader
                  title="Остання активність"
                  description="Останні зміни профілю та дії пов’язаного акаунта."
                />

                <div className="mt-4">
                  {recentActivity.length ===
                  0 ? (
                    <EmptyState title="Активності поки немає" />
                  ) : (
                    <ActivityTimelineList
                      logs={recentActivity}
                      existingObjectIds={
                        existingObjectIds
                      }
                      compact
                    />
                  )}
                </div>
              </div>
            </section>

            {(employee.notes ||
              isAdmin) && (
              <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                {employee.notes && (
                  <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Примітки
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
                      {employee.notes}
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                      Дані адміністратора
                    </p>
                    <p className="mt-2 text-sm text-blue-700">
                      Погодинна ставка
                    </p>
                    <p className="mt-1 break-words text-xl font-bold text-blue-900">
                      {formatRate(
                        hourlyRate ?? 0
                      )}
                      <span className="ml-1 text-sm font-medium text-blue-700">
                        / год.
                      </span>
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <section className="min-w-0 space-y-4">
            <SectionHeader
              title="Завдання працівника"
              description="Повна історія разових та автоматичних завдань у режимі перегляду."
            />
            <TaskCards
              tasks={tasksPage.items}
            />
            <EmployeePagination
              {...tasksPage}
              isLoading={
                loadingPage ===
                "tasks"
              }
              error={
                pageErrors.tasks
              }
              onPageChange={(page) =>
                handlePageChange(
                  "tasks",
                  page
                )
              }
            />
          </section>
        )}

        {activeTab === "work" && (
          <section className="min-w-0 space-y-4">
            <SectionHeader
              title="Журнал робіт"
              description="Роботи працівника на об’єктах без фінансових ставок і розрахунків."
            />
            <WorkLogCards
              workLogs={
                workLogsPage.items
              }
            />
            <EmployeePagination
              {...workLogsPage}
              isLoading={
                loadingPage ===
                "work"
              }
              error={
                pageErrors.work
              }
              onPageChange={(page) =>
                handlePageChange(
                  "work",
                  page
                )
              }
            />
          </section>
        )}

        {activeTab === "objects" && (
          <section className="min-w-0 space-y-4">
            <SectionHeader
              title="Закріплені об’єкти"
              description="Об’єкти, де працівник вказаний відповідальним. Фінансові дані тут не показуються."
            />
            <ObjectCards
              objects={
                objectsPage.items
              }
              today={today}
            />
            <EmployeePagination
              {...objectsPage}
              isLoading={
                loadingPage ===
                "objects"
              }
              error={
                pageErrors.objects
              }
              onPageChange={(page) =>
                handlePageChange(
                  "objects",
                  page
                )
              }
            />
          </section>
        )}

        {activeTab === "equipment" && (
          <section className="min-w-0 space-y-4">
            <SectionHeader
              title="Закріплена техніка"
              description="Стан техніки та планового обслуговування."
            />
            <EquipmentCards
              equipment={
                equipmentPage.items
              }
              today={today}
            />
            <EmployeePagination
              {...equipmentPage}
              isLoading={
                loadingPage ===
                "equipment"
              }
              error={
                pageErrors.equipment
              }
              onPageChange={(page) =>
                handlePageChange(
                  "equipment",
                  page
                )
              }
            />
          </section>
        )}

        {activeTab === "history" && (
          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="min-w-0 space-y-4">
              <SectionHeader
                title="Зміни працівника"
                description="Створення, редагування та інші зміни самого профілю."
              />

              {changesPage.items.length ===
              0 ? (
                <EmptyState title="Змін профілю поки немає" />
              ) : (
                <ActivityTimelineList
                  logs={
                    changesPage.items
                  }
                  existingObjectIds={
                    existingObjectIds
                  }
                  compact
                />
              )}

              <EmployeePagination
                {...changesPage}
                isLoading={
                  loadingPage ===
                  "changes"
                }
                error={
                  pageErrors.changes
                }
                onPageChange={(page) =>
                  handlePageChange(
                    "changes",
                    page
                  )
                }
              />
            </section>

            <section className="min-w-0 space-y-4">
              <SectionHeader
                title="Дії працівника"
                description="Бізнес-дії, виконані пов’язаним користувацьким акаунтом."
              />

              {linkedActors.length ===
              0 ? (
                <EmptyState
                  title="Акаунт не прив’язано"
                  description="Для цього працівника немає пов’язаного профілю користувача."
                />
              ) : actorHistoryPage.items.length ===
                0 ? (
                <EmptyState title="Дій поки немає" />
              ) : (
                <ActivityTimelineList
                  logs={
                    actorHistoryPage.items
                  }
                  existingObjectIds={
                    existingObjectIds
                  }
                  compact
                />
              )}

              {linkedActors.length > 0 && (
                <EmployeePagination
                  {...actorHistoryPage}
                  isLoading={
                    loadingPage ===
                    "actions"
                  }
                  error={
                    pageErrors.actions
                  }
                  onPageChange={(page) =>
                    handlePageChange(
                      "actions",
                      page
                    )
                  }
                />
              )}
            </section>
          </div>
        )}
      </div>

      {showDelete && isAdmin && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-employee-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <h2
              id="delete-employee-title"
              className="text-lg font-semibold text-gray-900"
            >
              Видалити працівника?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Працівника «{employeeName}» буде видалено. Якщо запис використовується в інших розділах, база даних може заборонити цю дію.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {deleteError}
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setShowDelete(false)
                }
                className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Скасувати
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting
                  ? "Видалення…"
                  : "Видалити"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
