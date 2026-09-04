"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";

import {
  deleteObjectTask,
  updateTaskDueDate,
  updateTaskStatus,
} from "@/app/actions/taskActions";

import EditTaskForm from "@/components/objects/EditTaskForm";
import RescheduleTaskButton from "@/components/dashboard/RescheduleTaskButton";
import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import EquipmentMaintenanceTaskBadge from "@/components/tasks/EquipmentMaintenanceTaskBadge";
import RecurringTaskBadge from "@/components/tasks/RecurringTaskBadge";
import SupervisionTaskBadge from "@/components/tasks/SupervisionTaskBadge";
import {
  EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE,
  EQUIPMENT_MAINTENANCE_TASK_SOURCE,
  SUPERVISION_TASK_MANAGED_MESSAGE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import { getTaskTarget } from "@/lib/taskTarget";
import {
  useMediaQuery,
} from "@/lib/useMediaQuery";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";

type Props = {
  tasks: TaskWithObject[];
  employees: Employee[];
  objects: ObjectItem[];
  equipment: Equipment[];
  canManageSupervision: boolean;
  canManageEquipment: boolean;
};

type TaskCardProps = {
  task: TaskWithObject;
  employeesById: Map<number, Employee>;
  isUpdating: boolean;
  isMoving: boolean;
  canDrag: boolean;
  canUseQuickAction: boolean;
  onOpen: () => void;
  onDragStart: (
    event: DragEvent<HTMLElement>
  ) => void;
  onDragEnd: () => void;
  onQuickStatus: (
    event: MouseEvent<HTMLButtonElement>
  ) => void;
};

const NO_DATE_DROP_TARGET =
  "__NO_DATE__";

const weekDays = [
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "П’ятниця",
  "Субота",
  "Неділя",
];

function formatInputDate(
  date: Date
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonday(
  date: Date
) {
  const result =
    new Date(date);

  const day =
    result.getDay();

  const difference =
    result.getDate() -
    day +
    (day === 0 ? -6 : 1);

  result.setDate(
    difference
  );

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function addDays(
  date: Date,
  days: number
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() +
      days
  );

  return result;
}

function formatDayDate(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
    }
  ).format(date);
}

function formatFullDate(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatSelectedDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(
      `${date}T00:00:00`
    )
  );
}

function getStatusClasses(
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

function getPriorityClasses(
  priority: string
) {
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

function getPriorityBorderClasses(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return "border-l-4 border-l-red-500";

    case "Високий":
      return "border-l-4 border-l-orange-500";

    case "Середній":
      return "border-l-4 border-l-violet-400";

    case "Низький":
      return "border-l-4 border-l-gray-300";

    default:
      return "border-l-4 border-l-violet-400";
  }
}

function getPriorityOrder(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return 1;

    case "Високий":
      return 2;

    case "Середній":
      return 3;

    case "Низький":
      return 4;

    default:
      return 3;
  }
}

function sortCalendarTasks(
  firstTask: TaskWithObject,
  secondTask: TaskWithObject
) {
  const firstCompleted =
    firstTask.status ===
    "Виконано";

  const secondCompleted =
    secondTask.status ===
    "Виконано";

  if (
    firstCompleted !==
    secondCompleted
  ) {
    return firstCompleted
      ? 1
      : -1;
  }

  const priorityDifference =
    getPriorityOrder(
      firstTask.priority ||
        "Середній"
    ) -
    getPriorityOrder(
      secondTask.priority ||
        "Середній"
    );

  if (
    priorityDifference !==
    0
  ) {
    return priorityDifference;
  }

  return firstTask.title.localeCompare(
    secondTask.title,
    "uk"
  );
}

function getEmployeeName(
  task: TaskWithObject,
  employeesById: Map<
    number,
    Employee
  >
) {
  if (
    task.assigned_employee_id
  ) {
    const employee =
      employeesById.get(
        Number(
          task.assigned_employee_id
        )
      );

    if (employee) {
      return `${employee.last_name} ${employee.first_name}`;
    }
  }

  return (
    task.assignee ||
    "Не призначено"
  );
}

