"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createWarehousePurchase } from "@/app/actions/purchaseActions";
import type { WarehouseItem } from "@/types/warehouseItem";

type Props = {
  items?: WarehouseItem[];
  initialItemId?: number;
  onCreated?: () => void;
};

export default function AddPurchaseForm({
  items = [],
  initialItemId,
  onCreated,
}: Props) {
  const router = useRouter();

  const formRef =
    useRef<HTMLFormElement | null>(
      null
    );

  const safeItems = useMemo(
    () =>
      Array.isArray(items)
        ? items
        : [],
    [items]
  );

  const initialItem = useMemo(() => {
    if (!initialItemId) {
      return null;
    }

    return (
      safeItems.find(
        (item) =>
          Number(item.id) ===
          Number(initialItemId)
      ) || null
    );
  }, [
    safeItems,
    initialItemId,
  ]);

  function getRecommendedQuantity(
    item: WarehouseItem | null
  ) {
    if (!item) {
      return "";
    }

    const recommendedQuantity =
      Math.max(
        Number(item.min_quantity) -
          Number(item.quantity),
        0
      );

    return recommendedQuantity > 0
      ? String(recommendedQuantity)
      : "";
  }

  function getInitialPurchasePrice(
    item: WarehouseItem | null
  ) {
    if (
      !item ||
      Number(item.purchase_price) <= 0
    ) {
      return "";
    }

    return String(
      item.purchase_price
    );
  }

  const [
    selectedItemId,
    setSelectedItemId,
  ] = useState(
    initialItem
      ? String(initialItem.id)
      : ""
  );

  const [
    quantity,
    setQuantity,
  ] = useState(
    getRecommendedQuantity(
      initialItem
    )
  );

  const [
    purchasePrice,
    setPurchasePrice,
  ] = useState(
    getInitialPurchasePrice(
      initialItem
    )
  );

  const [
    supplier,
    setSupplier,
  ] = useState(
    initialItem?.supplier || ""
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const sortedItems = useMemo(() => {
    return [...safeItems].sort(
      (
        firstItem,
        secondItem
      ) => {
        const firstIsLow =
          Number(
            firstItem.quantity
          ) <=
          Number(
            firstItem.min_quantity
          );

        const secondIsLow =
          Number(
            secondItem.quantity
          ) <=
          Number(
            secondItem.min_quantity
          );

        if (
          firstIsLow &&
          !secondIsLow
        ) {
          return -1;
        }

        if (
          secondIsLow &&
          !firstIsLow
        ) {
          return 1;
        }

        return firstItem.name.localeCompare(
          secondItem.name,
          "uk"
        );
      }
    );
  }, [safeItems]);

  const selectedItem =
    useMemo(() => {
      return (
        safeItems.find(
          (item) =>
            String(item.id) ===
            selectedItemId
        ) || null
      );
    }, [
      safeItems,
      selectedItemId,
    ]);

  function handleItemChange(
    itemId: string
  ) {
    setSelectedItemId(itemId);

    const item =
      safeItems.find(
        (warehouseItem) =>
          String(
            warehouseItem.id
          ) === itemId
      ) || null;

    if (!item) {
      setQuantity("");
      setPurchasePrice("");
      setSupplier("");
      return;
    }

    setQuantity(
      getRecommendedQuantity(item)
    );

    setPurchasePrice(
      getInitialPurchasePrice(
        item
      )
    );

    setSupplier(
      item.supplier || ""
    );
  }

  async function handleSubmit(
    formData: FormData
  ) {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createWarehousePurchase(
        formData
      );

      formRef.current?.reset();

      setSelectedItemId("");
      setQuantity("");
      setPurchasePrice("");
      setSupplier("");

      if (initialItemId) {
        router.replace(
          "/purchases"
        );
      } else {
        router.refresh();
      }

      onCreated?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося створити закупівлю."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (safeItems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-gray-500">
          На складі ще немає
          позицій.
        </p>
      </div>
    );
  }

  const totalValue =
    Number(quantity || 0) *
    Number(
      purchasePrice || 0
    );

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-5"
    >
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {initialItem && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-medium text-orange-800">
            Матеріал вибрано
            автоматично
          </p>

          <p className="mt-1 text-sm text-orange-700">
            {initialItem.name} —{" "}
            {initialItem.quantity}{" "}
            {initialItem.unit} на
            складі
          </p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Матеріал
        </label>

        <select
          name="item_id"
          value={selectedItemId}
          onChange={(event) =>
            handleItemChange(
              event.target.value
            )
          }
          className="w-full rounded-lg border bg-white p-3"
          required
        >
          <option value="">
            Обери позицію складу
          </option>

          {sortedItems.map(
            (item) => {
              const isLowStock =
                Number(
                  item.quantity
                ) <=
                Number(
                  item.min_quantity
                );

              return (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name} —{" "}
                  {item.quantity}{" "}
                  {item.unit}
                  {isLowStock
                    ? " — низький залишок"
                    : ""}
                </option>
              );
            }
          )}
        </select>
      </div>

      {selectedItem && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">
              Зараз на складі
            </p>

            <p className="mt-1 font-semibold">
              {
                selectedItem.quantity
              }{" "}
              {selectedItem.unit}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Мінімальний запас
            </p>

            <p className="mt-1 font-semibold">
              {
                selectedItem.min_quantity
              }{" "}
              {selectedItem.unit}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Рекомендовано
              закупити
            </p>

            <p className="mt-1 font-semibold text-orange-700">
              {Math.max(
                Number(
                  selectedItem.min_quantity
                ) -
                  Number(
                    selectedItem.quantity
                  ),
                0
              )}{" "}
              {selectedItem.unit}
            </p>
          </div>
        </div>
      )}

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
              placeholder="0"
              className="min-w-0 flex-1 rounded-lg border bg-white p-3"
              required
            />

            {selectedItem && (
              <span className="shrink-0 rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium">
                {
                  selectedItem.unit
                }
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
            placeholder="0,00"
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
          placeholder="Наприклад: замовити до п’ятниці"
          className="w-full resize-none rounded-lg border bg-white p-3"
        />
      </div>

      {quantity &&
        purchasePrice && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">
              Орієнтовна сума
              закупівлі
            </p>

            <p className="mt-1 text-2xl font-bold text-green-800">
              {totalValue.toFixed(
                2
              )}{" "}
              ₴
            </p>
          </div>
        )}

      <button
        type="submit"
        disabled={
          isSubmitting ||
          !selectedItemId
        }
        className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Збереження..."
          : "Створити закупівлю"}
      </button>
    </form>
  );
}
