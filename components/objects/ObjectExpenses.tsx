"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";

import {
  deleteObjectExpense,
} from "@/app/actions/objectExpenseActions";

import type {
  ObjectExpense,
} from "@/types/objectExpense";

import AddObjectExpenseForm from "./AddObjectExpenseForm";
import EditObjectExpenseForm from "./EditObjectExpenseForm";

type Props = {
  expenses?: ObjectExpense[];
  objectId: number;
};

function formatMoney(
  value: number
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(safeValue);
}

function formatDate(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "uk-UA"
  ).format(date);
}

export default function ObjectExpenses({
  expenses = [],
  objectId,
}: Props) {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const safeExpenses =
    Array.isArray(expenses)
      ? expenses
      : [];

  const totalExpenses =
    useMemo(
      () =>
        safeExpenses.reduce(
          (
            total,
            expense
          ) => {
            const amount =
              Number(
                expense.amount
              );

            return (
              total +
              (
                Number.isFinite(
                  amount
                )
                  ? amount
                  : 0
              )
            );
          },
          0
        ),
      [safeExpenses]
    );

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold sm:text-xl">
            Інші витрати
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Доставка, паливо,
            оренда, послуги та інші
            витрати цього об’єкта
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Записів:{" "}
              {
                safeExpenses.length
              }
            </span>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              Разом:{" "}
              {formatMoney(
                totalExpenses
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowForm(
              (
                previous
              ) =>
                !previous
            )
          }
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-fit ${
            showForm
              ? "border bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {showForm
            ? "Закрити форму"
            : "+ Додати витрату"}
        </button>
      </div>

      {/* ADD */}
      {showForm && (
        <div className="mb-5 rounded-xl border bg-gray-50 p-3 sm:mb-6 sm:p-4">
          <AddObjectExpenseForm
            objectId={
              objectId
            }
            onSaved={() =>
              setShowForm(
                false
              )
            }
          />
        </div>
      )}

      {/* EMPTY */}
      {safeExpenses.length ===
      0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400">
            💰
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Інших витрат поки немає
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Додай витрати, які не
            входять у матеріали та
            оплату робіт.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE */}
          <div className="space-y-3 md:hidden">
            {safeExpenses.map(
              (expense) => (
                <Fragment
                  key={
                    expense.id
                  }
                >
                  <article className="min-w-0 rounded-xl border p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {
                            expense.category
                          }
                        </span>

                        <h3 className="mt-2 break-words font-semibold text-gray-900">
                          {
                            expense.description
                          }
                        </h3>

                        <p className="mt-1 text-xs text-gray-400">
                          {formatDate(
                            expense.expense_date
                          )}
                        </p>
                      </div>

                      <p className="shrink-0 text-right text-lg font-bold text-gray-900">
                        {formatMoney(
                          Number(
                            expense.amount
                          )
                        )}
                      </p>
                    </div>

                    {expense.note && (
                      <div className="mt-4 border-t pt-4">
                        <p className="text-xs text-gray-500">
                          Примітка
                        </p>

                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">
                          {
                            expense.note
                          }
                        </p>
                      </div>
                    )}

                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs text-gray-500">
                        Додав
                      </p>

                      <p className="mt-1 break-words text-sm font-medium text-gray-700">
                        {expense.created_by_name ||
                          "Не зафіксовано"}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(
                            editingId ===
                              expense.id
                              ? null
                              : expense.id
                          )
                        }
                        className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                      >
                        {editingId ===
                        expense.id
                          ? "Закрити"
                          : "Редагувати"}
                      </button>

                      <form
                        action={deleteObjectExpense.bind(
                          null,
                          expense.id,
                          objectId
                        )}
                        onSubmit={(
                          event
                        ) => {
                          const confirmed =
                            window.confirm(
                              `Видалити витрату «${expense.description}» на суму ${formatMoney(
                                Number(
                                  expense.amount
                                )
                              )}?`
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
                          className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Видалити
                        </button>
                      </form>
                    </div>
                  </article>

                  {editingId ===
                    expense.id && (
                    <EditObjectExpenseForm
                      expense={
                        expense
                      }
                      objectId={
                        objectId
                      }
                      onCancel={() =>
                        setEditingId(
                          null
                        )
                      }
                    />
                  )}
                </Fragment>
              )
            )}
          </div>

          {/* DESKTOP */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full min-w-[1050px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-600">
                  <th className="p-4 font-medium">
                    Дата
                  </th>

                  <th className="p-4 font-medium">
                    Категорія
                  </th>

                  <th className="p-4 font-medium">
                    Опис
                  </th>

                  <th className="p-4 font-medium">
                    Сума
                  </th>

                  <th className="p-4 font-medium">
                    Додав
                  </th>

                  <th className="p-4 text-right font-medium">
                    Дії
                  </th>
                </tr>
              </thead>

              <tbody>
                {safeExpenses.map(
                  (expense) => (
                    <Fragment
                      key={
                        expense.id
                      }
                    >
                      <tr className="border-t align-top">
                        <td className="whitespace-nowrap p-4 text-sm text-gray-500">
                          {formatDate(
                            expense.expense_date
                          )}
                        </td>

                        <td className="p-4">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                            {
                              expense.category
                            }
                          </span>
                        </td>

                        <td className="max-w-[320px] p-4">
                          <p className="font-medium text-gray-900">
                            {
                              expense.description
                            }
                          </p>

                          {expense.note && (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-500">
                              {
                                expense.note
                              }
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap p-4 font-semibold text-gray-900">
                          {formatMoney(
                            Number(
                              expense.amount
                            )
                          )}
                        </td>

                        <td className="p-4 text-sm text-gray-600">
                          {expense.created_by_name ||
                            "Не зафіксовано"}
                        </td>

                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingId(
                                  editingId ===
                                    expense.id
                                    ? null
                                    : expense.id
                                )
                              }
                              className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                              {editingId ===
                              expense.id
                                ? "Закрити"
                                : "Редагувати"}
                            </button>

                            <form
                              action={deleteObjectExpense.bind(
                                null,
                                expense.id,
                                objectId
                              )}
                              onSubmit={(
                                event
                              ) => {
                                const confirmed =
                                  window.confirm(
                                    `Видалити витрату «${expense.description}»?`
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
                          </div>
                        </td>
                      </tr>

                      {editingId ===
                        expense.id && (
                        <tr className="border-t">
                          <td
                            colSpan={
                              6
                            }
                            className="p-4"
                          >
                            <EditObjectExpenseForm
                              expense={
                                expense
                              }
                              objectId={
                                objectId
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
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}