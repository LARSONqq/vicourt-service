"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";

import {
  deleteObjectTask,
  updateTaskStatus,
} from "@/app/actions/taskActions";

import EditTaskForm from "@/components/objects/EditTaskForm";
import CompleteTaskButton from "@/components/dashboard/CompleteTaskButton";
import RescheduleTaskButton from "@/components/dashboard/RescheduleTaskButton";
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
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  getTaskRecurrenceLabel,
} from "@/lib/taskRecurrence";
import {
  useMediaQuery,
} from "@/lib/useMediaQuery";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";
import type {
  TaskTemplate,
} from "@/types/taskTemplate";

type Props = {
  tasks: TaskWithObject[];
  employees?: Employee[];
  objects?: ObjectItem[];
  equipment?: Equipment[];
  canManageSupervision: boolean;
  canManageEquipment: boolean;
  taskTemplates?: TaskTemplate[];
};

type TaskStatus =
  | "Заплановано"
  | "В роботі"
  | "Виконано";

type ViewMode =
  | "list"
  | "board";

type StatusColumn = {
  status: TaskStatus;
  title: string;
  description: string;
  headerClassName: string;
  countClassName: string;
  dropClassName: string;
};

const taskStatuses = [
  "Усі",
  "Заплановано",
  "В роботі",
  "Виконано",
];

const taskPriorities = [
  "Усі",
  "Терміновий",
  "Високий",
  "Середній",
  "Низький",
];

const statusColumns: StatusColumn[] = [
  {
    status: "Заплановано",
    title: "Заплановано",
    description:
      "Завдання, які ще не розпочаті",
    headerClassName:
      "border-blue-100 bg-blue-50",
    countClassName:
      "bg-blue-100 text-blue-700",
    dropClassName:
      "border-blue-400 bg-blue-50 ring-blue-200",
  },
  {
    status: "В роботі",
    title: "В роботі",
    description:
      "Завдання, які зараз виконуються",
    headerClassName:
      "border-yellow-100 bg-yellow-50",
    countClassName:
      "bg-yellow-100 text-yellow-700",
    dropClassName:
      "border-yellow-400 bg-yellow-50 ring-yellow-200",
  },
  {
    status: "Виконано",
    title: "Виконано",
    description:
      "Завершені завдання",
    headerClassName:
      "border-green-100 bg-green-50",
    countClassName:
      "bg-green-100 text-green-700",
    dropClassName:
      "border-green-400 bg-green-50 ring-green-200",
  },
];

