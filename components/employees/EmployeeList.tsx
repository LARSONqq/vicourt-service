"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { deleteEmployee } from "@/app/actions/employeeActions";

import {
  getEquipmentClient,
} from "@/services/equipmentClientService";

import {
  getObjectsClient,
} from "@/services/objectClientService";

import { getAllTasksClient,} from "@/services/taskClientService";

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
        employees
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
    }, [employees]);

  const employmentTypes =
    useMemo(() => {
      const values =
        employees
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
    }, [employees]);

  const workloadByEmployee =
    useMemo(() => {
      const result =
        new Map<
          number,
          EmployeeWorkload
        >();

      employees.forEach(
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
      employees,
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

      return employees.filter(
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
            status === "Усі" ||
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
      employees,
      search,
      status,
      employmentType,
    ]);

  return (
    <div className="space-y-5">
      {workloadError && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          Працівники
          завантажилися, але дані
          про навантаження поки
          недоступні.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 lg:grid-cols-[1fr_210px_210px]">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук працівника"
          className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
        />

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="w-full rounded-lg border bg-white px-4 py-3"
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
          className="w-full rounded-lg border bg-white px-4 py-3"
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
          {
            filteredEmployees.length
          }
        </p>

        {!canManage && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Тільки перегляд
          </span>
        )}
      </div>

      {filteredEmployees.length ===
      0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">
            Працівників за цими
            параметрами не знайдено.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
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
                  key={
                    employee.id
                  }
                  className={`rounded-xl border bg-white ${
                    isEditing
                      ? "xl:col-span-2 2xl:col-span-3"
                      : ""
                  }`}
                >
                  {isEditing ? (
                    <div className="p-5">
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                          Редагування
                          працівника
                        </h3>

                        <button
                          type="button"
                          onClick={() =>
                            setEditingId(
                              null
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          Закрити
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
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <Link
                              href={`/employees/${employee.id}`}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 font-semibold text-green-700 transition hover:bg-green-200"
                              title="Відкрити сторінку працівника"
                            >
                              {getInitials(
                                employee
                              )}
                            </Link>

                            <div className="min-w-0">
                              <Link
                                href={`/employees/${employee.id}`}
                                className="block truncate font-semibold transition hover:text-green-700 hover:underline"
                              >
                                {
                                  employee.last_name
                                }{" "}
                                {
                                  employee.first_name
                                }
                              </Link>

                              <p className="truncate text-sm text-gray-500">
                                {employee.position ||
                                  "Посаду не вказано"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                              employee.status
                            )}`}
                          >
                            {
                              employee.status
                            }
                          </span>
                        </div>

                        <div className="mt-5 space-y-2 text-sm">
                          {employee.phone && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">
                                Телефон
                              </span>

                              <a
                                href={`tel:${employee.phone}`}
                                className="truncate font-medium text-green-700 hover:underline"
                              >
                                {
                                  employee.phone
                                }
                              </a>
                            </div>
                          )}

                          {employee.email && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">
                                Email
                              </span>

                              <a
                                href={`mailto:${employee.email}`}
                                className="truncate font-medium text-green-700 hover:underline"
                              >
                                {
                                  employee.email
                                }
                              </a>
                            </div>
                          )}

                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">
                              Тип роботи
                            </span>

                            <span className="text-right font-medium">
                              {
                                employee.employment_type
                              }
                            </span>
                          </div>

                          {hireDate && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">
                                Працює з
                              </span>

                              <span className="font-medium">
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
                            <p className="text-sm text-gray-400">
                              Завантаження...
                            </p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-lg bg-blue-50 p-3 text-center">
                                <p className="text-lg font-semibold text-blue-700">
                                  {
                                    workload.activeTasks
                                  }
                                </p>

                                <p className="text-xs text-blue-700">
                                  Завдань
                                </p>
                              </div>

                              <div className="rounded-lg bg-green-50 p-3 text-center">
                                <p className="text-lg font-semibold text-green-700">
                                  {
                                    workload.objects
                                  }
                                </p>

                                <p className="text-xs text-green-700">
                                  Об’єктів
                                </p>
                              </div>

                              <div className="rounded-lg bg-orange-50 p-3 text-center">
                                <p className="text-lg font-semibold text-orange-700">
                                  {
                                    workload.equipment
                                  }
                                </p>

                                <p className="text-xs text-orange-700">
                                  Техніки
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {employee.notes && (
                          <p className="mt-4 line-clamp-2 text-sm text-gray-500">
                            {
                              employee.notes
                            }
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap justify-end gap-2 border-t bg-gray-50 px-5 py-3">
                        <Link
                          href={`/employees/${employee.id}`}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
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
                              className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                              Редагувати
                            </button>

                            <form
                              action={deleteEmployee.bind(
                                null,
                                employee.id
                              )}
                              onSubmit={(
                                event
                              ) => {
                                const confirmed =
                                  window.confirm(
                                    `Видалити працівника «${employee.last_name} ${employee.first_name}»?`
                                  );

                                if (
                                  !confirmed
                                ) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <button
                                type="submit"
                                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
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