"use client";

import {
  useState,
} from "react";

import {
  updateObjectExpense,
} from "@/app/actions/objectExpenseActions";

import {
  objectExpenseCategories,
} from "@/constants/objectExpenses";

import type {
  ObjectExpense,
} from "@/types/objectExpense";

type Props = {
  expense: ObjectExpense;
  objectId: number;
  onCancel: () => void;
};

export default function EditObjectExpenseForm({
  expense,
  objectId,
  onCancel,
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
      await updateObjectExpense(
        formData
      );

      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити витрату."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-xl border bg-gray-50 p-3 sm:p-4"
    >
      <input
        type="hidden"
        name="expense_id"
        value={expense.id}
      />

      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата
          </label>

          <input
            type="date"
            name="expense_date"
            defaultValue={
              expense.expense_date
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Категорія
          </label>

          <select
            name="category"
            defaultValue={
              expense.category
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          >
            {objectExpenseCategories.map(
              (category) => (
                <option
                  key={
                    category
                  }
                  value={
                    category
                  }
                >
                  {
                    category
                  }
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Опис
          </label>

          <input
            type="text"
            name="description"
            defaultValue={
              expense.description
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Сума, грн
          </label>

          <input
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            defaultValue={
              Number(
                expense.amount
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>
      </div>

      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Примітка
        </label>

        <textarea
          name="note"
          rows={3}
          defaultValue={
            expense.note || ""
          }
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap">
        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="min-h-11 rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти"}
        </button>

        <button
          type="button"
          onClick={
            onCancel
          }
          disabled={
            isSubmitting
          }
          className="min-h-11 rounded-lg border bg-white px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}