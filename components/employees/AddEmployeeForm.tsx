"use client";

import { useState } from "react";

import { createEmployee } from "@/app/actions/employeeActions";

import {
  employmentTypes,
  employeeStatuses,
  employeePositions,
} from "@/constants/employees";

type Props = {
  onCreated: () => void;
};

export default function AddEmployeeForm({
  onCreated,
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
      await createEmployee(
        formData
      );

      onCreated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося додати працівника."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5"
    >
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
            placeholder="Ім’я працівника"
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition placeholder:text-muted-foreground focus:border-ring"
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
            placeholder="Прізвище працівника"
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition placeholder:text-muted-foreground focus:border-ring"
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
            defaultValue=""
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
            defaultValue="Постійна робота"
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
            defaultValue="Активний"
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
            defaultValue="0"
            placeholder="Наприклад, 250"
            className="vc-field min-h-11 w-full min-w-0 rounded-lg border bg-card px-3 py-3 outline-none transition placeholder:text-muted-foreground focus:border-ring"
          />

          <p className="mt-2 text-xs leading-4 text-muted-foreground">
            Використовується для
            розрахунку вартості робіт
            на об’єктах.
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
          placeholder="Навички, особливості роботи або інша інформація"
          className="vc-field w-full min-w-0 resize-none rounded-lg border bg-card px-3 py-3 outline-none transition placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      {/* SAVE */}
      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Додати працівника"}
        </button>
      </div>
    </form>
  );
}