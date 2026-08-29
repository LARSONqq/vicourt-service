"use client";

import { Fragment, useMemo, useState } from "react";

import { deleteObjectPaymentScheduleItem } from "@/app/actions/objectPaymentScheduleActions";
import { objectPaymentScheduleStatusLabels } from "@/constants/objectPaymentSchedule";
import { formatDateValue } from "@/lib/kyivDate";
import { calculateObjectPaymentSchedule } from "@/lib/objectPaymentSchedule";

import type {
  AllocatedObjectPaymentScheduleItem,
  ObjectPaymentScheduleItem,
  ObjectPaymentScheduleStatus,
} from "@/types/objectPaymentSchedule";

import ObjectPaymentScheduleForm from "./ObjectPaymentScheduleForm";

type Props = {
  objectId: number;
  clientPrice: number | null;
  lifetimeTotalPaid: number;
  scheduleItems: ObjectPaymentScheduleItem[];
  today: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function getStatusStyle(status: ObjectPaymentScheduleStatus) {
  switch (status) {
    case "paid":
      return "bg-green-50 text-green-700";
    case "overdue":
      return "bg-red-50 text-red-700";
    case "due_today":
      return "bg-orange-50 text-orange-700";
    case "partially_paid":
      return "bg-blue-50 text-blue-700";
    case "planned":
      return "bg-gray-100 text-gray-700";
  }
}

function ScheduleActions({
  item,
  editingId,
  deletingId,
  onEdit,
  onDelete,
}: {
  item: AllocatedObjectPaymentScheduleItem;
  editingId: number | null;
  deletingId: number | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
      >
        {editingId === item.id ? "Закрити" : "Редагувати"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deletingId === item.id}
        className="min-h-10 rounded-lg border px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
      >
        {deletingId === item.id ? "Видалення..." : "Видалити"}
      </button>
    </div>
  );
}

export default function ObjectPaymentSchedule({
  objectId,
  clientPrice,
  lifetimeTotalPaid,
  scheduleItems,
  today,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const summary = useMemo(
    () =>
      calculateObjectPaymentSchedule(
        Array.isArray(scheduleItems) ? scheduleItems : [],
        lifetimeTotalPaid,
        clientPrice,
        today
      ),
    [clientPrice, lifetimeTotalPaid, scheduleItems, today]
  );

  async function handleDelete(item: AllocatedObjectPaymentScheduleItem) {
    if (!window.confirm(`Видалити етап оплати «${item.title}»? Фактичні платежі залишаться без змін.`)) {
      return;
    }
    setDeletingId(item.id);
    setErrorMessage("");
    try {
      await deleteObjectPaymentScheduleItem(item.id, objectId);
      if (editingId === item.id) setEditingId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не вдалося видалити етап оплати.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section id="payment-schedule" className="scroll-mt-24 min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="flex min-w-0 flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Графік оплат</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            Планові етапи. Фактичні надходження покривають їх послідовно за датою.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current);
            setEditingId(null);
            setErrorMessage("");
          }}
          className={`min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-fit ${
            showForm
              ? "border bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {showForm ? "Закрити форму" : "+ Додати етап"}
        </button>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 border-b bg-gray-50/60 p-3 sm:p-5 lg:grid-cols-5">
        {[
          ["Заплановано", formatMoney(summary.scheduledTotal)],
          ["Отримано", formatMoney(summary.totalPaid)],
          ["До отримання", formatMoney(summary.remainingToReceive)],
          ["Прострочено", formatMoney(summary.overdueAmount)],
          [
            "Наступний платіж",
            summary.nextPayment
              ? `${formatDateValue(summary.nextPayment.due_date)} · ${formatMoney(summary.nextPayment.remainingAmount)}`
              : "Немає",
          ],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border bg-white p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`mt-1 break-words text-sm font-semibold ${label === "Прострочено" && summary.overdueAmount > 0 ? "text-red-700" : "text-gray-900"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="border-b px-4 py-3 text-sm text-gray-600 sm:px-5">
        {clientPrice === null ? (
          <p>Вартість для клієнта не задана.</p>
        ) : summary.scheduleOverage && summary.scheduleOverage > 0 ? (
          <p className="text-orange-700">Перевищення графіка: {formatMoney(summary.scheduleOverage)}</p>
        ) : (
          <p>Не розподілено за графіком: {formatMoney(summary.unscheduledAmount ?? 0)}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Мало бути сплачено на сьогодні: {formatMoney(summary.cumulativeDue)}.
        </p>
      </div>

      {errorMessage && (
        <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:px-5">{errorMessage}</div>
      )}

      {showForm && (
        <div className="border-b bg-gray-50 p-3 sm:p-5">
          <ObjectPaymentScheduleForm objectId={objectId} onSaved={() => setShowForm(false)} />
        </div>
      )}

      {summary.items.length === 0 ? (
        <div className="p-4 sm:p-5">
          <div className="rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
            <p className="font-medium text-gray-700">Графік оплат ще не налаштовано</p>
            <p className="mt-1 text-sm text-gray-500">Додай планові етапи, не змінюючи фактичну історію платежів.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {summary.items.map((item) => (
              <Fragment key={item.id}>
                <article className="min-w-0 rounded-xl border p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDateValue(item.due_date)}</p>
                    </div>
                    <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(item.status)}`}>
                      {objectPaymentScheduleStatusLabels[item.status]}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-y py-3 text-sm">
                    <div><dt className="text-xs text-gray-500">План</dt><dd className="mt-1 font-medium">{formatMoney(item.amount)}</dd></div>
                    <div><dt className="text-xs text-gray-500">Оплачено</dt><dd className="mt-1 font-medium text-green-700">{formatMoney(item.paidAmount)}</dd></div>
                    <div><dt className="text-xs text-gray-500">Залишок</dt><dd className="mt-1 font-medium">{formatMoney(item.remainingAmount)}</dd></div>
                  </dl>
                  {item.note && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-600">{item.note}</p>}
                  <div className="mt-4">
                    <ScheduleActions
                      item={item}
                      editingId={editingId}
                      deletingId={deletingId}
                      onEdit={() => {
                        setEditingId(editingId === item.id ? null : item.id);
                        setShowForm(false);
                      }}
                      onDelete={() => handleDelete(item)}
                    />
                  </div>
                </article>
                {editingId === item.id && (
                  <div className="rounded-xl border bg-gray-50 p-3">
                    <ObjectPaymentScheduleForm
                      objectId={objectId}
                      scheduleItem={item}
                      onSaved={() => setEditingId(null)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  {['Назва', 'Дата', 'План', 'Оплачено', 'Залишок', 'Статус', 'Дії'].map((label) => (
                    <th key={label} className="p-4 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item) => (
                  <Fragment key={item.id}>
                    <tr className="border-t align-top">
                      <td className="max-w-xs p-4"><p className="break-words font-semibold text-gray-900">{item.title}</p>{item.note && <p className="mt-1 break-words text-xs text-gray-500">{item.note}</p>}</td>
                      <td className="p-4 text-gray-700">{formatDateValue(item.due_date)}</td>
                      <td className="p-4 font-medium">{formatMoney(item.amount)}</td>
                      <td className="p-4 font-medium text-green-700">{formatMoney(item.paidAmount)}</td>
                      <td className="p-4 font-medium">{formatMoney(item.remainingAmount)}</td>
                      <td className="p-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(item.status)}`}>{objectPaymentScheduleStatusLabels[item.status]}</span></td>
                      <td className="p-4"><ScheduleActions item={item} editingId={editingId} deletingId={deletingId} onEdit={() => { setEditingId(editingId === item.id ? null : item.id); setShowForm(false); }} onDelete={() => handleDelete(item)} /></td>
                    </tr>
                    {editingId === item.id && (
                      <tr className="border-t bg-gray-50"><td colSpan={7} className="p-4"><ObjectPaymentScheduleForm objectId={objectId} scheduleItem={item} onSaved={() => setEditingId(null)} onCancel={() => setEditingId(null)} /></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
