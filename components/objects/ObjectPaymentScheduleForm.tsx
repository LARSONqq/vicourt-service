"use client";

import { useState } from "react";

import {
  createObjectPaymentScheduleItem,
  updateObjectPaymentScheduleItem,
} from "@/app/actions/objectPaymentScheduleActions";
import { objectPaymentScheduleTitlePresets } from "@/constants/objectPaymentSchedule";

import type { ObjectPaymentScheduleItem } from "@/types/objectPaymentSchedule";

type Props = {
  objectId: number;
  scheduleItem?: ObjectPaymentScheduleItem;
  onSaved: () => void;
  onCancel?: () => void;
};

export default function ObjectPaymentScheduleForm({
  objectId,
  scheduleItem,
  onSaved,
  onCancel,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (scheduleItem) {
        await updateObjectPaymentScheduleItem(formData);
      } else {
        await createObjectPaymentScheduleItem(formData);
      }
      onSaved();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося зберегти етап оплати."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="min-w-0 space-y-5">
      <input type="hidden" name="object_id" value={objectId} />
      {scheduleItem && (
        <input type="hidden" name="schedule_id" value={scheduleItem.id} />
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        <label className="min-w-0 text-sm font-medium text-gray-700">
          Назва етапу
          <input
            type="text"
            name="title"
            list="payment-schedule-title-presets"
            maxLength={150}
            defaultValue={scheduleItem?.title || ""}
            placeholder="Наприклад, Аванс"
            className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            required
          />
          <datalist id="payment-schedule-title-presets">
            {objectPaymentScheduleTitlePresets.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
        </label>

        <label className="min-w-0 text-sm font-medium text-gray-700">
          Сума, грн
          <input
            type="number"
            name="amount"
            min="0.01"
            max="999999999999.99"
            step="0.01"
            inputMode="decimal"
            defaultValue={scheduleItem ? Number(scheduleItem.amount) : ""}
            placeholder="0"
            className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            required
          />
        </label>

        <label className="min-w-0 text-sm font-medium text-gray-700">
          Дата платежу
          <input
            type="date"
            name="due_date"
            defaultValue={scheduleItem?.due_date || ""}
            className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </label>
      </div>

      <label className="block min-w-0 text-sm font-medium text-gray-700">
        Примітка
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={scheduleItem?.note || ""}
          placeholder="Додаткова інформація, за потреби"
          className="mt-2 w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </label>

      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : scheduleItem
              ? "Зберегти"
              : "Додати етап"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-11 rounded-lg border bg-white px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
          >
            Скасувати
          </button>
        )}
      </div>
    </form>
  );
}
