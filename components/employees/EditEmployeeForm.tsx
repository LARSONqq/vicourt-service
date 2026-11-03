"use client";

import { useState } from "react";

import { updateEmployee } from "@/app/actions/employeeActions";

import {
  employmentTypes,
  employeeStatuses,
  employeePositions,
} from "@/constants/employees";

import type {
  ManagementEmployee,
} from "@/types/employee";

type Props = {
  employee: ManagementEmployee;
  onCancel: () => void;
  onSaved?: () => void;
};

export function EditEmployeeForm({
  employee,
  onCancel,
  onSaved,
}: Props) {
  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateEmployee(
        formData
      );

      onSaved?.();
      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити працівника."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-lg border bg-muted p-3 sm:p-5"
    >
      <input
        type="hidden"
        name="employee_id"
        value={employee.id}
      />

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-border bg-[var(--vc-danger-bg)] p-3 text-sm text-[var(--vc-danger-text)] sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* NAME */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Ім’я
          </label>

          <input
            type="text"
            name="first_name"
            defaultValue={
              employee.first_name
            }
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition focus:border-ring"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Прізвище
          </label>

          <input
            type="text"
            name="last_name"
            defaultValue={
              employee.last_name
            }
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition focus:border-ring"
            required
          />
        </div>
      </div>

      {/* CONTACTS */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Телефон
          </label>

          <input
            type="tel"
            name="phone"
            inputMode="tel"
            defaultValue={
              employee.phone || ""
            }
            placeholder="+380..."
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition placeholder:text-muted-foreground focus:border-ring"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Email
          </label>

          <input
            type="email"
            name="email"
            inputMode="email"
            defaultValue={
              employee.email || ""
            }
            placeholder="example@email.com"
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
      </div>

      {/* WORK INFO */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Посада
          </label>

          <select
            name="position"
            defaultValue={
              employee.position || ""
            }
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition focus:border-ring"
          >
            <option value="">
              Не вказувати
            </option>

            {employeePositions.map(
              (position) => (
                <option
                  key={position}
                  value={position}
                >
                  {position}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Тип роботи
          </label>

          <select
            name="employment_type"
            defaultValue={
              employee.employment_type
            }
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition focus:border-ring"
            required
          >
            {employmentTypes.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              )
            )}
          </select>
        </div>

        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Статус
          </label>

          <select
            name="status"
            defaultValue={
              employee.status
            }
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition focus:border-ring"
            required
          >
            {employeeStatuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* DATE + RATE */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Дата прийняття на роботу
          </label>

          <input
            type="date"
            name="hire_date"
            defaultValue={
              employee.hire_date || ""
            }
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition focus:border-ring"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Погодинна ставка, грн/год
          </label>

          <input
            type="number"
            name="hourly_rate"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={
              Number(
                employee.hourly_rate ||
                  0
              )
            }
            placeholder="Наприклад, 250"
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition placeholder:text-muted-foreground focus:border-ring"
          />

          <p className="mt-2 text-xs leading-4 text-muted-foreground">
            Нова ставка
            застосовуватиметься до
            нових записів журналу
            робіт.
          </p>
        </div>
      </div>

      {/* NOTES */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Примітки
        </label>

        <textarea
          name="notes"
          rows={4}
          defaultValue={
            employee.notes || ""
          }
          className="vc-field w-full min-w-0 resize-none rounded-lg border bg-card px-3 py-3 outline-none transition focus:border-ring"
        />
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg border bg-card px-5 py-3 font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}
