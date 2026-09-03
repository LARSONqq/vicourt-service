"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { returnMaterialToWarehouse } from "@/app/actions/materialActions";
import type { Material } from "@/types/material";

type Props = {
  material: Material;
  objectId: number;
};

export default function ReturnMaterialForm({
  material,
  objectId,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await returnMaterialToWarehouse(formData);
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося повернути матеріал на склад."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-10 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
      >
        Повернути
      </button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="w-full min-w-0 space-y-3 rounded-lg border border-green-200 bg-green-50 p-3"
    >
      <input type="hidden" name="material_id" value={material.id} />
      <input type="hidden" name="object_id" value={objectId} />

      <label className="block text-xs font-medium text-green-900">
        Кількість для повернення
        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            type="number"
            name="quantity"
            inputMode="decimal"
            min="0.01"
            max={material.quantity}
            step="0.01"
            defaultValue={material.quantity}
            className="min-h-10 min-w-0 rounded-lg border bg-white px-3 py-2 text-gray-900 outline-none focus:border-green-600"
            required
          />
          <span className="flex items-center rounded-lg bg-white px-3 text-gray-600">
            {material.unit}
          </span>
        </div>
      </label>

      {errorMessage && (
        <p className="text-xs text-red-700">{errorMessage}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-10 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Повернення..." : "Підтвердити"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          disabled={isSubmitting}
          className="min-h-10 rounded-lg border bg-white px-3 py-2 text-xs font-medium text-gray-700"
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}
