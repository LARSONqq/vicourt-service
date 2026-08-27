"use client";

import {
  useState,
} from "react";

import {
  createObjectPayment,
  updateObjectPayment,
} from "@/app/actions/objectPaymentActions";
import {
  objectPaymentMethods,
} from "@/constants/objectPayments";

import type {
  ObjectPayment,
} from "@/types/objectPayment";

type Props = {
  objectId: number;
  today: string;
  payment?: ObjectPayment;
  onSaved: () => void;
  onCancel?: () => void;
};

export default function ObjectPaymentForm({
  objectId,
  today,
  payment,
  onSaved,
  onCancel,
}: Props) {
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const knownMethod =
    payment?.payment_method &&
    !objectPaymentMethods.includes(
      payment.payment_method as (typeof objectPaymentMethods)[number]
    )
      ? payment.payment_method
      : null;

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (payment) {
        await updateObjectPayment(
          formData
        );
      } else {
        await createObjectPayment(
          formData
        );
      }

      onSaved();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : payment
            ? "Не вдалося оновити платіж."
            : "Не вдалося додати платіж."
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
      <input
        type="hidden"
        name="object_id"
        value={objectId}
      />

      {payment && (
        <input
          type="hidden"
          name="payment_id"
          value={payment.id}
        />
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Дата платежу
          </label>

          <input
            type="date"
            name="payment_date"
            defaultValue={
              payment?.payment_date ||
              today
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
            max="999999999999.99"
            step="0.01"
            inputMode="decimal"
            defaultValue={
              payment
                ? Number(
                    payment.amount
                  )
                : ""
            }
            placeholder="0"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
            required
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Спосіб оплати
          </label>

          <select
            name="payment_method"
            defaultValue={
              payment?.payment_method ||
              ""
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          >
            <option value="">
              Не вказано
            </option>
            {knownMethod && (
              <option
                value={knownMethod}
              >
                {knownMethod}
              </option>
            )}
            {objectPaymentMethods.map(
              (method) => (
                <option
                  key={method}
                  value={method}
                >
                  {method}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Примітка
        </label>

        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={
            payment?.note || ""
          }
          placeholder="Додаткова інформація, за потреби"
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : payment
              ? "Зберегти"
              : "Додати платіж"}
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
