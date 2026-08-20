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

  const [
    wholePart,
    decimalPart,
  ] = safeValue
    .toFixed(2)
    .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${formattedWhole},${decimalPart} ${
    symbols[currency] ||
    currency
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

  const [
    year,
    month,
    day,
  ] = datePart.split("-");

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
    Array.isArray(
      purchases
    )
      ? purchases
      : [];

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState(
    "Заплановано"
  );

  const [
    editingId,
    setEditingId,
  ] = useState<
    number | null
  >(null);

  const filteredPurchases =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return safePurchases.filter(
        (purchase) => {
          const searchableText =
            [
              purchase.item
                ?.name,
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
            status ===
              "Усі" ||
            purchase.status ===
              status;

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
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      {/* HEADER */}
      <div className="border-b p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Список закупівель
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Заплановані та
          оприбутковані матеріали
        </p>
      </div>

      {/* FILTERS */}
      <div className="grid min-w-0 grid-cols-1 gap-3 border-b bg-gray-50 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <input
          type="search"
          value={search}
          onChange={(
            event
          ) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Пошук за матеріалом або постачальником"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />

        <select
          value={status}
          onChange={(
            event
          ) => {
            setStatus(
              event.target.value
            );

            setEditingId(
              null
            );
          }}
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
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

      {/* EMPTY */}
      {filteredPurchases.length ===
      0 ? (
        <div className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            🛒
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Закупівель не знайдено
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Спробуй змінити пошук або
            вибраний статус.
          </p>
        </div>
      ) : (
        <>
          {/* COUNT */}
          <div className="border-b px-4 py-3 sm:px-5">
            <p className="text-sm text-gray-500">
              Знайдено закупівель:{" "}
              <span className="font-semibold text-gray-800">
                {
                  filteredPurchases.length
                }
              </span>
            </p>
          </div>

          {/* MOBILE CARDS */}
          <div className="space-y-3 p-3 md:hidden">
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

                const total =
                  quantity *
                  price;

                const isCompleted =
                  purchase.status ===
                  "Закуплено";

                const isEditing =
                  editingId ===
                  purchase.id;

                return (
                  <article
                    key={
                      purchase.id
                    }
                    className="min-w-0 rounded-xl border bg-white p-4"
                  >
                    {/* TOP */}
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-gray-900">
                          {purchase.item
                            ?.name ||
                            "Позицію видалено"}
                        </p>

                        {purchase.note && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-gray-500">
                            {
                              purchase.note
                            }
                          </p>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          isCompleted
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {
                          purchase.status
                        }
                      </span>
                    </div>

                    {/* TOTAL */}
                    <div
                      className={`mt-4 rounded-xl p-3 ${
                        isCompleted
                          ? "bg-green-50"
                          : "bg-gray-50"
                      }`}
                    >
                      <p className="text-xs text-gray-500">
                        Загальна сума
                      </p>

                      <p className="mt-1 break-words text-xl font-bold text-green-700">
                        {formatMoney(
                          total,
                          currency
                        )}
                      </p>
                    </div>

                    {/* DETAILS */}
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Кількість
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                          {
                            quantity
                          }{" "}
                          {purchase.item
                            ?.unit ||
                            ""}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Ціна за одиницю
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {formatMoney(
                            price,
                            currency
                          )}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Постачальник
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-gray-800">
                          {purchase.supplier ||
                            "Не вказано"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          {isCompleted
                            ? "Дата закупівлі"
                            : "Дата створення"}
                        </p>

                        <p className="mt-1 text-sm font-medium text-gray-800">
                          {formatDate(
                            isCompleted
                              ? purchase.purchased_at
                              : purchase.created_at
                          )}
                        </p>
                      </div>
                    </div>

                    {/* ACTIONS */}
                    {!isCompleted ? (
                      <div className="mt-4 border-t pt-4">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingId(
                                isEditing
                                  ? null
                                  : purchase.id
                              )
                            }
                            className="min-h-10 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
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
                            className="w-full"
                          >
                            <button
                              type="submit"
                              className="min-h-10 w-full rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                            >
                              Оприбуткувати
                            </button>
                          </form>
                        </div>

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
                          className="mt-2"
                        >
                          <button
                            type="submit"
                            className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Видалити закупівлю
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="mt-4 border-t pt-4">
                        <div className="rounded-lg bg-green-50 px-3 py-2.5 text-center text-sm font-medium text-green-700">
                          ✓ Додано на склад
                        </div>
                      </div>
                    )}

                    {/* MOBILE EDIT */}
                    {isEditing &&
                      !isCompleted && (
                        <div className="mt-4 min-w-0 border-t pt-4">
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
                        </div>
                      )}
                  </article>
                );
              }
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
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
                        key={
                          purchase.id
                        }
                      >
                        <tr className="border-t">
                          <td className="p-4">
                            <p className="font-semibold">
                              {purchase.item
                                ?.name ||
                                "Позицію видалено"}
                            </p>

                            {purchase.note && (
                              <p className="mt-1 max-w-[280px] break-words text-sm text-gray-500">
                                {
                                  purchase.note
                                }
                              </p>
                            )}
                          </td>

                          <td className="p-4 font-medium">
                            {
                              quantity
                            }{" "}
                            {purchase.item
                              ?.unit ||
                              ""}
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
                                colSpan={
                                  8
                                }
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