function formatDate(
  date: string | null
) {
  if (!date) {
    return "Не вказано";
  }

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
      return "bg-green-100 text-green-700";

    default:
      return "bg-gray-100 text-gray-700";
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

    case "Низький":
      return "bg-gray-100 text-gray-600";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getPriorityBorderStyle(
  priority: string
) {
  switch (priority) {
    case "Терміновий":
      return "border-l-red-500";

    case "Високий":
      return "border-l-orange-500";

    case "Середній":
      return "border-l-violet-400";

    case "Низький":
      return "border-l-gray-300";

    default:
      return "border-l-gray-300";
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

function isTaskStatus(
  status: string
): status is TaskStatus {
  return (
    status === "Заплановано" ||
    status === "В роботі" ||
    status === "Виконано"
  );
}

function isTaskOverdue(
  task: TaskWithObject
) {
  return Boolean(
    task.due_date &&
      task.due_date <
        getKyivDateValue() &&
      task.status !==
        "Виконано"
  );
}

function getChecklistProgress(
  task: TaskWithObject
) {
  const checklistItems =
    Array.isArray(
      task.checklist_items
    )
      ? task.checklist_items
      : [];

  const completed =
    checklistItems.filter(
      (item) =>
        item.is_completed
    ).length;

  const total =
    checklistItems.length;

  const percent =
    total > 0
      ? Math.round(
          (completed / total) *
            100
        )
      : 0;

  return {
    completed,
    total,
    percent,
  };
}

function sortTasks(
  firstTask: TaskWithObject,
  secondTask: TaskWithObject
) {
  const firstPriority =
    firstTask.priority ||
    "Середній";

  const secondPriority =
    secondTask.priority ||
    "Середній";

  const priorityDifference =
    getPriorityOrder(
      firstPriority
    ) -
    getPriorityOrder(
      secondPriority
    );

  if (
    priorityDifference !== 0
  ) {
    return priorityDifference;
  }

  if (
    firstTask.due_date &&
    secondTask.due_date
  ) {
    return firstTask.due_date.localeCompare(
      secondTask.due_date
    );
  }

  if (firstTask.due_date) {
    return -1;
  }

  if (secondTask.due_date) {
    return 1;
  }

  return firstTask.title.localeCompare(
    secondTask.title,
    "uk"
  );
}

function sortListTasks(
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

  return sortTasks(
    firstTask,
    secondTask
  );
}

export default function TasksList({
  tasks,
  employees = [],
  objects = [],
  equipment = [],
  canManageSupervision,
  canManageEquipment,
  taskTemplates = [],
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

  const isMobile =
    useMediaQuery(
      "(max-width: 767px)"
    );

  const [
    selectedViewMode,
    setViewMode,
  ] =
    useState<ViewMode | null>(
      null
    );

  const viewMode =
    selectedViewMode ??
    (isMobile
      ? "list"
      : "board");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("Усі");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState("Усі");

  const [
    employeeFilter,
    setEmployeeFilter,
  ] = useState("Усі");
  const [targetFilter, setTargetFilter] =
    useState("Усі");
  const [recurrenceFilter, setRecurrenceFilter] =
    useState("Усі");
  const [sourceFilter, setSourceFilter] =
    useState("Усі");
  const [dueFilter, setDueFilter] =
    useState("Усі");

  const [
    editingTask,
    setEditingTask,
  ] =
    useState<TaskWithObject | null>(
      null
    );

  const [
    updatingId,
    setUpdatingId,
  ] = useState<number | null>(
    null
  );

  const [
    deletingId,
    setDeletingId,
  ] = useState<number | null>(
    null
  );

  const [
    draggedTaskId,
    setDraggedTaskId,
  ] = useState<number | null>(
    null
  );

  const [
    dragOverStatus,
    setDragOverStatus,
  ] =
    useState<TaskStatus | null>(
      null
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const draggedTaskIdRef =
    useRef<number | null>(
      null
    );

  if (tasks !== previousTasks) {
    setPreviousTasks(tasks);
    setLocalTasks(
      tasks
    );
  }

  // Блокуємо прокрутку сторінки,
  // коли відкрите редагування.
  useEffect(() => {
    if (!editingTask) {
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
  }, [editingTask]);

  const employeesById =
    useMemo(() => {
      return new Map(
        employees.map(
          (employee) => [
            Number(
              employee.id
            ),
            employee,
          ]
        )
      );
    }, [employees]);

  const taskTemplatesById =
    useMemo(() => {
      return new Map(
        taskTemplates.map(
          (template) => [
            template.id,
            template,
          ]
        )
      );
    }, [taskTemplates]);

  function getEmployeeName(
    task: TaskWithObject
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
        return [
          employee.last_name,
          employee.first_name,
        ]
          .filter(Boolean)
          .join(" ");
      }
    }

    return (
      task.assignee ||
      "Не призначено"
    );
  }

  const plannedCount =
    localTasks.filter(
      (task) =>
        task.status ===
        "Заплановано"
    ).length;

  const inProgressCount =
    localTasks.filter(
      (task) =>
        task.status ===
        "В роботі"
    ).length;

  const completedCount =
    localTasks.filter(
      (task) =>
        task.status ===
        "Виконано"
    ).length;

  const filteredTasks =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();
      const today =
        getKyivDateValue();

      return localTasks
        .filter(
          (task) => {
            const priority =
              task.priority ||
              "Середній";

            let employeeName =
              task.assignee ||
              "Не призначено";

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
                employeeName =
                  [
                    employee.last_name,
                    employee.first_name,
                  ]
                    .filter(
                      Boolean
                    )
                    .join(" ");
                }
            }

            const recurringTemplate =
              task.task_template_id === null
                ? null
                : taskTemplatesById.get(
                    task.task_template_id
                  ) || null;
            const recurrenceLabel =
              recurringTemplate
                ? getTaskRecurrenceLabel(
                    recurringTemplate.recurrence_type,
                    recurringTemplate.recurrence_interval
                  )
                : task.task_template_id !== null
                  ? "Повторюване"
                  : null;

            const searchableText =
              [
                task.title,
                task.description,
                task.assignee,
                employeeName,
                task.object?.name,
                task.equipment?.name,
                task.equipment?.inventory_number,
                priority,
                task.status,
                recurrenceLabel,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
              !normalizedSearch ||
              searchableText.includes(
                normalizedSearch
              );

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

            const matchesTarget =
              targetFilter === "Усі" ||
              (targetFilter === "Об’єкти" &&
                task.object_id !== null) ||
              (targetFilter === "Техніка" &&
                task.equipment_id !== null);

            const matchesRecurrence =
              recurrenceFilter === "Усі" ||
              (recurrenceFilter === "Разові" &&
                task.task_template_id === null) ||
              (recurrenceFilter === "Повторювані" &&
                task.task_template_id !== null);

            const matchesSource =
              sourceFilter === "Усі" ||
              task.task_source === sourceFilter;

            const isActive =
              task.status !== "Виконано";
            const matchesDue =
              dueFilter === "Усі" ||
              (dueFilter === "Прострочені" &&
                isActive &&
                Boolean(
                  task.due_date &&
                    task.due_date < today
                )) ||
              (dueFilter === "Сьогодні" &&
                isActive &&
                task.due_date === today) ||
              (dueFilter === "Майбутні" &&
                isActive &&
                Boolean(
                  task.due_date &&
                    task.due_date > today
                )) ||
              (dueFilter === "Без дати" &&
                !task.due_date);

            return (
              matchesSearch &&
              matchesStatus &&
              matchesPriority &&
              matchesEmployee &&
              matchesTarget &&
              matchesRecurrence &&
              matchesSource &&
              matchesDue
            );
          }
        )
        .sort(
          sortListTasks
        );
    }, [
      localTasks,
      search,
      statusFilter,
      priorityFilter,
      employeeFilter,
      targetFilter,
      recurrenceFilter,
      sourceFilter,
      dueFilter,
      employeesById,
      taskTemplatesById,
    ]);

  const tasksByStatus =
    useMemo(() => {
      const result =
        new Map<
          TaskStatus,
          TaskWithObject[]
        >([
          [
            "Заплановано",
            [],
          ],
          [
            "В роботі",
            [],
          ],
          [
            "Виконано",
            [],
          ],
        ]);

      filteredTasks.forEach(
        (task) => {
          if (
            !isTaskStatus(
              task.status
            )
          ) {
            return;
          }

          result
            .get(
              task.status
            )
            ?.push(task);
        }
      );

      result.forEach(
        (statusTasks) => {
          statusTasks.sort(
            sortTasks
          );
        }
      );

      return result;
    }, [filteredTasks]);

  async function handleStatusChange(
    task: TaskWithObject,
    newStatus: string
  ) {
    if (
      !isTaskStatus(
        newStatus
      ) ||
      task.status ===
        newStatus ||
      updatingId !== null
    ) {
      return;
    }

    if (
      task.task_source ===
      SUPERVISION_TASK_SOURCE
    ) {
      if (!canManageSupervision) {
        setErrorMessage(
          "Періодичний огляд можуть виконати адміністратор або менеджер об’єктів."
        );

        return;
      }

      if (
        task.status ===
        "Виконано"
      ) {
        setErrorMessage(
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
        setErrorMessage(
          "Планове ТО може виконати або перенести лише адміністратор."
        );
        return;
      }

      if (newStatus !== "Виконано") {
        setErrorMessage(EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE);
        return;
      }
    }

    const previousStatus =
      task.status;

    setUpdatingId(
      task.id
    );

    setErrorMessage("");

    setLocalTasks(
      (currentTasks) =>
        currentTasks.map(
          (currentTask) =>
            currentTask.id ===
            task.id
              ? {
                  ...currentTask,
                  status:
                    newStatus,
                }
              : currentTask
        )
    );

    try {
      await updateTaskStatus(
        task.id,
        newStatus
      );

      if (
        newStatus === "Виконано" &&
        (task.task_source ===
          SUPERVISION_TASK_SOURCE ||
          task.task_source ===
            EQUIPMENT_MAINTENANCE_TASK_SOURCE ||
          task.task_template_id !== null)
      ) {
        router.refresh();
      }

      setEditingTask(
        (
          currentEditingTask
        ) =>
          currentEditingTask?.id ===
          task.id
            ? {
                ...currentEditingTask,
                status:
                  newStatus,
              }
            : currentEditingTask
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
                    status:
                      previousStatus,
                  }
                : currentTask
          )
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося змінити статус."
      );
    } finally {
      setUpdatingId(
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
      setErrorMessage(
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

    const previousTasks =
      localTasks;

    setDeletingId(
      task.id
    );

    setErrorMessage("");

    setLocalTasks(
      (currentTasks) =>
        currentTasks.filter(
          (currentTask) =>
            currentTask.id !==
            task.id
        )
    );

    try {
      await deleteObjectTask(
        task.id
      );

      if (
        editingTask?.id ===
        task.id
      ) {
        setEditingTask(
          null
        );
      }
    } catch (error) {
      setLocalTasks(
        previousTasks
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити завдання."
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    task: TaskWithObject
  ) {
    if (
      updatingId !== null ||
      deletingId !== null ||
      (task.task_source ===
        SUPERVISION_TASK_SOURCE &&
        (!canManageSupervision ||
          task.status ===
            "Виконано")) ||
      (task.task_source ===
        EQUIPMENT_MAINTENANCE_TASK_SOURCE &&
        (!canManageEquipment ||
          task.status === "Виконано"))
    ) {
      event.preventDefault();

      return;
    }

    draggedTaskIdRef.current =
      task.id;

    setDraggedTaskId(
      task.id
    );

    setErrorMessage("");

    event.dataTransfer.effectAllowed =
      "move";

    event.dataTransfer.setData(
      "text/plain",
      String(task.id)
    );

    const card =
      event.currentTarget.closest(
        "article"
      );

    if (
      card instanceof
      HTMLElement
    ) {
      event.dataTransfer.setDragImage(
        card,
        24,
        24
      );
    }
  }

  function handleDragEnd() {
    draggedTaskIdRef.current =
      null;

    setDraggedTaskId(
      null
    );

    setDragOverStatus(
      null
    );
  }

  function handleDragOver(
    event: DragEvent<HTMLElement>,
    status: TaskStatus
  ) {
    if (
      draggedTaskIdRef.current ===
      null
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect =
      "move";

    setDragOverStatus(
      status
    );
  }

  function handleDragLeave(
    event: DragEvent<HTMLElement>,
    status: TaskStatus
  ) {
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

    setDragOverStatus(
      (currentStatus) =>
        currentStatus ===
        status
          ? null
          : currentStatus
    );
  }

  async function handleDrop(
    event: DragEvent<HTMLElement>,
    newStatus: TaskStatus
  ) {
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

    setDragOverStatus(
      null
    );

    if (
      !task ||
      !Number.isInteger(
        taskId
      ) ||
      updatingId !== null
    ) {
      return;
    }

    if (
      task.status ===
      newStatus
    ) {
      return;
    }

    await handleStatusChange(
      task,
      newStatus
    );
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter(
      "Усі"
    );
    setPriorityFilter(
      "Усі"
    );
    setEmployeeFilter(
      "Усі"
    );
    setTargetFilter("Усі");
    setRecurrenceFilter("Усі");
    setSourceFilter("Усі");
    setDueFilter("Усі");
  }

  function closeEditForm() {
    setEditingTask(
      null
    );

    router.refresh();
  }

  function renderBoardTask(
    task: TaskWithObject
  ) {
    const priority =
      task.priority ||
      "Середній";

    const overdue =
      isTaskOverdue(
        task
      );

    const completed =
      task.status ===
      "Виконано";

    const isSupervisionTask =
      task.task_source ===
      SUPERVISION_TASK_SOURCE;

    const isMaintenanceTask =
      task.task_source ===
      EQUIPMENT_MAINTENANCE_TASK_SOURCE;

    const recurringTemplate =
      task.task_template_id === null
        ? null
        : taskTemplatesById.get(
            task.task_template_id
          ) || null;

    const target = getTaskTarget(task);

    const canChangeSupervisionTask =
      !isSupervisionTask ||
      (canManageSupervision &&
        !completed);
    const canChangeAutomaticTask =
      canChangeSupervisionTask &&
      !isMaintenanceTask &&
      !(
        task.task_template_id !== null &&
        completed
      );

    const isUpdating =
      updatingId ===
      task.id;

    const isDeleting =
      deletingId ===
      task.id;

    const isDragging =
      draggedTaskId ===
      task.id;

    const checklistProgress =
      getChecklistProgress(
        task
      );

    return (
      <article
        key={task.id}
        className={`min-w-0 rounded-xl border border-l-4 bg-white p-3 transition sm:p-4 ${getPriorityBorderStyle(
          priority
        )} ${
          completed
            ? "bg-green-50/40 opacity-80"
            : overdue
              ? "border-red-200"
              : ""
        } ${
          isDragging
            ? "scale-95 opacity-30"
            : "hover:border-green-300"
        }`}
      >
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          {/* DRAG HANDLE — desktop */}
          <span
            role="button"
            tabIndex={0}
            draggable={
              !isUpdating &&
              !isDeleting &&
              canChangeAutomaticTask
            }
            title="Перетягни завдання"
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
            className="mt-0.5 hidden cursor-grab select-none rounded px-1 text-lg leading-none text-gray-400 active:cursor-grabbing hover:bg-gray-100 hover:text-gray-600 md:inline-flex"
          >
            ⋮⋮
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3
                  className={`min-w-0 break-words font-semibold ${
                    completed
                      ? "text-gray-500 line-through"
                      : "text-gray-900"
                  }`}
                >
                  {task.title}
                </h3>

                {isSupervisionTask && (
                  <div className="mt-2">
                    <SupervisionTaskBadge compact />
                  </div>
                )}
                {isMaintenanceTask && (
                  <div className="mt-2">
                    <EquipmentMaintenanceTaskBadge compact />
                  </div>
                )}
                {task.task_template_id !== null && (
                  <div className="mt-2">
                    <RecurringTaskBadge
                      compact
                      recurrenceType={
                        recurringTemplate?.recurrence_type
                      }
                      recurrenceInterval={
                        recurringTemplate?.recurrence_interval
                      }
                    />
                  </div>
                )}
              </div>

              <span
                className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  completed
                    ? "bg-gray-100 text-gray-500"
                    : getPriorityStyle(
                        priority
                      )
                }`}
              >
                {priority}
              </span>
            </div>

            {target ? (
              <Link
                href={target.href}
                className={`mt-1 block break-words text-sm font-medium hover:underline ${
                  completed
                    ? "text-gray-400"
                    : "text-green-700"
                }`}
              >
                {target.type === "equipment" ? "🔧" : "📍"} {target.name}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-gray-400">
                Пов’язаний запис не знайдено
              </p>
            )}
          </div>
        </div>

        {task.description && (
          <p
            className={`mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm ${
              completed
                ? "text-gray-400"
                : "text-gray-600"
            }`}
          >
            {task.description}
          </p>
        )}

        {checklistProgress.total >
          0 && (
          <div
            className={`mt-4 rounded-lg border p-3 ${
              checklistProgress.percent ===
              100
                ? "border-green-200 bg-green-50"
                : "bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between gap-3 text-xs">
              <span
                className={`font-medium ${
                  checklistProgress.percent ===
                  100
                    ? "text-green-700"
                    : "text-gray-600"
                }`}
              >
                Чекліст
              </span>

              <span
                className={`font-semibold ${
                  checklistProgress.percent ===
                  100
                    ? "text-green-700"
                    : "text-gray-700"
                }`}
              >
                {
                  checklistProgress.completed
                }{" "}
                із{" "}
                {
                  checklistProgress.total
                }{" "}
                •{" "}
                {
                  checklistProgress.percent
                }
                %
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all"
                style={{
                  width: `${checklistProgress.percent}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-3 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">
              Термін
            </p>

            <p
              className={`mt-1 break-words font-medium ${
                completed
                  ? "text-gray-400"
                  : overdue
                    ? "text-red-600"
                    : "text-gray-700"
              }`}
            >
              {formatDate(
                task.due_date
              )}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-xs text-gray-400">
              Відповідальний
            </p>

            <p
              className={`mt-1 break-words font-medium ${
                completed
                  ? "text-gray-400"
                  : "text-gray-700"
              }`}
            >
              {getEmployeeName(
                task
              )}
            </p>
          </div>
        </div>

        {overdue && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            Завдання прострочене
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs text-gray-500">
            Статус
          </label>

          <select
            value={
              task.status
            }
            disabled={
              isUpdating ||
              isDeleting ||
              !canChangeAutomaticTask
            }
            onChange={(
              event
            ) =>
              handleStatusChange(
                task,
                event.target.value
              )
            }
            className="mt-1 min-h-10 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-green-600 disabled:cursor-not-allowed disabled:opacity-60"
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

        {isSupervisionTask || isMaintenanceTask ? (
          <div className="mt-4 space-y-2">
            <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {isSupervisionTask
                ? SUPERVISION_TASK_MANAGED_MESSAGE
                : EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE}
            </p>
            {isMaintenanceTask && !completed && (
              <div className="flex flex-wrap gap-2">
                <RescheduleTaskButton
                  taskId={task.id}
                  currentDate={task.due_date}
                  taskSource={task.task_source}
                  canManageEquipment={canManageEquipment}
                  compact
                />
                <CompleteTaskButton
                  taskId={task.id}
                  taskSource={task.task_source}
                  canManageEquipment={canManageEquipment}
                  compact
                />
              </div>
            )}
          </div>
        ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3">
          <button
            type="button"
            disabled={
              isUpdating ||
              isDeleting ||
              task.task_template_id !== null
            }
            onClick={() =>
              setEditingTask(
                task
              )
            }
            className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-60"
          >
            Редагувати
          </button>

          <button
            type="button"
            disabled={
              isUpdating ||
              isDeleting
            }
            onClick={() =>
              handleDeleteTask(
                task
              )
            }
            className="min-h-10 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting
              ? "..."
              : task.task_template_id !== null
                ? "Зупини через шаблони"
                : "Видалити"}
          </button>
        </div>
        )}
      </article>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Усього завдань
          </p>

          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {
              localTasks.length
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Заплановано
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-700 sm:text-3xl">
            {plannedCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            В роботі
          </p>

          <p className="mt-2 text-2xl font-bold text-yellow-700 sm:text-3xl">
            {inProgressCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Виконано
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700 sm:text-3xl">
            {completedCount}
          </p>
        </div>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* FILTERS */}
      <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* VIEW MODE */}
          <div className="grid w-full grid-cols-2 rounded-lg border bg-gray-50 p-1 sm:inline-grid sm:w-auto">
            <button
              type="button"
              onClick={() =>
                setViewMode(
                  "list"
                )
              }
              className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition sm:px-4 ${
                viewMode ===
                "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              ☰ Список
            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode(
                  "board"
                )
              }
              className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition sm:px-4 ${
                viewMode ===
                "board"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              ▦ Дошка
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="text-sm text-gray-500">
              Знайдено:{" "}
              <span className="font-semibold text-gray-800">
                {
                  filteredTasks.length
                }
              </span>
            </p>

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="text-sm font-medium text-green-700 hover:underline"
            >
              Очистити
            </button>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            type="search"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Пошук завдання..."
            className="min-h-11 w-full min-w-0 rounded-lg border px-4 py-3 outline-none transition focus:border-green-600"
          />

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
          >
            {taskStatuses.map(
              (status) => (
                <option
                  key={
                    status
                  }
                  value={
                    status
                  }
                >
                  {status ===
                  "Усі"
                    ? "Усі статуси"
                    : status}
                </option>
              )
            )}
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
            {taskPriorities.map(
              (
                priority
              ) => (
                <option
                  key={
                    priority
                  }
                  value={
                    priority
                  }
                >
                  {priority ===
                  "Усі"
                    ? "Усі пріоритети"
                    : priority}
                </option>
              )
            )}
          </select>

          <select
            value={targetFilter}
            onChange={(event) => setTargetFilter(event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
          >
            <option value="Усі">Усі типи</option>
            <option value="Об’єкти">Об’єкти</option>
            <option value="Техніка">Техніка</option>
          </select>

          <select
            value={recurrenceFilter}
            onChange={(event) =>
              setRecurrenceFilter(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
            aria-label="Повторюваність"
          >
            <option value="Усі">Усі повторення</option>
            <option value="Разові">Разові</option>
            <option value="Повторювані">Повторювані</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(event) =>
              setSourceFilter(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
            aria-label="Джерело завдання"
          >
            <option value="Усі">Усі джерела</option>
            <option value="manual">Ручні</option>
            <option value="supervision">Огляди</option>
            <option value="equipment_maintenance">ТО техніки</option>
          </select>

          <select
            value={dueFilter}
            onChange={(event) =>
              setDueFilter(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none focus:border-green-600"
            aria-label="Термін виконання"
          >
            <option value="Усі">Усі терміни</option>
            <option value="Прострочені">Прострочені</option>
            <option value="Сьогодні">Сьогодні</option>
            <option value="Майбутні">Майбутні</option>
            <option value="Без дати">Без дати</option>
          </select>

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
                  {employee.position
                    ? ` — ${employee.position}`
                    : ""}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* EMPTY */}
      {filteredTasks.length ===
      0 ? (
        <div className="rounded-xl border bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            ✓
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Завдань не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити пошук або
            фільтри.
          </p>
        </div>
      ) : viewMode ===
        "board" ? (
        /* BOARD */
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-5">
          {statusColumns.map(
            (column) => {
              const columnTasks =
                tasksByStatus.get(
                  column.status
                ) || [];

              const isDropTarget =
                dragOverStatus ===
                column.status;

              return (
                <section
                  key={
                    column.status
                  }
                  onDragEnter={(
                    event
                  ) =>
                    handleDragOver(
                      event,
                      column.status
                    )
                  }
                  onDragOver={(
                    event
                  ) =>
                    handleDragOver(
                      event,
                      column.status
                    )
                  }
                  onDragLeave={(
                    event
                  ) =>
                    handleDragLeave(
                      event,
                      column.status
                    )
                  }
                  onDrop={(
                    event
                  ) =>
                    handleDrop(
                      event,
                      column.status
                    )
                  }
                  className={`min-w-0 overflow-hidden rounded-xl border transition ${
                    isDropTarget
                      ? `${column.dropClassName} ring-2`
                      : "bg-gray-50/60"
                  }`}
                >
                  <div
                    className={`border-b p-3 sm:p-4 ${column.headerClassName}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold">
                          {
                            column.title
                          }
                        </h2>

                        <p className="mt-1 text-xs text-gray-500">
                          {
                            column.description
                          }
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${column.countClassName}`}
                      >
                        {
                          columnTasks.length
                        }
                      </span>
                    </div>
                  </div>

                  <div className="min-h-[140px] space-y-3 p-3 sm:min-h-[220px] xl:min-h-[320px]">
                    {isDropTarget && (
                      <div className="rounded-lg border border-dashed border-current bg-white/70 px-3 py-4 text-center text-xs font-medium">
                        Відпусти
                        завдання тут
                      </div>
                    )}

                    {columnTasks.length ===
                    0 ? (
                      <div className="rounded-lg border border-dashed bg-white px-4 py-6 text-center text-sm text-gray-400 sm:py-10">
                        {isDropTarget
                          ? "Відпусти завдання тут"
                          : "У цій колонці завдань немає"}
                      </div>
                    ) : (
                      columnTasks.map(
                        renderBoardTask
                      )
                    )}
                  </div>
                </section>
              );
            }
          )}
        </div>
      ) : (
        /* LIST */
        <div className="space-y-3 sm:space-y-4">
          {filteredTasks.map(
            (task) => {
              const overdue =
                isTaskOverdue(
                  task
                );

              const completed =
                task.status ===
                "Виконано";

              const isSupervisionTask =
                task.task_source ===
                SUPERVISION_TASK_SOURCE;

              const isMaintenanceTask =
                task.task_source ===
                EQUIPMENT_MAINTENANCE_TASK_SOURCE;

              const recurringTemplate =
                task.task_template_id === null
                  ? null
                  : taskTemplatesById.get(
                      task.task_template_id
                    ) || null;

              const target = getTaskTarget(task);

              const canChangeSupervisionTask =
                !isSupervisionTask ||
                (canManageSupervision &&
                  !completed);
              const canChangeAutomaticTask =
                canChangeSupervisionTask &&
                !isMaintenanceTask &&
                !(
                  task.task_template_id !== null &&
                  completed
                );

              const priority =
                task.priority ||
                "Середній";

              const isUpdating =
                updatingId ===
                task.id;

              const isDeleting =
                deletingId ===
                task.id;

              const checklistProgress =
                getChecklistProgress(
                  task
                );

              return (
                <article
                  key={
                    task.id
                  }
                  className={`min-w-0 rounded-xl border p-4 transition sm:p-5 ${
                    completed
                      ? "border-green-200 bg-green-50/50"
                      : overdue
                        ? "border-red-300 bg-white"
                        : "bg-white"
                  }`}
                >
                  {/* TOP */}
                  <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-2">
                        {completed && (
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                            ✓
                          </span>
                        )}

                        <h3
                          className={`min-w-0 break-words text-base font-semibold sm:text-lg ${
                            completed
                              ? "text-gray-500 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {
                            task.title
                          }
                        </h3>
                      </div>

                      {isSupervisionTask && (
                        <div className="mt-2">
                          <SupervisionTaskBadge />
                        </div>
                      )}
                      {isMaintenanceTask && (
                        <div className="mt-2">
                          <EquipmentMaintenanceTaskBadge />
                        </div>
                      )}
                      {task.task_template_id !== null && (
                        <div className="mt-2">
                          <RecurringTaskBadge
                            recurrenceType={
                              recurringTemplate?.recurrence_type
                            }
                            recurrenceInterval={
                              recurringTemplate?.recurrence_interval
                            }
                          />
                        </div>
                      )}

                      {target ? (
                        <Link
                          href={target.href}
                          className={`mt-1 block break-words text-sm font-medium hover:underline ${
                            completed
                              ? "text-gray-400"
                              : "text-green-700"
                          }`}
                        >
                          {target.type === "equipment" ? "🔧" : "📍"} {target.name}
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">
                          Пов’язаний запис не знайдено
                        </p>
                      )}

                      {task.description && (
                        <p
                          className={`mt-3 whitespace-pre-wrap break-words text-sm leading-6 ${
                            completed
                              ? "text-gray-400"
                              : "text-gray-700"
                          }`}
                        >
                          {
                            task.description
                          }
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${
                          completed
                            ? "bg-gray-100 text-gray-500"
                            : getPriorityStyle(
                                priority
                              )
                        }`}
                      >
                        {priority}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${getStatusStyle(
                          task.status
                        )}`}
                      >
                        {completed
                          ? "✓ Виконано"
                          : task.status}
                      </span>
                    </div>
                  </div>

                  {/* CHECKLIST */}
                  {checklistProgress.total >
                    0 && (
                    <div className="mt-4 rounded-lg bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-gray-600">
                          Чекліст
                        </p>

                        <p className="text-xs font-semibold text-gray-700">
                          {
                            checklistProgress.completed
                          }{" "}
                          із{" "}
                          {
                            checklistProgress.total
                          }{" "}
                          •{" "}
                          {
                            checklistProgress.percent
                          }
                          %
                        </p>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-green-600"
                          style={{
                            width: `${checklistProgress.percent}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* INFO */}
                  <div
                    className={`mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3 ${
                      completed
                        ? "border-green-100"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        Термін виконання
                      </p>

                      <p
                        className={`mt-1 break-words font-medium ${
                          completed
                            ? "text-gray-400"
                            : overdue
                              ? "text-red-600"
                              : "text-gray-700"
                        }`}
                      >
                        {formatDate(
                          task.due_date
                        )}
                      </p>

                      {overdue && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          Завдання
                          прострочене
                        </p>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        Відповідальний
                      </p>

                      <p
                        className={`mt-1 break-words font-medium ${
                          completed
                            ? "text-gray-400"
                            : "text-gray-700"
                        }`}
                      >
                        {getEmployeeName(
                          task
                        )}
                      </p>
                    </div>

                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <label className="text-xs text-gray-500">
                        Швидка зміна
                        статусу
                      </label>

                      <select
                        value={
                          task.status
                        }
                        disabled={
                          isUpdating ||
                          isDeleting ||
                          !canChangeAutomaticTask
                        }
                        onChange={(
                          event
                        ) =>
                          handleStatusChange(
                            task,
                            event.target.value
                          )
                        }
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600 disabled:cursor-not-allowed disabled:opacity-60"
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

                  {/* ACTIONS */}
                  {isSupervisionTask || isMaintenanceTask ? (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {isSupervisionTask
                          ? SUPERVISION_TASK_MANAGED_MESSAGE
                          : EQUIPMENT_MAINTENANCE_TASK_MANAGED_MESSAGE}
                      </p>
                      {isMaintenanceTask && !completed && (
                        <div className="flex flex-wrap gap-2">
                          <RescheduleTaskButton
                            taskId={task.id}
                            currentDate={task.due_date}
                            taskSource={task.task_source}
                            canManageEquipment={canManageEquipment}
                            compact
                          />
                          <CompleteTaskButton
                            taskId={task.id}
                            taskSource={task.task_source}
                            canManageEquipment={canManageEquipment}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:justify-end">
                    <button
                      type="button"
                      disabled={
                        isUpdating ||
                        isDeleting ||
                        task.task_template_id !== null
                      }
                      onClick={() =>
                        setEditingTask(
                          task
                        )
                      }
                      className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-60"
                    >
                      Редагувати
                    </button>

                    <button
                      type="button"
                      disabled={
                        isUpdating ||
                        isDeleting
                      }
                      onClick={() =>
                        handleDeleteTask(
                          task
                        )
                      }
                      className="min-h-10 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting
                        ? "..."
                        : task.task_template_id !== null
                          ? "Зупини через шаблони"
                          : "Видалити"}
                    </button>
                  </div>
                  )}
                </article>
              );
            }
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTask &&
        editingTask.task_source === "manual" && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 sm:items-start sm:overflow-y-auto sm:p-4 md:p-8"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              deletingId === null
            ) {
              closeEditForm();
            }
          }}
        >
          <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-2xl">
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-white px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">
                  Редагування завдання
                </h2>

                <p className="mt-1 line-clamp-2 break-words text-sm text-gray-500">
                  {
                    editingTask.title
                  }

                  {getTaskTarget(editingTask)
                    ? ` • ${getTaskTarget(editingTask)?.name}`
                    : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeEditForm
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl text-gray-600 transition hover:bg-gray-200"
                aria-label="Закрити"
              >
                ×
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <EditTaskForm
                task={
                  editingTask
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