function TaskCard({
  task,
  employeesById,
  isUpdating,
  isMoving,
  canDrag,
  canUseQuickAction,
  onOpen,
  onDragStart,
  onDragEnd,
  onQuickStatus,
}: TaskCardProps) {
  const priority =
    task.priority ||
    "Середній";

  const isCompleted =
    task.status ===
    "Виконано";

  const isSupervisionTask =
    task.task_source ===
    SUPERVISION_TASK_SOURCE;
  const isMaintenanceTask =
    task.task_source ===
    EQUIPMENT_MAINTENANCE_TASK_SOURCE;
  const target = getTaskTarget(task);

  return (
    <article
      role="button"
      tabIndex={0}
      draggable={
        canDrag &&
        !isMoving
      }
      onDragStart={
        onDragStart
      }
      onDragEnd={
        onDragEnd
      }
      onClick={
        onOpen
      }
      onKeyDown={(
        event
      ) => {
        if (
          event.key ===
            "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();

          onOpen();
        }
      }}
      className={`min-w-0 cursor-pointer rounded-xl border p-3 transition hover:border-green-300 md:cursor-grab md:active:cursor-grabbing ${getPriorityBorderClasses(
        priority
      )} ${
        isCompleted
          ? "bg-green-50/40 opacity-75"
          : "bg-white hover:bg-green-50"
      } ${
        isMoving
          ? "scale-95 opacity-30"
          : ""
      }`}
    >
      {/* TITLE */}
      <div className="flex min-w-0 items-start gap-2">
        {canDrag && (
          <span
            title="Перетягни завдання"
            className="mt-0.5 hidden shrink-0 select-none text-sm text-gray-400 md:block"
          >
            ⋮⋮
          </span>
        )}

        {isCompleted && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
            ✓
          </span>
        )}

        <h3
          className={`min-w-0 break-words text-sm font-semibold ${
            isCompleted
              ? "text-gray-500 line-through"
              : "text-gray-900"
          }`}
        >
          {task.title}
        </h3>
      </div>

      {/* BADGES */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {isSupervisionTask && (
          <SupervisionTaskBadge compact />
        )}
        {isMaintenanceTask && (
          <EquipmentMaintenanceTaskBadge compact />
        )}
        {task.task_template_id !== null && (
          <RecurringTaskBadge compact />
        )}

        <span
          className={`rounded-full px-2 py-1 text-[10px] font-medium ${
            isCompleted
              ? "bg-gray-100 text-gray-500"
              : getPriorityClasses(
                  priority
                )
          }`}
        >
          {priority}
        </span>

        <span
          className={`rounded-full px-2 py-1 text-[10px] font-medium ${getStatusClasses(
            task.status
          )}`}
        >
          {isCompleted
            ? "✓ Виконано"
            : task.status}
        </span>
      </div>

      {/* TARGET */}
      {target && (
        <Link
          href={target.href}
          draggable={false}
          onPointerDown={(
            event
          ) =>
            event.stopPropagation()
          }
          onClick={(
            event
          ) =>
            event.stopPropagation()
          }
          className={`mt-3 block break-words text-xs font-medium hover:underline ${
            isCompleted
              ? "text-gray-400"
              : "text-green-700"
          }`}
        >
          {target.type === "equipment" ? "🔧" : "📍"} {target.name}
        </Link>
      )}

      {/* EMPLOYEE */}
      <p className="mt-2 break-words text-xs text-gray-500">
        {getEmployeeName(
          task,
          employeesById
        )}
      </p>

      {/* DESCRIPTION */}
      {task.description && (
        <p
          className={`mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 ${
            isCompleted
              ? "text-gray-400"
              : "text-gray-600"
          }`}
        >
          {
            task.description
          }
        </p>
      )}

      {/* QUICK STATUS */}
      <button
        type="button"
        draggable={false}
        disabled={
          isUpdating ||
          isMoving ||
          !canUseQuickAction
        }
        onPointerDown={(
          event
        ) => {
          event.stopPropagation();
        }}
        onMouseDown={(
          event
        ) => {
          event.stopPropagation();
        }}
        onDragStart={(
          event
        ) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={
          onQuickStatus
        }
        onKeyDown={(
          event
        ) => {
          event.stopPropagation();
        }}
        className={`mt-3 min-h-10 w-full rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isCompleted
            ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
        }`}
      >
        {isUpdating
          ? "Збереження..."
          : isCompleted
            ? "↩ Повернути в роботу"
            : "✓ Виконано"}
      </button>

      <p className="mt-3 border-t pt-2 text-[11px] text-gray-400">
        {isSupervisionTask
          ? "Натисни картку, щоб відкрити деталі"
          : isMaintenanceTask
            ? "Автоматичне завдання планового ТО"
          : "Натисни картку, щоб редагувати"}
      </p>
    </article>
  );
}

export default function WeeklyTaskCalendar({
  tasks,
  employees,
  objects,
  equipment,
  canManageSupervision,
  canManageEquipment,
}: Props) {
  const router =
    useRouter();

  const [
    localTasks,
    setLocalTasks,
  ] =
    useState<TaskWithObject[]>(
      tasks
    );

  const [
    previousTasks,
    setPreviousTasks,
  ] = useState(tasks);

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    new Date()
  );

  const [
    selectedTaskDate,
    setSelectedTaskDate,
  ] = useState<
    string | null
  >(null);

  const [
    selectedTask,
    setSelectedTask,
  ] =
    useState<TaskWithObject | null>(
      null
    );

  const [
    employeeFilter,
    setEmployeeFilter,
  ] = useState("Усі");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("Усі");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState("Усі");

  const [
    showOnlyActive,
    setShowOnlyActive,
  ] = useState(false);

  const [
    deletingTaskId,
    setDeletingTaskId,
  ] = useState<
    number | null
  >(null);

  const [
    updatingTaskId,
    setUpdatingTaskId,
  ] = useState<
    number | null
  >(null);

  const [
    movingTaskId,
    setMovingTaskId,
  ] = useState<
    number | null
  >(null);

  const [
    draggedTaskId,
    setDraggedTaskId,
  ] = useState<
    number | null
  >(null);

  const [
    dragOverTarget,
    setDragOverTarget,
  ] = useState<
    string | null
  >(null);

  const [
    deleteErrorMessage,
    setDeleteErrorMessage,
  ] = useState("");

  const [
    quickActionError,
    setQuickActionError,
  ] = useState("");

  const canDrag =
    useMediaQuery(
      "(min-width: 768px)"
    );

  const draggedTaskIdRef =
    useRef<
      number | null
    >(null);

  const ignoreTaskClickRef =
    useRef(false);

  if (tasks !== previousTasks) {
    setPreviousTasks(tasks);
    setLocalTasks(
      tasks
    );
  }

  // Блокуємо сторінку позаду
  // відкритого popup.
  useEffect(() => {
    const isModalOpen =
      Boolean(
        selectedTaskDate ||
          selectedTask
      );

    if (!isModalOpen) {
      document.body.style.overflow =
        "";

      return;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [
    selectedTaskDate,
    selectedTask,
  ]);

  const weekStart =
    useMemo(
      () =>
        getMonday(
          selectedDate
        ),
      [selectedDate]
    );

  const weekDates =
    useMemo(
      () =>
        Array.from(
          {
            length: 7,
          },
          (
            _,
            index
          ) =>
            addDays(
              weekStart,
              index
            )
        ),
      [weekStart]
    );

  const weekEnd =
    weekDates[6];

  const employeesById =
    useMemo(() => {
      return new Map(
        employees.map(
          (employee) => [
            employee.id,
            employee,
          ]
        )
      );
    }, [employees]);

  const filteredTasks =
    useMemo(() => {
      return localTasks.filter(
        (task) => {
          const matchesEmployee =
            employeeFilter ===
              "Усі" ||
            (employeeFilter ===
              "Без відповідального" &&
              !task.assigned_employee_id) ||
            String(
              task.assigned_employee_id
            ) ===
              employeeFilter;

          const priority =
            task.priority ||
            "Середній";

          const matchesStatus =
            statusFilter ===
              "Усі" ||
            task.status ===
              statusFilter;

          const matchesPriority =
            priorityFilter ===
              "Усі" ||
            priority ===
              priorityFilter;

          const matchesActive =
            !showOnlyActive ||
            task.status !==
              "Виконано";

          return (
            matchesEmployee &&
            matchesStatus &&
            matchesPriority &&
            matchesActive
          );
        }
      );
    }, [
      localTasks,
      employeeFilter,
      statusFilter,
      priorityFilter,
      showOnlyActive,
    ]);

  const tasksByDate =
    useMemo(() => {
      const result =
        new Map<
          string,
          TaskWithObject[]
        >();

      weekDates.forEach(
        (date) => {
          result.set(
            formatInputDate(
              date
            ),
            []
          );
        }
      );

      filteredTasks.forEach(
        (task) => {
          if (
            !task.due_date ||
            !result.has(
              task.due_date
            )
          ) {
            return;
          }

          result
            .get(
              task.due_date
            )
            ?.push(task);
        }
      );

      result.forEach(
        (dayTasks) => {
          dayTasks.sort(
            sortCalendarTasks
          );
        }
      );

      return result;
    }, [
      filteredTasks,
      weekDates,
    ]);

  const tasksWithoutDate =
    useMemo(() => {
      return filteredTasks
        .filter(
          (task) =>
            !task.due_date
        )
        .sort(
          sortCalendarTasks
        );
    }, [filteredTasks]);

  function openTask(
    task: TaskWithObject
  ) {
    setSelectedTaskDate(
      null
    );

    setDeleteErrorMessage(
      ""
    );

    setQuickActionError(
      ""
    );

    setSelectedTask(
      task
    );
  }

  function openAddTask(
    date: string
  ) {
    setSelectedTask(
      null
    );

    setDeleteErrorMessage(
      ""
    );

    setQuickActionError(
      ""
    );

    setSelectedTaskDate(
      date
    );
  }

  function closeEditForm() {
    setSelectedTask(
      null
    );

    setDeleteErrorMessage(
      ""
    );

    router.refresh();
  }

  function handleTaskClick(
    task: TaskWithObject
  ) {
    if (
      ignoreTaskClickRef.current
    ) {
      return;
    }

    openTask(task);
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    task: TaskWithObject
  ) {
    const isProtectedSupervision =
      task.task_source ===
        SUPERVISION_TASK_SOURCE &&
      (!canManageSupervision ||
        task.status ===
          "Виконано");
    const isProtectedMaintenance =
      task.task_source ===
        EQUIPMENT_MAINTENANCE_TASK_SOURCE &&
      (!canManageEquipment ||
        task.status === "Виконано");

    if (
      !canDrag ||
      movingTaskId !==
        null ||
      isProtectedSupervision ||
      isProtectedMaintenance
    ) {
      event.preventDefault();

      return;
    }

    draggedTaskIdRef.current =
      task.id;

    ignoreTaskClickRef.current =
      true;

    setDraggedTaskId(
      task.id
    );

    setQuickActionError(
      ""
    );

    event.dataTransfer.effectAllowed =
      "move";

    event.dataTransfer.setData(
      "text/plain",
      String(task.id)
    );
  }

  function handleDragEnd() {
    draggedTaskIdRef.current =
      null;

    setDraggedTaskId(
      null
    );

    setDragOverTarget(
      null
    );

    window.setTimeout(
      () => {
        ignoreTaskClickRef.current =
          false;
      },
      200
    );
  }

  function handleDragOver(
    event: DragEvent<HTMLElement>,
    target: string
  ) {
    if (!canDrag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect =
      "move";

    setDragOverTarget(
      target
    );
  }

  function handleDragLeave(
    event: DragEvent<HTMLElement>,
    target: string
  ) {
    if (!canDrag) {
      return;
    }

    const nextElement =
      event.relatedTarget as
        | Node
        | null;

    if (
      nextElement &&
      event.currentTarget.contains(
        nextElement
      )
    ) {
      return;
    }

    setDragOverTarget(
      (currentTarget) =>
        currentTarget ===
        target
          ? null
          : currentTarget
    );
  }

  async function handleTaskDrop(
    event: DragEvent<HTMLElement>,
    dueDate:
      | string
      | null
  ) {
    if (!canDrag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const transferredId =
      Number(
        event.dataTransfer.getData(
          "text/plain"
        )
      );

    const taskId =
      draggedTaskIdRef.current ??
      transferredId;

    const task =
      localTasks.find(
        (currentTask) =>
          currentTask.id ===
          taskId
      );

    draggedTaskIdRef.current =
      null;

    setDraggedTaskId(
      null
    );

    setDragOverTarget(
      null
    );

    if (
      !task ||
      !Number.isInteger(
        taskId
      ) ||
      movingTaskId !==
        null
    ) {
      return;
    }

    if (
      task.task_source ===
      SUPERVISION_TASK_SOURCE
    ) {
      if (!canManageSupervision) {
        setQuickActionError(
          "Дата періодичного огляду доступна для керування адміністратору або менеджеру об’єктів."
        );

        return;
      }

      if (
        task.status ===
        "Виконано"
      ) {
        setQuickActionError(
          "Завершений періодичний огляд не можна переносити."
        );

        return;
      }

      if (!dueDate) {
        setQuickActionError(
          "Автоматичний огляд повинен мати дату. Керуйте нею через об’єкт."
        );

        return;
      }
    }

    if (
      task.task_source ===
      EQUIPMENT_MAINTENANCE_TASK_SOURCE
    ) {
      if (!canManageEquipment) {
        setQuickActionError(
          "Дату планового ТО може змінювати лише адміністратор."
        );
        return;
      }
      if (task.status === "Виконано") {
        setQuickActionError("Завершене планове ТО не можна переносити.");
        return;
      }
      if (!dueDate) {
        setQuickActionError("Автоматичне ТО повинно мати дату.");
        return;
      }
    }

    const normalizedDueDate =
      dueDate || null;

    const currentDueDate =
      task.due_date ||
      null;

    if (
      currentDueDate ===
      normalizedDueDate
    ) {
      window.setTimeout(
        () => {
          ignoreTaskClickRef.current =
            false;
        },
        200
      );

      return;
    }

    setMovingTaskId(
      task.id
    );

    setQuickActionError(
      ""
    );

    setLocalTasks(
      (currentTasks) =>
        currentTasks.map(
          (currentTask) =>
            currentTask.id ===
            task.id
              ? {
                  ...currentTask,
                  due_date:
                    normalizedDueDate,
                }
              : currentTask
        )
    );

    try {
      await updateTaskDueDate(
        task.id,
        normalizedDueDate
      );
    } catch (error) {
      setLocalTasks(
        (currentTasks) =>
          currentTasks.map(
            (currentTask) =>
              currentTask.id ===
              task.id
                ? {
                    ...currentTask,
                    due_date:
                      currentDueDate,
                  }
                : currentTask
          )
      );

      setQuickActionError(
        error instanceof Error
          ? error.message
          : "Не вдалося перенести завдання."
      );
    } finally {
      setMovingTaskId(
        null
      );

      window.setTimeout(
        () => {
          ignoreTaskClickRef.current =
            false;
        },
        200
      );
    }
  }

  async function handleQuickStatusChange(
    event: MouseEvent<HTMLButtonElement>,
    task: TaskWithObject
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (
      updatingTaskId !==
        null ||
      movingTaskId !==
        null
    ) {
      return;
    }

    if (
      task.task_source ===
      SUPERVISION_TASK_SOURCE
    ) {
      if (!canManageSupervision) {
        setQuickActionError(
          "Періодичний огляд можуть виконати адміністратор або менеджер об’єктів."
        );

        return;
      }

      if (
        task.status ===
        "Виконано"
      ) {
        setQuickActionError(
          "Завершений періодичний огляд не можна повернути в роботу."
        );

        return;
      }
    }

    if (
      task.task_source ===
      EQUIPMENT_MAINTENANCE_TASK_SOURCE
    ) {
      if (!canManageEquipment) {
        setQuickActionError("Планове ТО може виконати лише адміністратор.");
        return;
      }
      if (task.status === "Виконано") {
        setQuickActionError("Завершене планове ТО не можна повернути в роботу.");
        return;
      }
    }

    const previousStatus =
      task.status;

    const nextStatus =
      previousStatus ===
      "Виконано"
        ? "В роботі"
        : "Виконано";

    setUpdatingTaskId(
      task.id
    );

    setQuickActionError(
      ""
    );

    setLocalTasks(
      (currentTasks) =>
        currentTasks.map(
          (currentTask) =>
            currentTask.id ===
            task.id
              ? {
                  ...currentTask,
                  status:
                    nextStatus,
                }
              : currentTask
        )
    );

    try {
      await updateTaskStatus(
        task.id,
        nextStatus
      );

      if (
        nextStatus === "Виконано" &&
        (task.task_source ===
          SUPERVISION_TASK_SOURCE ||
          task.task_source ===
            EQUIPMENT_MAINTENANCE_TASK_SOURCE ||
          task.task_template_id !== null)
      ) {
        router.refresh();
      }
    } catch (error) {
      setLocalTasks(
        (currentTasks) =>
          currentTasks.map(
            (currentTask) =>
              currentTask.id ===
              task.id
                ? {
                    ...currentTask,
                    status:
                      previousStatus,
                  }
                : currentTask
          )
      );

      setQuickActionError(
        error instanceof Error
          ? error.message
          : "Не вдалося змінити статус завдання."
      );
    } finally {
      setUpdatingTaskId(
        null
      );
    }
  }

  async function handleDeleteTask(
    task: TaskWithObject
  ) {
    if (
      task.task_source !== "manual"
    ) {
      setDeleteErrorMessage(
        task.task_source === SUPERVISION_TASK_SOURCE
          ? SUPERVISION_TASK_MANAGED_MESSAGE
          : EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Видалити завдання «${task.title}»?\n\nЦю дію неможливо скасувати.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingTaskId(
      task.id
    );

    setDeleteErrorMessage(
      ""
    );

    try {
      await deleteObjectTask(
        task.id
      );

      setLocalTasks(
        (currentTasks) =>
          currentTasks.filter(
            (currentTask) =>
              currentTask.id !==
              task.id
          )
      );

      setSelectedTask(
        null
      );
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити завдання."
      );
    } finally {
      setDeletingTaskId(
        null
      );
    }
  }

  function openPreviousWeek() {
    setSelectedDate(
      addDays(
        weekStart,
        -7
      )
    );
  }

  function openNextWeek() {
    setSelectedDate(
      addDays(
        weekStart,
        7
      )
    );
  }

  function openCurrentWeek() {
    setSelectedDate(
      new Date()
    );
  }

  const today =
    formatInputDate(
      new Date()
    );

  return (
    <div className="min-w-0 space-y-5">
      {/* CONTROLS */}
      <div className="min-w-0 rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">
              Тиждень
            </p>

            <h2 className="mt-1 break-words text-base font-semibold sm:text-xl">
              {formatFullDate(
                weekStart
              )}
              {" — "}
              {formatFullDate(
                weekEnd
              )}
            </h2>
          </div>

          {/* WEEK NAVIGATION */}
          <div className="grid w-full grid-cols-3 gap-2 xl:w-auto">
            <button
              type="button"
              onClick={
                openPreviousWeek
              }
              className="min-h-10 rounded-lg border bg-white px-2 py-2 text-xs font-medium hover:bg-gray-50 sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">
                ← Назад
              </span>

              <span className="hidden sm:inline">
                ← Попередній
              </span>
            </button>

            <button
              type="button"
              onClick={
                openCurrentWeek
              }
              className="min-h-10 rounded-lg border bg-white px-2 py-2 text-xs font-medium text-green-700 hover:bg-green-50 sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">
                Сьогодні
              </span>

              <span className="hidden sm:inline">
                Цей тиждень
              </span>
            </button>

            <button
              type="button"
              onClick={
                openNextWeek
              }
              className="min-h-10 rounded-lg border bg-white px-2 py-2 text-xs font-medium hover:bg-gray-50 sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">
                Вперед →
              </span>

              <span className="hidden sm:inline">
                Наступний →
              </span>
            </button>
          </div>
        </div>

        {/* FILTERS */}
        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            value={
              employeeFilter
            }
            onChange={(
              event
            ) =>
              setEmployeeFilter(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
          >
            <option value="Усі">
              Усі працівники
            </option>

            <option value="Без відповідального">
              Без відповідального
            </option>

            {employees.map(
              (employee) => (
                <option
                  key={
                    employee.id
                  }
                  value={String(
                    employee.id
                  )}
                >
                  {
                    employee.last_name
                  }{" "}
                  {
                    employee.first_name
                  }
                </option>
              )
            )}
          </select>

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) => {
              const nextStatus =
                event.target.value;

              setStatusFilter(
                nextStatus
              );

              if (
                nextStatus ===
                "Виконано"
              ) {
                setShowOnlyActive(
                  false
                );
              }
            }}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
          >
            <option value="Усі">
              Усі статуси
            </option>

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

          <select
            value={
              priorityFilter
            }
            onChange={(
              event
            ) =>
              setPriorityFilter(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
          >
            <option value="Усі">
              Усі пріоритети
            </option>

            <option value="Терміновий">
              Терміновий
            </option>

            <option value="Високий">
              Високий
            </option>

            <option value="Середній">
              Середній
            </option>

            <option value="Низький">
              Низький
            </option>
          </select>

          <button
            type="button"
            aria-pressed={
              showOnlyActive
            }
            onClick={() => {
              setShowOnlyActive(
                (
                  currentValue
                ) => {
                  const nextValue =
                    !currentValue;

                  if (
                    nextValue
                  ) {
                    setStatusFilter(
                      "Усі"
                    );
                  }

                  return nextValue;
                }
              );
            }}
            className={`min-h-11 w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              showOnlyActive
                ? "border-green-300 bg-green-50 text-green-700"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span>
                Лише активні
              </span>

              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                  showOnlyActive
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
            </span>
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500 md:hidden">
          Натисни на картку, щоб
          відкрити та редагувати
          завдання.
        </p>

        <p className="mt-4 hidden text-xs text-gray-500 md:block">
          Затисни картку та
          перетягни її на потрібний
          день.
        </p>
      </div>

      {/* ERROR */}
      {quickActionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {quickActionError}
        </div>
      )}

      {/* WEEK */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 2xl:grid-cols-7">
        {weekDates.map(
          (
            date,
            index
          ) => {
            const dateValue =
              formatInputDate(
                date
              );

            const dayTasks =
              tasksByDate.get(
                dateValue
              ) || [];

            const isToday =
              dateValue ===
              today;

            const isDropTarget =
              dragOverTarget ===
              dateValue;

            return (
              <section
                key={
                  dateValue
                }
                onDragEnter={(
                  event
                ) =>
                  handleDragOver(
                    event,
                    dateValue
                  )
                }
                onDragOver={(
                  event
                ) =>
                  handleDragOver(
                    event,
                    dateValue
                  )
                }
                onDragLeave={(
                  event
                ) =>
                  handleDragLeave(
                    event,
                    dateValue
                  )
                }
                onDrop={(
                  event
                ) =>
                  handleTaskDrop(
                    event,
                    dateValue
                  )
                }
                className={`min-w-0 overflow-hidden rounded-xl border transition ${
                  isDropTarget
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : isToday
                      ? "border-green-400 bg-white ring-1 ring-green-200"
                      : "bg-white"
                }`}
              >
                {/* DAY HEADER */}
                <div
                  className={`border-b p-3 sm:p-4 ${
                    isDropTarget
                      ? "bg-blue-100"
                      : isToday
                        ? "bg-green-50"
                        : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {
                            weekDays[
                              index
                            ]
                          }
                        </p>

                        {isToday && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                            Сьогодні
                          </span>
                        )}
                      </div>

                      <p
                        className={`mt-1 text-sm ${
                          isToday
                            ? "font-medium text-green-700"
                            : "text-gray-500"
                        }`}
                      >
                        {formatDayDate(
                          date
                        )}
                        {" • "}
                        {dayTasks.length}{" "}
                        завд.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openAddTask(
                          dateValue
                        )
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-xl font-medium text-white transition hover:bg-green-700"
                      aria-label={`Додати завдання на ${formatDayDate(
                        date
                      )}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* DAY TASKS */}
                <div className="min-h-24 space-y-3 p-3 xl:min-h-32">
                  {isDropTarget && (
                    <div className="rounded-lg border border-dashed border-blue-400 bg-blue-50 px-3 py-3 text-center text-xs font-medium text-blue-700">
                      Відпусти
                      завдання тут
                    </div>
                  )}

                  {dayTasks.length ===
                  0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        openAddTask(
                          dateValue
                        )
                      }
                      className="min-h-16 w-full rounded-lg border border-dashed px-3 py-4 text-center text-sm text-gray-400 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                    >
                      + Додати
                      завдання
                    </button>
                  ) : (
                    dayTasks.map(
                      (task) => (
                        <TaskCard
                          key={
                            task.id
                          }
                          task={
                            task
                          }
                          employeesById={
                            employeesById
                          }
                          isUpdating={
                            updatingTaskId ===
                            task.id
                          }
                          isMoving={
                            movingTaskId ===
                              task.id ||
                            draggedTaskId ===
                              task.id
                          }
                          canDrag={
                            canDrag &&
                            (task.task_source !==
                              SUPERVISION_TASK_SOURCE ||
                              (canManageSupervision &&
                                task.status !==
                                  "Виконано")) &&
                            (task.task_source !==
                              EQUIPMENT_MAINTENANCE_TASK_SOURCE ||
                              (canManageEquipment &&
                                task.status !== "Виконано")) &&
                            (task.task_template_id === null ||
                              task.status !== "Виконано")
                          }
                          canUseQuickAction={
                            (task.task_source !==
                              SUPERVISION_TASK_SOURCE ||
                              (canManageSupervision &&
                                task.status !== "Виконано")) &&
                            (task.task_source !==
                              EQUIPMENT_MAINTENANCE_TASK_SOURCE ||
                              (canManageEquipment &&
                                task.status !== "Виконано")) &&
                            (task.task_template_id === null ||
                              task.status !== "Виконано")
                          }
                          onOpen={() =>
                            handleTaskClick(
                              task
                            )
                          }
                          onDragStart={(
                            event
                          ) =>
                            handleDragStart(
                              event,
                              task
                            )
                          }
                          onDragEnd={
                            handleDragEnd
                          }
                          onQuickStatus={(
                            event
                          ) =>
                            handleQuickStatusChange(
                              event,
                              task
                            )
                          }
                        />
                      )
                    )
                  )}

                  {dayTasks.length >
                    0 && (
                    <button
                      type="button"
                      onClick={() =>
                        openAddTask(
                          dateValue
                        )
                      }
                      className="min-h-10 w-full rounded-lg border border-dashed px-3 py-2 text-xs font-medium text-green-700 transition hover:border-green-300 hover:bg-green-50"
                    >
                      + Ще завдання
                    </button>
                  )}
                </div>
              </section>
            );
          }
        )}
      </div>

      {/* WITHOUT DATE */}
      <section
        onDragEnter={(
          event
        ) =>
          handleDragOver(
            event,
            NO_DATE_DROP_TARGET
          )
        }
        onDragOver={(
          event
        ) =>
          handleDragOver(
            event,
            NO_DATE_DROP_TARGET
          )
        }
        onDragLeave={(
          event
        ) =>
          handleDragLeave(
            event,
            NO_DATE_DROP_TARGET
          )
        }
        onDrop={(
          event
        ) =>
          handleTaskDrop(
            event,
            null
          )
        }
        className={`min-w-0 rounded-xl border p-4 transition sm:p-5 ${
          dragOverTarget ===
          NO_DATE_DROP_TARGET
            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
            : "bg-white"
        }`}
      >
        <h2 className="text-lg font-semibold sm:text-xl">
          Завдання без дати
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {canDrag
            ? "Перетягни сюди завдання, щоб прибрати дату виконання."
            : "Завдання, для яких ще не вказано дату виконання."}
        </p>

        {tasksWithoutDate.length ===
        0 ? (
          <div className="mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-sm text-gray-400 sm:mt-5 sm:px-5 sm:py-8">
            {dragOverTarget ===
            NO_DATE_DROP_TARGET
              ? "Відпусти завдання тут"
              : "Завдань без дати немає"}
          </div>
        ) : (
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:mt-5 md:grid-cols-2 xl:grid-cols-3">
            {tasksWithoutDate.map(
              (task) => (
                <TaskCard
                  key={
                    task.id
                  }
                  task={
                    task
                  }
                  employeesById={
                    employeesById
                  }
                  isUpdating={
                    updatingTaskId ===
                    task.id
                  }
                  isMoving={
                    movingTaskId ===
                      task.id ||
                    draggedTaskId ===
                      task.id
                  }
                  canDrag={
                    canDrag &&
                    (task.task_source !==
                      SUPERVISION_TASK_SOURCE ||
                      (canManageSupervision &&
                        task.status !==
                          "Виконано")) &&
                    (task.task_source !==
                      EQUIPMENT_MAINTENANCE_TASK_SOURCE ||
                      (canManageEquipment &&
                        task.status !== "Виконано")) &&
                    (task.task_template_id === null ||
                      task.status !== "Виконано")
                  }
                  canUseQuickAction={
                    (task.task_source !==
                      SUPERVISION_TASK_SOURCE ||
                      (canManageSupervision &&
                        task.status !== "Виконано")) &&
                    (task.task_source !==
                      EQUIPMENT_MAINTENANCE_TASK_SOURCE ||
                      (canManageEquipment &&
                        task.status !== "Виконано")) &&
                    (task.task_template_id === null ||
                      task.status !== "Виконано")
                  }
                  onOpen={() =>
                    handleTaskClick(
                      task
                    )
                  }
                  onDragStart={(
                    event
                  ) =>
                    handleDragStart(
                      event,
                      task
                    )
                  }
                  onDragEnd={
                    handleDragEnd
                  }
                  onQuickStatus={(
                    event
                  ) =>
                    handleQuickStatusChange(
                      event,
                      task
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </section>

      {/* ADD TASK MODAL */}
      {selectedTaskDate && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 sm:items-start sm:overflow-y-auto sm:p-4 md:p-8"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedTaskDate(
                null
              );
            }
          }}
        >
          <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-2xl">
            {/* HEADER */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-white px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">
                  Нове завдання
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {formatSelectedDate(
                    selectedTaskDate
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTaskDate(
                    null
                  )
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl text-gray-600 transition hover:bg-gray-200"
                aria-label="Закрити"
              >
                ×
              </button>
            </div>

            {/* CONTENT */}
            <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <AddGlobalTaskForm
                key={
                  selectedTaskDate
                }
                objects={
                  objects
                }
                equipment={
                  equipment
                }
                employees={
                  employees
                }
                initialDueDate={
                  selectedTaskDate
                }
                defaultOpen
                hideToggleButton
                canManageRecurrence={
                  canManageSupervision
                }
                onClose={() =>
                  setSelectedTaskDate(
                    null
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 sm:items-start sm:overflow-y-auto sm:p-4 md:p-8"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              deletingTaskId ===
                null
            ) {
              setSelectedTask(
                null
              );

              setDeleteErrorMessage(
                ""
              );
            }
          }}
        >
          <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-2xl">
            {/* HEADER */}
            <div className="shrink-0 border-b bg-white px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">
                    {selectedTask.task_source === SUPERVISION_TASK_SOURCE
                      ? "Автоматичний огляд"
                      : selectedTask.task_source === EQUIPMENT_MAINTENANCE_TASK_SOURCE
                        ? "Автоматичне ТО"
                        : "Редагування завдання"}
                  </h2>

                  <p className="mt-1 line-clamp-2 break-words text-sm text-gray-500">
                    {
                      selectedTask.title
                    }

                    {getTaskTarget(selectedTask)
                      ? ` • ${getTaskTarget(selectedTask)?.name}`
                      : ""}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    deletingTaskId !==
                    null
                  }
                  onClick={() => {
                    setSelectedTask(
                      null
                    );

                    setDeleteErrorMessage(
                      ""
                    );
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                  aria-label="Закрити"
                >
                  ×
                </button>
              </div>

              {selectedTask.task_source === "manual" && (
                <button
                  type="button"
                  disabled={
                    deletingTaskId ===
                    selectedTask.id
                  }
                  onClick={() =>
                    handleDeleteTask(
                      selectedTask
                    )
                  }
                  className="mt-3 min-h-10 w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {deletingTaskId ===
                  selectedTask.id
                    ? "Видалення..."
                    : "Видалити завдання"}
                </button>
              )}
            </div>

            {/* CONTENT */}
            <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {deleteErrorMessage && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
                  {
                    deleteErrorMessage
                  }
                </div>
              )}

              {selectedTask.task_source !== "manual" ? (
                <div className="space-y-4 rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                  {selectedTask.task_source === SUPERVISION_TASK_SOURCE
                    ? <SupervisionTaskBadge />
                    : <EquipmentMaintenanceTaskBadge />}

                  <p className="text-sm leading-6 text-rose-800">
                    {selectedTask.task_source === SUPERVISION_TASK_SOURCE
                      ? SUPERVISION_TASK_MANAGED_MESSAGE
                      : EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE}
                  </p>

                  {getTaskTarget(selectedTask) && (
                    <Link
                      href={getTaskTarget(selectedTask)?.href || "/task"}
                      className="inline-flex min-h-10 items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                    >
                      Відкрити {getTaskTarget(selectedTask)?.type === "equipment" ? "техніку" : "об’єкт"}
                    </Link>
                  )}

                  {selectedTask.status !== "Виконано" && (
                    <RescheduleTaskButton
                      taskId={selectedTask.id}
                      currentDate={selectedTask.due_date}
                      taskSource={selectedTask.task_source}
                      canManageSupervision={canManageSupervision}
                      canManageEquipment={canManageEquipment}
                    />
                  )}
                </div>
              ) : (
                <EditTaskForm
                  task={
                    selectedTask
                  }
                  objects={objects}
                  equipment={equipment}
                  employees={
                    employees
                  }
                  canManageRecurrence={
                    canManageSupervision
                  }
                  onCancel={
                    closeEditForm
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
