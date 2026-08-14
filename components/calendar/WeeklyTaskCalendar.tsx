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
import AddGlobalTaskForm from "@/components/tasks/AddGlobalTaskForm";
import type { Employee } from "@/types/employee";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";

type Props = {
  tasks: TaskWithObject[];
  employees: Employee[];
  objects: ObjectItem[];
};

type TaskCardProps = {
  task: TaskWithObject;
  employeesById: Map<number, Employee>;
  isUpdating: boolean;
  isMoving: boolean;
  onOpen: () => void;
  onDragStart: (
    event: DragEvent<HTMLElement>
  ) => void;
  onDragEnd: () => void;
  onQuickStatus: (
    event: MouseEvent<HTMLButtonElement>
  ) => void;
};

const NO_DATE_DROP_TARGET = "__NO_DATE__";

const weekDays = [
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "П’ятниця",
  "Субота",
  "Неділя",
];

function formatInputDate(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonday(date: Date) {
  const result = new Date(date);
  const day = result.getDay();

  const difference =
    result.getDate() -
    day +
    (day === 0 ? -6 : 1);

  result.setDate(difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

function formatDayDate(date: Date) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
    }
  ).format(date);
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatSelectedDate(date: string) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(`${date}T00:00:00`)
  );
}

function getStatusClasses(status: string) {
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
    firstTask.status === "Виконано";

  const secondCompleted =
    secondTask.status === "Виконано";

  if (firstCompleted !== secondCompleted) {
    return firstCompleted ? 1 : -1;
  }

  const priorityDifference =
    getPriorityOrder(
      firstTask.priority || "Середній"
    ) -
    getPriorityOrder(
      secondTask.priority || "Середній"
    );

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return firstTask.title.localeCompare(
    secondTask.title,
    "uk"
  );
}

function getEmployeeName(
  task: TaskWithObject,
  employeesById: Map<number, Employee>
) {
  if (task.assigned_employee_id) {
    const employee = employeesById.get(
      Number(task.assigned_employee_id)
    );

    if (employee) {
      return `${employee.last_name} ${employee.first_name}`;
    }
  }

  return task.assignee || "Не призначено";
}

