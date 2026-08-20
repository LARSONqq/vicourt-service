"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { deleteEmployee } from "@/app/actions/employeeActions";

import { getEquipmentClient } from "@/services/equipmentClientService";
import { getObjectsClient } from "@/services/objectClientService";
import { getAllTasksClient } from "@/services/taskClientService";

import type { Employee } from "@/types/employee";
import type { Equipment } from "@/types/equipment";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";

import { EditEmployeeForm } from "./EditEmployeeForm";

type Props = {
  employees: Employee[];
  canManage?: boolean;
};

type EmployeeWorkload = {
  activeTasks: number;
  objects: number;
  equipment: number;
};

function formatDate(
  date: string | null
) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "uk-UA"
  ).format(
    new Date(
      `${date}T00:00:00`
    )
  );
}

function getInitials(
  employee: Employee
) {
  const firstNameLetter =
    employee.first_name?.charAt(
      0
    ) || "";

  const lastNameLetter =
    employee.last_name?.charAt(
      0
    ) || "";

  return `${firstNameLetter}${lastNameLetter}`.toUpperCase();
}

function getStatusClasses(
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
      return "bg-gray-100 text-gray-700";

    case "Звільнений":
      return "bg-red-50 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function EmployeeList({
  employees,
  canManage = false,
}: Props) {
  const safeEmployees =
    Array.isArray(employees)
      ? employees
      : [];

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("Усі");

  const [
    employmentType,
    setEmploymentType,
  ] = useState("Усі");

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const [
    tasks,
    setTasks,
  ] = useState<
    TaskWithObject[]
  >([]);

  const [
    objects,
    setObjects,
  ] = useState<
    ObjectItem[]
  >([]);

  const [
    equipment,
    setEquipment,
  ] = useState<
    Equipment[]
  >([]);

  const [
    isLoadingWorkload,
    setIsLoadingWorkload,
  ] = useState(true);

  const [
    workloadError,
    setWorkloadError,
  ] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadWorkload() {
      setIsLoadingWorkload(
        true
      );

      setWorkloadError("");

      try {
        const [
          loadedTasks,
          loadedObjects,
          loadedEquipment,
        ] = await Promise.all([
          getAllTasksClient(),
          getObjectsClient(),
          getEquipmentClient(),
        ]);

        if (!isActive) {
          return;
        }

        setTasks(
          Array.isArray(
            loadedTasks
          )
            ? loadedTasks
            : []
        );

        setObjects(
          Array.isArray(
            loadedObjects
          )
            ? loadedObjects
            : []
        );

        setEquipment(
          Array.isArray(
            loadedEquipment
          )
            ? loadedEquipment
            : []
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        setWorkloadError(
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити навантаження."
        );
      } finally {
        if (isActive) {
          setIsLoadingWorkload(
            false
          );
        }
      }
    }

    loadWorkload();

    return () => {
      isActive = false;
    };
  }, []);

  const statuses =
    useMemo(() => {
      const values =
        safeEmployees
          .map(
            (employee) =>
              employee.status
          )
          .filter(Boolean);

      return [
        "Усі",
        ...Array.from(
          new Set(values)
        ),
      ];
    }, [safeEmployees]);

  const employmentTypes =
    useMemo(() => {
      const values =
        safeEmployees
          .map(
            (employee) =>
              employee.employment_type
          )
          .filter(Boolean);

      return [
        "Усі",
        ...Array.from(
          new Set(values)
        ),
      ];
    }, [safeEmployees]);

  const workloadByEmployee =
    useMemo(() => {
      const result =
        new Map<
          number,
          EmployeeWorkload
        >();

      safeEmployees.forEach(
        (employee) => {
          result.set(
            employee.id,
            {
              activeTasks: 0,
              objects: 0,
              equipment: 0,
            }
          );
        }
      );

      tasks.forEach(
        (task) => {
          if (
            !task.assigned_employee_id ||
            task.status ===
              "Виконано"
          ) {
            return;
          }

          const employeeId =
            Number(
              task.assigned_employee_id
            );

          const workload =
            result.get(
              employeeId
            );

          if (workload) {
            workload.activeTasks +=
              1;
          }
        }
      );

      objects.forEach(
        (object) => {
          if (
            !object.responsible_employee_id
          ) {
            return;
          }

          const employeeId =
            Number(
              object.responsible_employee_id
            );

          const workload =
            result.get(
              employeeId
            );

          if (workload) {
            workload.objects +=
              1;
          }
        }
      );

      equipment.forEach(
        (item) => {
          if (
            !item.responsible_employee_id
          ) {
            return;
          }

          const employeeId =
            Number(
              item.responsible_employee_id
            );

          const workload =
            result.get(
              employeeId
            );

          if (workload) {
            workload.equipment +=
              1;
          }
        }
      );

      return result;
    }, [
      safeEmployees,
      tasks,
      objects,
      equipment,
    ]);

  const filteredEmployees =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return safeEmployees.filter(
        (employee) => {
          const searchableText =
            [
              employee.first_name,
              employee.last_name,
              employee.phone,
              employee.email,
              employee.position,
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
            status ===
              "Усі" ||
            employee.status ===
              status;

          const matchesEmploymentType =
            employmentType ===
              "Усі" ||
            employee.employment_type ===
              employmentType;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesEmploymentType
          );
        }
      );
    }, [
      safeEmployees,
      search,
      status,
      employmentType,
    ]);

  return (
    <div className="min-w-0 space-y-5">
      {workloadError && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm leading-5 text-orange-700 sm:p-4">
          Працівники завантажилися,
          але дані про навантаження
          поки недоступні.
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_210px_210px]">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук працівника"
          className="min-h-11 w-full min-w-0 rounded-lg border px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          {statuses.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item === "Усі"
                  ? "Усі статуси"
                  : item}
              </option>
            )
          )}
        </select>

        <select
          value={employmentType}
          onChange={(event) =>
            setEmploymentType(
              event.target.value
            )
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        >
          {employmentTypes.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item === "Усі"
                  ? "Усі типи роботи"
                  : item}
              </option>
            )
          )}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Знайдено працівників:{" "}
          <span className="font-semibold text-gray-800">
            {
              filteredEmployees.length
            }
          </span>
        </p>

        {!canManage && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Тільки перегляд
          </span>
        )}
      </div>

      {filteredEmployees.length ===
      0 ? (
        <div className="rounded-xl border bg-white p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            👤
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Працівників не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити пошук,
            статус або тип роботи.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredEmployees.map(
            (employee) => {
              const workload =
                workloadByEmployee.get(
                  employee.id
                ) || {
                  activeTasks: 0,
                  objects: 0,
                  equipment: 0,
                };

              const hireDate =
                formatDate(
                  employee.hire_date
                );

              const isEditing =
                canManage &&
                editingId ===
                  employee.id;

              return (
                <article
                  key={employee.id}
                  className={`min-w-0 overflow-hidden rounded-xl border bg-white ${
                    isEditing
                      ? "xl:col-span-2 2xl:col-span-3"
                      : ""
                  }`}
                >
                  {isEditing ? (
                    <div className="min-w-0 p-3 sm:p-5">
                      <div className="mb-4 flex min-w-0 items-center justify-between gap-3 sm:mb-5">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
                            Редагування працівника
                          </h3>

                          <p className="mt-1 truncate text-sm text-gray-500">
                            {
                              employee.last_name
                            }{" "}
                            {
                              employee.first_name
                            }
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setEditingId(
                              null
                            )
                          }
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white text-xl text-gray-500 transition hover:bg-gray-50 sm:h-auto sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
                          aria-label="Закрити редагування"
                        >
                          <span className="sm:hidden">
                            ×
                          </span>

                          <span className="hidden sm:inline">
                            Закрити
                          </span>
                        </button>
                      </div>

                      <EditEmployeeForm
                        employee={
                          employee
                        }
                        onCancel={() =>
                          setEditingId(
                            null
                          )
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 p-4 sm:p-5">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Link
                              href={`/employees/${employee.id}`}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 transition hover:bg-green-200"
                              title="Відкрити сторінку працівника"
                            >
                              {getInitials(
                                employee
                              )}
                            </Link>

                            <div className="min-w-0">
                              <Link
                                href={`/employees/${employee.id}`}
                                className="block break-words font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                              >
                                {
                                  employee.last_name
                                }{" "}
                                {
                                  employee.first_name
                                }
                              </Link>

                              <p className="mt-0.5 break-words text-sm text-gray-500">
                                {employee.position ||
                                  "Посаду не вказано"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium sm:px-3 sm:text-xs ${getStatusClasses(
                              employee.status
                            )}`}
                          >
                            {
                              employee.status
                            }
                          </span>
                        </div>

                        <div className="mt-5 space-y-3 border-t pt-4 text-sm">
                          {employee.phone && (
                            <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3">
                              <span className="text-gray-500">
                                Телефон
                              </span>

                              <a
                                href={`tel:${employee.phone}`}
                                className="min-w-0 break-all text-right font-medium text-green-700 hover:underline"
                              >
                                {
                                  employee.phone
                                }
                              </a>
                            </div>
                          )}

                          {employee.email && (
                            <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3">
                              <span className="text-gray-500">
                                Email
                              </span>

                              <a
                                href={`mailto:${employee.email}`}
                                className="min-w-0 break-all text-right font-medium text-green-700 hover:underline"
                              >
                                {
                                  employee.email
                                }
                              </a>
                            </div>
                          )}

                          <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3">
                            <span className="text-gray-500">
                              Тип роботи
                            </span>

                            <span className="min-w-0 break-words text-right font-medium text-gray-800">
                              {
                                employee.employment_type
                              }
                            </span>
                          </div>

                          {hireDate && (
                            <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3">
                              <span className="text-gray-500">
                                Працює з
                              </span>

                              <span className="text-right font-medium text-gray-800">
                                {
                                  hireDate
                                }
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-5 border-t pt-4">
                          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
                            Навантаження
                          </p>

                          {isLoadingWorkload ? (
                            <div className="grid grid-cols-3 gap-2">
                              {[0, 1, 2].map(
                                (item) => (
                                  <div
                                    key={item}
                                    className="h-[66px] animate-pulse rounded-lg bg-gray-100"
                                  />
                                )
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="min-w-0 rounded-lg bg-blue-50 p-2 text-center sm:p-3">
                                <p className="text-lg font-semibold text-blue-700">
                                  {
                                    workload.activeTasks
                                  }
                                </p>

                                <p className="truncate text-[10px] text-blue-700 sm:text-xs">
                                  Завдань
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg bg-green-50 p-2 text-center sm:p-3">
                                <p className="text-lg font-semibold text-green-700">
                                  {
                                    workload.objects
                                  }
                                </p>

                                <p className="truncate text-[10px] text-green-700 sm:text-xs">
                                  Об’єктів
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg bg-orange-50 p-2 text-center sm:p-3">
                                <p className="text-lg font-semibold text-orange-700">
                                  {
                                    workload.equipment
                                  }
                                </p>

                                <p className="truncate text-[10px] text-orange-700 sm:text-xs">
                                  Техніки
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {employee.notes && (
                          <div className="mt-4 border-t pt-4">
                            <p className="text-xs text-gray-500">
                              Примітки
                            </p>

                            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-gray-600">
                              {
                                employee.notes
                              }
                            </p>
                          </div>
                        )}
                      </div>

                      <div
                        className={`grid gap-2 border-t bg-gray-50 p-3 sm:px-5 ${
                          canManage
                            ? "grid-cols-3"
                            : "grid-cols-1"
                        }`}
                      >
                        <Link
                          href={`/employees/${employee.id}`}
                          className="flex min-h-10 min-w-0 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-medium text-green-700 transition hover:bg-green-50"
                        >
                          Відкрити
                        </Link>

                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingId(
                                  employee.id
                                )
                              }
                              className="min-h-10 min-w-0 rounded-lg px-2 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                            >
                              Редагувати
                            </button>

                            <form
                              action={deleteEmployee.bind(
                                null,
                                employee.id
                              )}
                              onSubmit={(event) => {
                                const confirmed =
                                  window.confirm(
                                    `Видалити працівника «${employee.last_name} ${employee.first_name}»?`
                                  );

                                if (!confirmed) {
                                  event.preventDefault();
                                }
                              }}
                              className="min-w-0"
                            >
                              <button
                                type="submit"
                                className="min-h-10 w-full min-w-0 rounded-lg px-2 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                              >
                                Видалити
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </article>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}