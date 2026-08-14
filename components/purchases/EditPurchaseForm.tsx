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
  const router = useRouter();

  const [quantity, setQuantity] =
    useState(String(purchase.quantity));

  const [purchasePrice, setPurchasePrice] =
    useState(
      String(purchase.purchase_price)
    );

  const [supplier, setSupplier] =
    useState(purchase.supplier || "");

  const [note, setNote] =
    useState(purchase.note || "");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const totalValue =
    Number(quantity || 0) *
    Number(purchasePrice || 0);

  async function handleSubmit(
    formData: FormData
  ) {
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
      className="space-y-5 rounded-xl border bg-gray-50 p-5"
    >
      <input
        type="hidden"
        name="purchase_id"
        value={purchase.id}
      />

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Матеріал
        </p>

        <p className="mt-1 text-lg font-semibold">
          {purchase.item?.name ||
            "Позицію видалено"}
        </p>

        {purchase.item && (
          <p className="mt-1 text-sm text-gray-500">
            Поточний залишок на складі:{" "}
            {purchase.item.quantity}{" "}
            {purchase.item.unit}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Кількість
          </label>

          <div className="flex items-center gap-3">
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  event.target.value
                )
              }
              className="min-w-0 flex-1 rounded-lg border bg-white p-3"
              required
            />

            {purchase.item && (
              <span className="shrink-0 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700">
                {purchase.item.unit}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Ціна за одиницю
          </label>

          <input
            name="purchase_price"
            type="number"
            min="0"
            step="0.01"
            value={purchasePrice}
            onChange={(event) =>
              setPurchasePrice(
                event.target.value
              )
            }
            className="w-full rounded-lg border bg-white p-3"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Постачальник
        </label>

        <input
          name="supplier"
          value={supplier}
          onChange={(event) =>
            setSupplier(
              event.target.value
            )
          }
          placeholder="Назва постачальника"
          className="w-full rounded-lg border bg-white p-3"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Примітка
        </label>

        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(event) =>
            setNote(
              event.target.value
            )
          }
          placeholder="Примітка до закупівлі"
          className="w-full resize-none rounded-lg border bg-white p-3"
        />
      </div>

      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-700">
          Нова орієнтовна сума
        </p>

        <p className="mt-1 text-2xl font-bold text-green-800">
          {Number.isFinite(totalValue)
            ? totalValue.toFixed(2)
            : "0.00"}{" "}
          ₴
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти зміни"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}