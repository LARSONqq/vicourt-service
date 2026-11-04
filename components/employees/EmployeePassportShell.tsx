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
  EditEmployeeForm,
} from "@/components/employees/EditEmployeeForm";
import {
  EmployeePassportTabs,
  type EmployeeTabId,
} from "@/components/employees/EmployeePassportNavigation";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  EmployeeDetails,
  ManagementEmployee,
} from "@/types/employee";
import type {
  ReactNode,
} from "react";

type Props = {
  employee: EmployeeDetails;
  hourlyRate: number | null;
  isAdmin: boolean;
  activeTab: EmployeeTabId;
  children: ReactNode;
};

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

function formatDate(
  value: string | null
) {
  return (
    formatDateValue(value) ||
    "Не вказано"
  );
}

export default function EmployeePassportShell({
  employee,
  hourlyRate,
  isAdmin,
  activeTab,
  children,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] =
    useState(false);
  const [showDelete, setShowDelete] =
    useState(false);
  const [isDeleting, setIsDeleting] =
    useState(false);
  const [deleteError, setDeleteError] =
    useState("");
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

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Link
        href="/employees"
        className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-[var(--vc-success-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        ← Назад до працівників
      </Link>

      <header className="vc-surface min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--vc-success-bg)] text-xl font-bold tracking-wide text-[var(--vc-success-text)] sm:h-20 sm:w-20 sm:text-2xl">
              {getInitials(employee)}
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
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

              <p className="mt-1 break-words text-sm font-medium text-muted-foreground sm:text-base">
                {employee.position ||
                  "Посаду не вказано"}
              </p>

              <details className="group mt-3 text-sm text-muted-foreground">
                <summary className="w-fit cursor-pointer list-none rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  Контакти та дані <span aria-hidden="true" className="inline-block transition group-open:rotate-180">⌄</span>
                </summary>
                <div className="mt-2 grid min-w-0 gap-1.5 sm:grid-cols-2 sm:gap-x-5">
                  <span className="break-all">{employee.phone || "Телефон не вказано"}</span>
                  <span className="break-all">{employee.email || "Email не вказано"}</span>
                  <span>{employee.employment_type}</span>
                  <span>Працює з: {formatDate(employee.hire_date)}</span>
                </div>
              </details>
            </div>
          </div>

          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap xl:justify-end">
            {employee.phone ? (
              <a
                href={`tel:${employee.phone}`}
                className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Зателефонувати
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Немає телефону
              </span>
            )}

            {employee.email ? (
              <a
                href={`mailto:${employee.email}`}
                className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Написати
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
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
                  className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {isEditing
                    ? "Закрити"
                    : "Редагувати"}
                </button>

                <details className="relative min-w-0">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                    Ще
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-card p-2 shadow-md">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setShowDelete(true);
                      }}
                      className="min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--vc-danger-text)] transition hover:bg-[var(--vc-danger-bg)]"
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
        <section className="vc-surface min-w-0 p-3 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              Редагування працівника
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Зміни застосовуються до профілю та нових операційних записів.
            </p>
          </div>
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

      <EmployeePassportTabs
        employeeId={employee.id}
        activeTab={activeTab}
      />

      <div className="min-w-0">
        {children}
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
            className="w-full max-w-md rounded-lg bg-card p-5 shadow-md sm:p-6"
          >
            <h2
              id="delete-employee-title"
              className="text-lg font-semibold text-foreground"
            >
              Видалити працівника?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Працівника «{employeeName}» буде видалено. Якщо запис використовується в інших розділах, база даних може заборонити цю дію.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-border bg-[var(--vc-danger-bg)] px-3 py-2 text-sm text-[var(--vc-danger-text)]"
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
                className="min-h-11 rounded-lg border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="min-h-11 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
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
