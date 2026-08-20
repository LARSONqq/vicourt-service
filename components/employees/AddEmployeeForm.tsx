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
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* NAME */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Ім’я
          </label>

          <input
            type="text"
            name="first_name"
            placeholder="Ім’я працівника"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Прізвище
          </label>

          <input
            type="text"
            name="last_name"
            placeholder="Прізвище працівника"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            required
          />
        </div>
      </div>

      {/* CONTACTS */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Телефон
          </label>

          <input
            type="tel"
            name="phone"
            inputMode="tel"
            placeholder="+380..."
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Email
          </label>

          <input
            type="email"
            name="email"
            inputMode="email"
            placeholder="example@email.com"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>
      </div>

      {/* WORK INFO */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Посада
          </label>

          <select
            name="position"
            defaultValue=""
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Тип роботи
          </label>

          <select
            name="employment_type"
            defaultValue="Постійна робота"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Статус
          </label>

          <select
            name="status"
            defaultValue="Активний"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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

      {/* HIRE DATE */}
      <div className="min-w-0 sm:max-w-md">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Дата прийняття на роботу
        </label>

        <input
          type="date"
          name="hire_date"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        />
      </div>

      {/* NOTES */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Примітки
        </label>

        <textarea
          name="notes"
          rows={4}
          placeholder="Навички, особливості роботи або інша інформація"
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      {/* SAVE */}
      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Додати працівника"}
        </button>
      </div>
    </form>
  );
}