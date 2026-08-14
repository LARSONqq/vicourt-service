"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";
import {
  completeWarehousePurchase,
  deleteWarehousePurchase,
} from "@/app/actions/purchaseActions";
import type { AppCurrency } from "@/types/appSettings";
import type { WarehousePurchase } from "@/types/warehousePurchase";
import EditPurchaseForm from "./EditPurchaseForm";

type Props = {
  purchases?: WarehousePurchase[];
  currency: AppCurrency;
};

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  const symbols: Record<
    string,
    string
  > = {
    UAH: "₴",
    USD: "$",
    EUR: "€",
  };

  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const [wholePart, decimalPart] =
    safeValue
      .toFixed(2)
      .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${formattedWhole},${decimalPart} ${
    symbols[currency] || currency
  }`;
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Не вказано";
  }

  const datePart =
    value.slice(0, 10);

  const [year, month, day] =
    datePart.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return "Невідома дата";
  }

  return `${day}.${month}.${year}`;
}

export default function PurchaseList({
  purchases = [],
  currency,
}: Props) {
  const safePurchases =
    Array.isArray(purchases)
      ? purchases
      : [];

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("Заплановано");

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(null);

  const filteredPurchases =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return safePurchases.filter(
        (purchase) => {
          const searchableText = [
            purchase.item?.name,
            purchase.supplier,
            purchase.note,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchableText.includes(
              normalizedSearch
            );

          const matchesStatus =
            status === "Усі" ||
            purchase.status === status;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      safePurchases,
      search,
      status,
    ]);

  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-5">
        <h2 className="text-xl font-semibold">
          Список закупівель
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Заплановані та
          оприбутковані матеріали
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b bg-gray-50 p-4 md:grid-cols-[1fr_220px]">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук за матеріалом або постачальником"
          className="w-full rounded-lg border bg-white px-4 py-3 outline-none focus:border-green-600"
        />

        <select
          value={status}
          onChange={(event) => {
            setStatus(
              event.target.value
            );

            setEditingId(null);
          }}
          className="w-full rounded-lg border bg-white px-4 py-3"
        >
          <option value="Заплановано">
            Заплановані
          </option>

          <option value="Закуплено">
            Закуплені
          </option>

          <option value="Усі">
            Усі закупівлі
          </option>
        </select>
      </div>

      {filteredPurchases.length ===
      0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-500">
            Закупівель за вибраними
            параметрами немає.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b px-5 py-3">
            <p className="text-sm text-gray-500">
              Знайдено закупівель:{" "}
              {filteredPurchases.length}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-4">
                    Матеріал
                  </th>

                  <th className="p-4">
                    Кількість
                  </th>

                  <th className="p-4">
                    Ціна
                  </th>

                  <th className="p-4">
                    Загальна сума
                  </th>

                  <th className="p-4">
                    Постачальник
                  </th>

                  <th className="p-4">
                    Статус
                  </th>

                  <th className="p-4">
                    Дата
                  </th>

                  <th className="p-4 text-right">
                    Дії
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPurchases.map(
                  (purchase) => {
                    const quantity =
                      Number(
                        purchase.quantity
                      );

                    const price =
                      Number(
                        purchase.purchase_price
                      );

                    const isCompleted =
                      purchase.status ===
                      "Закуплено";

                    const isEditing =
                      editingId ===
                      purchase.id;

                    return (
                      <Fragment
                        key={purchase.id}
                      >
                        <tr className="border-t">
                          <td className="p-4">
                            <p className="font-semibold">
                              {purchase.item
                                ?.name ||
                                "Позицію видалено"}
                            </p>

                            {purchase.note && (
                              <p className="mt-1 max-w-[280px] text-sm text-gray-500">
                                {
                                  purchase.note
                                }
                              </p>
                            )}
                          </td>

                          <td className="p-4 font-medium">
                            {quantity}{" "}
                            {purchase.item
                              ?.unit || ""}
                          </td>

                          <td className="p-4">
                            {formatMoney(
                              price,
                              currency
                            )}
                          </td>

                          <td className="p-4 font-semibold text-green-700">
                            {formatMoney(
                              quantity *
                                price,
                              currency
                            )}
                          </td>

                          <td className="p-4 text-gray-600">
                            {purchase.supplier ||
                              "Не вказано"}
                          </td>

                          <td className="p-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                isCompleted
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {
                                purchase.status
                              }
                            </span>
                          </td>

                          <td className="p-4 text-sm text-gray-500">
                            {formatDate(
                              isCompleted
                                ? purchase.purchased_at
                                : purchase.created_at
                            )}
                          </td>

                          <td className="p-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              {!isCompleted && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingId(
                                        isEditing
                                          ? null
                                          : purchase.id
                                      )
                                    }
                                    className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                                  >
                                    {isEditing
                                      ? "Закрити"
                                      : "Редагувати"}
                                  </button>

                                  <form
                                    action={completeWarehousePurchase.bind(
                                      null,
                                      purchase.id
                                    )}
                                    onSubmit={(
                                      event
                                    ) => {
                                      const confirmed =
                                        window.confirm(
                                          `Оприбуткувати закупівлю «${
                                            purchase
                                              .item
                                              ?.name ||
                                            "Матеріал"
                                          }» на склад?\n\nНа склад буде додано ${quantity} ${
                                            purchase
                                              .item
                                              ?.unit ||
                                            ""
                                          }.`
                                        );

                                      if (
                                        !confirmed
                                      ) {
                                        event.preventDefault();
                                      }
                                    }}
                                  >
                                    <button
                                      type="submit"
                                      className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                                    >
                                      Оприбуткувати
                                    </button>
                                  </form>

                                  <form
                                    action={deleteWarehousePurchase.bind(
                                      null,
                                      purchase.id
                                    )}
                                    onSubmit={(
                                      event
                                    ) => {
                                      const confirmed =
                                        window.confirm(
                                          `Видалити заплановану закупівлю «${
                                            purchase
                                              .item
                                              ?.name ||
                                            "Матеріал"
                                          }»?`
                                        );

                                      if (
                                        !confirmed
                                      ) {
                                        event.preventDefault();
                                      }
                                    }}
                                  >
                                    <button
                                      type="submit"
                                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                    >
                                      Видалити
                                    </button>
                                  </form>
                                </>
                              )}

                              {isCompleted && (
                                <span className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                                  ✓ Додано на
                                  склад
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isEditing &&
                          !isCompleted && (
                            <tr className="border-t">
                              <td
                                colSpan={8}
                                className="p-4"
                              >
                                <EditPurchaseForm
                                  purchase={
                                    purchase
                                  }
                                  onCancel={() =>
                                    setEditingId(
                                      null
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          )}
                      </Fragment>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}