function TaskCard({
  task,
  employeesById,
  isUpdating,
  isMoving,
  onOpen,
  onDragStart,
  onDragEnd,
  onQuickStatus,
}: TaskCardProps) {
  const priority =
    task.priority || "Середній";

  const isCompleted =
    task.status === "Виконано";

  return (
    <article
      role="button"
      tabIndex={0}
      draggable={!isMoving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`cursor-grab rounded-lg border p-3 transition active:cursor-grabbing hover:border-green-300 ${getPriorityBorderClasses(
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
      <div className="flex items-start gap-2">
        <span
          title="Перетягни завдання"
          className="select-none text-sm text-gray-400"
        >
          ⋮⋮
        </span>

        {isCompleted && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
            ✓
          </span>
        )}

        <h3
          className={`text-sm font-semibold ${
            isCompleted
              ? "text-gray-500 line-through"
              : ""
          }`}
        >
          {task.title}
        </h3>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-medium ${
            isCompleted
              ? "bg-gray-100 text-gray-500"
              : getPriorityClasses(priority)
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

      {task.object && (
        <Link
          href={`/objects/${task.object.id}`}
          draggable={false}
          onPointerDown={(event) =>
            event.stopPropagation()
          }
          onClick={(event) =>
            event.stopPropagation()
          }
          className={`mt-3 block text-xs font-medium hover:underline ${
            isCompleted
              ? "text-gray-400"
              : "text-green-700"
          }`}
        >
          {task.object.name}
        </Link>
      )}

      <p className="mt-2 text-xs text-gray-500">
        {getEmployeeName(
          task,
          employeesById
        )}
      </p>

      {task.description && (
        <p
          className={`mt-2 line-clamp-3 text-xs ${
            isCompleted
              ? "text-gray-400"
              : "text-gray-600"
          }`}
        >
          {task.description}
        </p>
      )}

      <button
        type="button"
        draggable={false}
        disabled={isUpdating || isMoving}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onDragStart={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={onQuickStatus}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
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
        Натисни картку, щоб редагувати
      </p>
    </article>
  );
}

export default function WeeklyTaskCalendar({
  tasks,
  employees,
  objects,
}: Props) {
  const router = useRouter();

  const [localTasks, setLocalTasks] =
    useState<TaskWithObject[]>(tasks);

  const [selectedDate, setSelectedDate] =
    useState(new Date());

  const [
    selectedTaskDate,
    setSelectedTaskDate,
  ] = useState<string | null>(null);

  const [selectedTask, setSelectedTask] =
    useState<TaskWithObject | null>(null);

  const [
    employeeFilter,
    setEmployeeFilter,
  ] = useState("Усі");

  const [statusFilter, setStatusFilter] =
    useState("Усі");

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
  ] = useState<number | null>(null);

  const [
    updatingTaskId,
    setUpdatingTaskId,
  ] = useState<number | null>(null);

  const [
    movingTaskId,
    setMovingTaskId,
  ] = useState<number | null>(null);

  const [
    draggedTaskId,
    setDraggedTaskId,
  ] = useState<number | null>(null);

  const [
    dragOverTarget,
    setDragOverTarget,
  ] = useState<string | null>(null);

  const [
    deleteErrorMessage,
    setDeleteErrorMessage,
  ] = useState("");

  const [
    quickActionError,
    setQuickActionError,
  ] = useState("");

  const draggedTaskIdRef =
    useRef<number | null>(null);

  const ignoreTaskClickRef =
    useRef(false);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const weekStart = useMemo(
    () => getMonday(selectedDate),
    [selectedDate]
  );

  const weekDates = useMemo(
    () =>
      Array.from(
        { length: 7 },
        (_, index) =>
          addDays(weekStart, index)
      ),
    [weekStart]
  );

  const weekEnd = weekDates[6];

  const employeesById = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        employee.id,
        employee,
      ])
    );
  }, [employees]);

  const filteredTasks = useMemo(() => {
    return localTasks.filter((task) => {
      const matchesEmployee =
        employeeFilter === "Усі" ||
        (employeeFilter ===
          "Без відповідального" &&
          !task.assigned_employee_id) ||
        String(
          task.assigned_employee_id
        ) === employeeFilter;

      const priority =
        task.priority || "Середній";

      const matchesStatus =
        statusFilter === "Усі" ||
        task.status === statusFilter;

      const matchesPriority =
        priorityFilter === "Усі" ||
        priority === priorityFilter;

      const matchesActive =
        !showOnlyActive ||
        task.status !== "Виконано";

      return (
        matchesEmployee &&
        matchesStatus &&
        matchesPriority &&
        matchesActive
      );
    });
  }, [
    localTasks,
    employeeFilter,
    statusFilter,
    priorityFilter,
    showOnlyActive,
  ]);

  const tasksByDate = useMemo(() => {
    const result = new Map<
      string,
      TaskWithObject[]
    >();

    weekDates.forEach((date) => {
      result.set(
        formatInputDate(date),
        []
      );
    });

    filteredTasks.forEach((task) => {
      if (
        !task.due_date ||
        !result.has(task.due_date)
      ) {
        return;
      }

      result
        .get(task.due_date)
        ?.push(task);
    });

    result.forEach((dayTasks) => {
      dayTasks.sort(sortCalendarTasks);
    });

    return result;
  }, [filteredTasks, weekDates]);

  const tasksWithoutDate = useMemo(() => {
    return filteredTasks
      .filter((task) => !task.due_date)
      .sort(sortCalendarTasks);
  }, [filteredTasks]);

  function openTask(
    task: TaskWithObject
  ) {
    setSelectedTaskDate(null);
    setDeleteErrorMessage("");
    setQuickActionError("");
    setSelectedTask(task);
  }

  function openAddTask(date: string) {
    setSelectedTask(null);
    setDeleteErrorMessage("");
    setQuickActionError("");
    setSelectedTaskDate(date);
  }

  function closeEditForm() {
    setSelectedTask(null);
    setDeleteErrorMessage("");
    router.refresh();
  }

  function handleTaskClick(
    task: TaskWithObject
  ) {
    if (ignoreTaskClickRef.current) {
      return;
    }

    openTask(task);
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    task: TaskWithObject
  ) {
    if (movingTaskId !== null) {
      event.preventDefault();
      return;
    }

    draggedTaskIdRef.current = task.id;
    ignoreTaskClickRef.current = true;

    setDraggedTaskId(task.id);
    setQuickActionError("");

    event.dataTransfer.effectAllowed =
      "move";

    event.dataTransfer.setData(
      "text/plain",
      String(task.id)
    );
  }

  function handleDragEnd() {
    draggedTaskIdRef.current = null;

    setDraggedTaskId(null);
    setDragOverTarget(null);

    window.setTimeout(() => {
      ignoreTaskClickRef.current = false;
    }, 200);
  }

  function handleDragOver(
    event: DragEvent<HTMLElement>,
    target: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect =
      "move";

    setDragOverTarget(target);
  }

  function handleDragLeave(
    event: DragEvent<HTMLElement>,
    target: string
  ) {
    const nextElement =
      event.relatedTarget as Node | null;

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
        currentTarget === target
          ? null
          : currentTarget
    );
  }

  async function handleTaskDrop(
    event: DragEvent<HTMLElement>,
    dueDate: string | null
  ) {
    event.preventDefault();
    event.stopPropagation();

    const transferredId = Number(
      event.dataTransfer.getData(
        "text/plain"
      )
    );

    const taskId =
      draggedTaskIdRef.current ??
      transferredId;

    const task = localTasks.find(
      (currentTask) =>
        currentTask.id === taskId
    );

    draggedTaskIdRef.current = null;

    setDraggedTaskId(null);
    setDragOverTarget(null);

    if (
      !task ||
      !Number.isInteger(taskId) ||
      movingTaskId !== null
    ) {
      return;
    }

    const normalizedDueDate =
      dueDate || null;

    const currentDueDate =
      task.due_date || null;

    if (
      currentDueDate ===
      normalizedDueDate
    ) {
      window.setTimeout(() => {
        ignoreTaskClickRef.current =
          false;
      }, 200);

      return;
    }

    setMovingTaskId(task.id);
    setQuickActionError("");

    setLocalTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
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
        task.object_id,
        normalizedDueDate
      );
    } catch (error) {
      setLocalTasks((currentTasks) =>
        currentTasks.map(
          (currentTask) =>
            currentTask.id === task.id
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
      setMovingTaskId(null);

      window.setTimeout(() => {
        ignoreTaskClickRef.current =
          false;
      }, 200);
    }
  }

  async function handleQuickStatusChange(
    event: MouseEvent<HTMLButtonElement>,
    task: TaskWithObject
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (
      updatingTaskId !== null ||
      movingTaskId !== null
    ) {
      return;
    }

    const previousStatus =
      task.status;

    const nextStatus =
      previousStatus === "Виконано"
        ? "В роботі"
        : "Виконано";

    setUpdatingTaskId(task.id);
    setQuickActionError("");

    setLocalTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              status: nextStatus,
            }
          : currentTask
      )
    );

    try {
      await updateTaskStatus(
        task.id,
        task.object_id,
        nextStatus
      );
    } catch (error) {
      setLocalTasks((currentTasks) =>
        currentTasks.map(
          (currentTask) =>
            currentTask.id === task.id
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
      setUpdatingTaskId(null);
    }
  }

  async function handleDeleteTask(
    task: TaskWithObject
  ) {
    const confirmed = window.confirm(
      `Видалити завдання «${task.title}»?\n\nЦю дію неможливо скасувати.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingTaskId(task.id);
    setDeleteErrorMessage("");

    try {
      await deleteObjectTask(
        task.id,
        task.object_id
      );

      setLocalTasks((currentTasks) =>
        currentTasks.filter(
          (currentTask) =>
            currentTask.id !== task.id
        )
      );

      setSelectedTask(null);
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити завдання."
      );
    } finally {
      setDeletingTaskId(null);
    }
  }

  function openPreviousWeek() {
    setSelectedDate(
      addDays(weekStart, -7)
    );
  }

  function openNextWeek() {
    setSelectedDate(
      addDays(weekStart, 7)
    );
  }

  function openCurrentWeek() {
    setSelectedDate(new Date());
  }

  const today =
    formatInputDate(new Date());

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              Тиждень
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              {formatFullDate(weekStart)}
              {" — "}
              {formatFullDate(weekEnd)}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openPreviousWeek}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              ← Попередній
            </button>

            <button
              type="button"
              onClick={openCurrentWeek}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
            >
              Цей тиждень
            </button>

            <button
              type="button"
              onClick={openNextWeek}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              Наступний →
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={employeeFilter}
            onChange={(event) =>
              setEmployeeFilter(
                event.target.value
              )
            }
            className="w-full rounded-lg border bg-white px-4 py-3"
          >
            <option value="Усі">
              Усі працівники
            </option>

            <option value="Без відповідального">
              Без відповідального
            </option>

            {employees.map((employee) => (
              <option
                key={employee.id}
                value={String(employee.id)}
              >
                {employee.last_name}{" "}
                {employee.first_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              const nextStatus =
                event.target.value;

              setStatusFilter(nextStatus);

              if (
                nextStatus ===
                "Виконано"
              ) {
                setShowOnlyActive(false);
              }
            }}
            className="w-full rounded-lg border bg-white px-4 py-3"
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
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value
              )
            }
            className="w-full rounded-lg border bg-white px-4 py-3"
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
                (currentValue) => {
                  const nextValue =
                    !currentValue;

                  if (nextValue) {
                    setStatusFilter(
                      "Усі"
                    );
                  }

                  return nextValue;
                }
              );
            }}
            className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
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
                className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
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

        <p className="mt-4 text-xs text-gray-500">
          Затисни картку та перетягни
          її на потрібний день.
        </p>
      </div>

      {quickActionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {quickActionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-7">
        {weekDates.map(
          (date, index) => {
            const dateValue =
              formatInputDate(date);

            const dayTasks =
              tasksByDate.get(
                dateValue
              ) || [];

            const isToday =
              dateValue === today;

            const isDropTarget =
              dragOverTarget ===
              dateValue;

            return (
              <section
                key={dateValue}
                onDragEnter={(event) =>
                  handleDragOver(
                    event,
                    dateValue
                  )
                }
                onDragOver={(event) =>
                  handleDragOver(
                    event,
                    dateValue
                  )
                }
                onDragLeave={(event) =>
                  handleDragLeave(
                    event,
                    dateValue
                  )
                }
                onDrop={(event) =>
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
                <div
                  className={`border-b p-4 ${
                    isDropTarget
                      ? "bg-blue-100"
                      : isToday
                        ? "bg-green-50"
                        : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {weekDays[index]}
                      </p>

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

                        {isToday
                          ? " • Сьогодні"
                          : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openAddTask(
                          dateValue
                        )
                      }
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600 text-lg font-medium text-white hover:bg-green-700"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="min-h-32 space-y-3 p-3">
                  {isDropTarget && (
                    <div className="rounded-lg border border-dashed border-blue-400 bg-blue-50 px-3 py-3 text-center text-xs font-medium text-blue-700">
                      Відпусти завдання
                      тут
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
                      className="w-full rounded-lg border border-dashed py-5 text-center text-sm text-gray-400 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                    >
                      + Додати завдання
                    </button>
                  ) : (
                    dayTasks.map(
                      (task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
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

                  {dayTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        openAddTask(
                          dateValue
                        )
                      }
                      className="w-full rounded-lg border border-dashed px-3 py-2 text-xs font-medium text-green-700 hover:border-green-300 hover:bg-green-50"
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

      <section
        onDragEnter={(event) =>
          handleDragOver(
            event,
            NO_DATE_DROP_TARGET
          )
        }
        onDragOver={(event) =>
          handleDragOver(
            event,
            NO_DATE_DROP_TARGET
          )
        }
        onDragLeave={(event) =>
          handleDragLeave(
            event,
            NO_DATE_DROP_TARGET
          )
        }
        onDrop={(event) =>
          handleTaskDrop(event, null)
        }
        className={`rounded-xl border p-5 transition ${
          dragOverTarget ===
          NO_DATE_DROP_TARGET
            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
            : "bg-white"
        }`}
      >
        <h2 className="text-xl font-semibold">
          Завдання без дати
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Перетягни сюди завдання,
          щоб прибрати дату виконання
        </p>

        {tasksWithoutDate.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed px-5 py-8 text-center text-sm text-gray-400">
            {dragOverTarget ===
            NO_DATE_DROP_TARGET
              ? "Відпусти завдання тут"
              : "Завдань без дати немає"}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tasksWithoutDate.map(
              (task) => (
                <TaskCard
                  key={task.id}
                  task={task}
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
                  onOpen={() =>
                    handleTaskClick(task)
                  }
                  onDragStart={(event) =>
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

      {selectedTaskDate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8"
          onMouseDown={(event) => {
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
          <div className="w-full max-w-3xl">
            <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow-lg">
              <div>
                <h2 className="text-lg font-semibold">
                  Нове завдання
                </h2>

                <p className="text-sm text-gray-500">
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
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Закрити
              </button>
            </div>

            <AddGlobalTaskForm
              key={selectedTaskDate}
              objects={objects}
              employees={employees}
              initialDueDate={
                selectedTaskDate
              }
              defaultOpen
              hideToggleButton
              onClose={() =>
                setSelectedTaskDate(
                  null
                )
              }
            />
          </div>
        </div>
      )}

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              deletingTaskId === null
            ) {
              setSelectedTask(null);
              setDeleteErrorMessage("");
            }
          }}
        >
          <div className="w-full max-w-3xl">
            <div className="mb-3 rounded-xl bg-white px-5 py-4 shadow-lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Редагування завдання
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {selectedTask.title}

                    {selectedTask.object
                      ? ` • ${selectedTask.object.name}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingTaskId ===
                    selectedTask.id
                      ? "Видалення..."
                      : "Видалити"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      deletingTaskId !==
                      null
                    }
                    onClick={() => {
                      setSelectedTask(null);
                      setDeleteErrorMessage(
                        ""
                      );
                    }}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                  >
                    Закрити
                  </button>
                </div>
              </div>
            </div>

            {deleteErrorMessage && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-lg">
                {deleteErrorMessage}
              </div>
            )}

            <EditTaskForm
              task={selectedTask}
              objectId={
                selectedTask.object_id
              }
              employees={employees}
              onCancel={closeEditForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}