"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateWarehousePurchase } from "@/app/actions/purchaseActions";

import type { WarehousePurchase } from "@/types/warehousePurchase";

type Props = {
  purchase: WarehousePurchase;
  onCancel: () => void;
};

export default function EditPurchaseForm({
  purchase,
  onCancel,
}: Props) {
  const router =
    useRouter();

  const [
    quantity,
    setQuantity,
  ] = useState(
    String(
      purchase.quantity
    )
  );

  const [
    purchasePrice,
    setPurchasePrice,
  ] = useState(
    String(
      purchase.purchase_price
    )
  );

  const [
    supplier,
    setSupplier,
  ] = useState(
    purchase.supplier || ""
  );

  const [
    note,
    setNote,
  ] = useState(
    purchase.note || ""
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const totalValue =
    Number(
      quantity || 0
    ) *
    Number(
      purchasePrice || 0
    );

  async function handleSubmit(
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await updateWarehousePurchase(
        formData
      );

      router.refresh();
      onCancel();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося оновити закупівлю."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 rounded-xl border bg-gray-50 p-3 sm:p-5"
    >
      <input
        type="hidden"
        name="purchase_id"
        value={
          purchase.id
        }
      />

      {/* HEADER */}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Матеріал
        </p>

        <p className="mt-1 break-words text-base font-semibold text-gray-900 sm:text-lg">
          {purchase.item
            ?.name ||
            "Позицію видалено"}
        </p>

        {purchase.item && (
          <div className="mt-3 rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-500">
              Поточний залишок на
              складі
            </p>

            <p className="mt-1 font-semibold text-gray-800">
              {
                purchase.item
                  .quantity
              }{" "}
              {
                purchase.item
                  .unit
              }
            </p>
          </div>
        )}
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* QUANTITY + PRICE */}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Кількість
          </label>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              name="quantity"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={
                quantity
              }
              onChange={(
                event
              ) =>
                setQuantity(
                  event.target.value
                )
              }
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
              required
            />

            {purchase.item && (
              <span className="flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700">
                {
                  purchase.item
                    .unit
                }
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Ціна за одиницю
          </label>

          <input
            name="purchase_price"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={
              purchasePrice
            }
            onChange={(
              event
            ) =>
              setPurchasePrice(
                event.target.value
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
            required
          />
        </div>
      </div>

      {/* SUPPLIER */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Постачальник
        </label>

        <input
          name="supplier"
          value={supplier}
          onChange={(
            event
          ) =>
            setSupplier(
              event.target.value
            )
          }
          placeholder="Назва постачальника"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      {/* NOTE */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Примітка
        </label>

        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(
            event
          ) =>
            setNote(
              event.target.value
            )
          }
          placeholder="Примітка до закупівлі"
          className="w-full min-w-0 resize-none rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      {/* TOTAL */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 sm:p-4">
        <p className="text-sm text-green-700">
          Нова орієнтовна сума
        </p>

        <p className="mt-1 break-words text-xl font-bold text-green-800 sm:text-2xl">
          {Number.isFinite(
            totalValue
          )
            ? totalValue.toFixed(
                2
              )
            : "0.00"}{" "}
          ₴
        </p>
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={
            onCancel
          }
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg border bg-white px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}