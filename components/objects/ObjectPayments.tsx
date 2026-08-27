"use client";

import {
  Fragment,
  useState,
} from "react";

import {
  deleteObjectPayment,
} from "@/app/actions/objectPaymentActions";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  ObjectPayment,
} from "@/types/objectPayment";

import ObjectPaymentForm from "./ObjectPaymentForm";

type Props = {
  objectId: number;
  payments: ObjectPayment[];
  today: string;
};

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "uk-UA",
    {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(value)
      ? value
      : 0
  );
}

export default function ObjectPayments({
  objectId,
  payments,
  today,
}: Props) {
  const [showForm, setShowForm] =
    useState(false);
  const [editingId, setEditingId] =
    useState<number | null>(
      null
    );
  const safePayments =
    Array.isArray(payments)
      ? payments
      : [];

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="flex min-w-0 flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
            Історія платежів
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Фактично отримані платежі
            клієнта по цьому об’єкту
          </p>

          <p className="mt-2 text-xs text-gray-500">
            Записів: {safePayments.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm(
              (current) =>
                !current
            );
            setEditingId(null);
          }}
          className={`min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-fit ${
            showForm
              ? "border bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {showForm
            ? "Закрити форму"
            : "+ Додати платіж"}
        </button>
      </div>

      {showForm && (
        <div className="border-b bg-gray-50 p-3 sm:p-5">
          <ObjectPaymentForm
            objectId={objectId}
            today={today}
            onSaved={() =>
              setShowForm(false)
            }
          />
        </div>
      )}

      {safePayments.length ===
      0 ? (
        <div className="p-4 sm:p-5">
          <div className="rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400">
              ₴
            </div>
            <p className="mt-3 font-medium text-gray-700">
              Платежів поки немає
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Додай перший фактично
              отриманий платіж клієнта.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {safePayments.map(
              (payment) => (
                <Fragment
                  key={payment.id}
                >
                  <article className="min-w-0 rounded-xl border p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          {formatDateValue(
                            payment.payment_date
                          ) ||
                            payment.payment_date}
                        </p>
                        <p className="mt-1 break-words text-sm font-medium text-gray-700">
                          {payment.payment_method ||
                            "Спосіб не вказано"}
                        </p>
                      </div>
                      <strong className="shrink-0 break-words text-right text-lg text-green-700">
                        {formatMoney(
                          Number(
                            payment.amount
                          )
                        )}
                      </strong>
                    </div>

                    {payment.note && (
                      <p className="mt-4 whitespace-pre-wrap break-words border-t pt-4 text-sm text-gray-600">
                        {payment.note}
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(
                            editingId ===
                              payment.id
                              ? null
                              : payment.id
                          );
                          setShowForm(false);
                        }}
                        className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                      >
                        {editingId ===
                        payment.id
                          ? "Закрити"
                          : "Редагувати"}
                      </button>

                      <form
                        action={deleteObjectPayment.bind(
                          null,
                          payment.id,
                          objectId
                        )}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              `Видалити платіж ${formatMoney(
                                Number(
                                  payment.amount
                                )
                              )}?`
                            )
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
                    payment.id && (
                    <div className="rounded-xl border bg-gray-50 p-3">
                      <ObjectPaymentForm
                        objectId={objectId}
                        today={today}
                        payment={payment}
                        onSaved={() =>
                          setEditingId(
                            null
                          )
                        }
                        onCancel={() =>
                          setEditingId(
                            null
                          )
                        }
                      />
                    </div>
                  )}
                </Fragment>
              )
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="p-4 font-medium">
                    Дата
                  </th>
                  <th className="p-4 font-medium">
                    Сума
                  </th>
                  <th className="p-4 font-medium">
                    Спосіб оплати
                  </th>
                  <th className="p-4 font-medium">
                    Примітка
                  </th>
                  <th className="p-4 text-right font-medium">
                    Дії
                  </th>
                </tr>
              </thead>

              <tbody>
                {safePayments.map(
                  (payment) => (
                    <Fragment
                      key={payment.id}
                    >
                      <tr className="border-t align-top">
                        <td className="p-4 text-gray-700">
                          {formatDateValue(
                            payment.payment_date
                          ) ||
                            payment.payment_date}
                        </td>
                        <td className="p-4 font-semibold text-green-700">
                          {formatMoney(
                            Number(
                              payment.amount
                            )
                          )}
                        </td>
                        <td className="p-4 text-gray-700">
                          {payment.payment_method ||
                            "Не вказано"}
                        </td>
                        <td className="max-w-sm whitespace-pre-wrap break-words p-4 text-gray-600">
                          {payment.note ||
                            "—"}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(
                                  editingId ===
                                    payment.id
                                    ? null
                                    : payment.id
                                );
                                setShowForm(false);
                              }}
                              className="rounded-lg border px-3 py-2 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                            >
                              {editingId ===
                              payment.id
                                ? "Закрити"
                                : "Редагувати"}
                            </button>
                            <form
                              action={deleteObjectPayment.bind(
                                null,
                                payment.id,
                                objectId
                              )}
                              onSubmit={(event) => {
                                if (
                                  !window.confirm(
                                    `Видалити платіж ${formatMoney(
                                      Number(
                                        payment.amount
                                      )
                                    )}?`
                                  )
                                ) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <button
                                type="submit"
                                className="rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              >
                                Видалити
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>

                      {editingId ===
                        payment.id && (
                        <tr className="border-t bg-gray-50">
                          <td
                            colSpan={5}
                            className="p-4"
                          >
                            <ObjectPaymentForm
                              objectId={objectId}
                              today={today}
                              payment={payment}
                              onSaved={() =>
                                setEditingId(
                                  null
                                )
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
