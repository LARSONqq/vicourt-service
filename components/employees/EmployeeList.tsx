"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import {
  useMemo,
  useState,
} from "react";

import { deleteEmployee } from "@/app/actions/employeeActions";

import type {
  EmployeeDirectoryItem,
  EmployeeDirectoryWorkload,
} from "@/types/employeeProfile";

import { EditEmployeeForm } from "./EditEmployeeForm";

type Props = {
  employees: EmployeeDirectoryItem[];
  workloads: EmployeeDirectoryWorkload[];
  total: number;
  hasFilters: boolean;
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
  employee: EmployeeDirectoryItem
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
      return "vc-status-success";

    case "У відпустці":
      return "vc-status-info";

    case "На лікарняному":
      return "vc-status-warning";

    case "Неактивний":
      return "vc-status-danger";

    default:
      return "vc-status-neutral";
  }
}

export default function EmployeeList({
  employees,
  workloads,
  total,
  hasFilters,
  canManage = false,
}: Props) {
  const router = useRouter();
  const safeEmployees =
    useMemo(
      () =>
        Array.isArray(employees)
          ? employees
          : [],
      [employees]
    );

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const workloadByEmployee =
    useMemo(() => {
      const result = new Map<
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

      workloads.forEach(
        (workload) => {
          if (
            result.has(
              workload.employeeId
            )
          ) {
            result.set(
              workload.employeeId,
              {
                activeTasks:
                  workload.activeTasks,
                objects:
                  workload.objects,
                equipment:
                  workload.equipment,
              }
            );
          }
        }
      );

      return result;
    }, [
      safeEmployees,
      workloads,
    ]);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Знайдено працівників:{" "}
          <span className="font-semibold text-foreground">
            {total}
          </span>
        </p>

        {!canManage && (
          <span className="rounded-full bg-[var(--vc-info-bg)] px-3 py-1 text-xs font-medium text-[var(--vc-info-text)]">
            Тільки перегляд
          </span>
        )}
      </div>

      {safeEmployees.length ===
      0 ? (
        <div className="vc-surface p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <UserRound aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </div>

          <p className="mt-3 font-medium text-foreground">
            Працівників не знайдено
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters
              ? "Спробуйте змінити пошук, статус або тип роботи."
              : "Додайте першого працівника, щоб сформувати команду."}
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {safeEmployees.map(
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
                  className={`vc-surface min-w-0 overflow-hidden transition hover:border-ring/40 ${
                    isEditing
                      ? "xl:col-span-2 2xl:col-span-3"
                      : ""
                  }`}
                >
                  {isEditing ? (
                    <div className="min-w-0 p-3 sm:p-5">
                      <div className="mb-4 flex min-w-0 items-center justify-between gap-3 sm:mb-5">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-foreground sm:text-lg">
                            Редагування працівника
                          </h3>

                          <p className="mt-1 truncate text-sm text-muted-foreground">
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
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xl text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-auto sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
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
                          {
                            ...employee,
                            hourly_rate:
                              employee.hourly_rate ??
                              0,
                          }
                        }
                        onSaved={() =>
                          router.refresh()
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
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--vc-success-bg)] text-sm font-semibold text-[var(--vc-success-text)] transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              title="Відкрити сторінку працівника"
                            >
                              {getInitials(
                                employee
                              )}
                            </Link>

                            <div className="min-w-0">
                              <Link
                                href={`/employees/${employee.id}`}
                                className="rounded-sm break-words font-semibold text-foreground transition hover:text-[var(--vc-success-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {
                                  employee.last_name
                                }{" "}
                                {
                                  employee.first_name
                                }
                              </Link>

                              <p className="mt-0.5 break-words text-sm text-muted-foreground">
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
                              <span className="text-muted-foreground">
                                Телефон
                              </span>

                              <a
                                href={`tel:${employee.phone}`}
                                className="min-w-0 break-all rounded-sm text-right font-medium text-[var(--vc-success-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {
                                  employee.phone
                                }
                              </a>
                            </div>
                          )}

                          {employee.email && (
                            <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3">
                              <span className="text-muted-foreground">
                                Email
                              </span>

                              <a
                                href={`mailto:${employee.email}`}
                                className="min-w-0 break-all rounded-sm text-right font-medium text-[var(--vc-success-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {
                                  employee.email
                                }
                              </a>
                            </div>
                          )}

                          <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3">
                            <span className="text-muted-foreground">
                              Тип роботи
                            </span>

                            <span className="min-w-0 break-words text-right font-medium text-foreground">
                              {
                                employee.employment_type
                              }
                            </span>
                          </div>

                          {hireDate && (
                            <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3">
                              <span className="text-muted-foreground">
                                Працює з
                              </span>

                              <span className="text-right font-medium text-foreground">
                                {
                                  hireDate
                                }
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-5 border-t pt-4">
                          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Навантаження
                          </p>

                          <div className="grid grid-cols-3 gap-2">
                              <div className="min-w-0 rounded-lg bg-muted/50 p-2 text-center">
                                <p className="text-lg font-semibold tabular-nums text-foreground">
                                  {
                                    workload.activeTasks
                                  }
                                </p>

                                <p className="truncate text-xs text-muted-foreground">
                                  Завдань
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg bg-muted/50 p-2 text-center">
                                <p className="text-lg font-semibold tabular-nums text-foreground">
                                  {
                                    workload.objects
                                  }
                                </p>

                                <p className="truncate text-xs text-muted-foreground">
                                  Об’єктів
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg bg-muted/50 p-2 text-center">
                                <p className="text-lg font-semibold tabular-nums text-foreground">
                                  {
                                    workload.equipment
                                  }
                                </p>

                                <p className="truncate text-xs text-muted-foreground">
                                  Техніки
                                </p>
                              </div>
                            </div>
                        </div>

                        {employee.notes && (
                          <div className="mt-4 border-t pt-4">
                            <p className="text-xs text-muted-foreground">
                              Примітки
                            </p>

                            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">
                              {
                                employee.notes
                              }
                            </p>
                          </div>
                        )}
                      </div>

                      <div
                        className={`grid gap-2 border-t bg-muted p-3 sm:px-5 ${
                          canManage
                            ? "grid-cols-3"
                            : "grid-cols-1"
                        }`}
                      >
                        <Link
                          href={`/employees/${employee.id}`}
                          className="flex min-h-10 min-w-0 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-medium text-[var(--vc-success-text)] transition hover:bg-[var(--vc-success-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                              className="min-h-10 min-w-0 rounded-lg px-2 py-2 text-sm font-medium text-[var(--vc-info-text)] transition hover:bg-[var(--vc-info-bg)]"
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
                                className="min-h-10 w-full min-w-0 rounded-lg px-2 py-2 text-sm font-medium text-[var(--vc-danger-text)] transition hover:bg-[var(--vc-danger-bg)]"
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
