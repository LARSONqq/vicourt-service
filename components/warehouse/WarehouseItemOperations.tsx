"use client";

import { useId, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadWarehouseOperationOptions, submitWarehouseOperation } from "@/app/actions/warehousePassportActions";
import { formatWarehouseQuantity } from "@/lib/warehousePlanning";
import { formatKyivTimestamp } from "@/lib/kyivDate";
import type { AppCurrency } from "@/types/appSettings";
import type { WarehouseOperation, WarehouseOperationOptions } from "@/types/warehouseOperation";

type Props = {
  itemId: number;
  name: string;
  unit: string;
  currency: AppCurrency;
  canAdjust: boolean;
  purchasingOnly?: boolean;
  recommendedQuantity?: number | null;
  supplier?: string | null;
  plannedQuantity?: number | null;
  purchaseId?: number;
};

const labels: Record<WarehouseOperation, string> = {
  receipt: "Прихід", issue: "Видача", return: "Повернення", adjustment: "Коригування",
};
const buttons: Record<WarehouseOperation, string> = {
  receipt: "+ Прихід", issue: "− Видача", return: "↩ Повернення", adjustment: "± Коригування",
};
const fieldClass = "mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 font-normal text-gray-900 focus:border-green-600";
const buttonClass = "min-h-11 rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export default function WarehouseItemOperations({ itemId, name, unit, currency, canAdjust, purchasingOnly = false, recommendedQuantity = null, supplier = null, plannedQuantity = null, purchaseId }: Props) {
  const titleId = useId();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const submissionLock = useRef(false);
  const requestVersion = useRef(0);
  const [operation, setOperation] = useState<WarehouseOperation | null>(null);
  const [options, setOptions] = useState<WarehouseOperationOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [planning, setPlanning] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState("in");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [planMessage, setPlanMessage] = useState("");
  const busy = submitting || refreshing;

  function money(value: number) {
    return new Intl.NumberFormat("uk-UA", { style: "currency", currency }).format(Number(value));
  }

  async function loadOptions(nextOperation: WarehouseOperation, page = 1) {
    const version = ++requestVersion.current;
    setLoading(true);
    setOptions(null);
    setSelectedId("");
    setError("");
    try {
      const result = await loadWarehouseOperationOptions(itemId, nextOperation, page);
      if (requestVersion.current !== version) return;
      if (result.ok) {
        setOptions(result.data);
        if (nextOperation === "receipt") {
          const preferred = result.data.purchases.find((row) => row.id === purchaseId);
          if (preferred) setSelectedId(String(preferred.id));
          else if (result.data.purchases.length === 1) setSelectedId(String(result.data.purchases[0].id));
        }
      }
      else setError(result.error);
    } catch {
      if (requestVersion.current === version) setError("Не вдалося завантажити дані. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }

  function open(nextOperation: WarehouseOperation, startPlanning = false) {
    setOperation(nextOperation);
    setPlanning(startPlanning);
    setQuantity(startPlanning && recommendedQuantity ? String(recommendedQuantity) : "");
    setDirection("in");
    setPlanMessage("");
    setSuccess("");
    dialog.current?.showModal();
    void loadOptions(nextOperation);
  }

  function close() {
    if (submissionLock.current) return;
    requestVersion.current++;
    dialog.current?.close();
    setOperation(null);
    setOptions(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || busy || loading || !options || !operation) return;
    submissionLock.current = true;
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    data.set("operation", planning ? "plan" : operation);
    data.set("item_id", String(itemId));
    try {
      const result = await submitWarehouseOperation(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.planned) {
        setPlanning(false);
        setQuantity("");
        setPlanMessage("План закупівлі збережено. Залишок ще не змінено. Перевірте закупівлю та підтвердіть її фактичне отримання.");
        await loadOptions("receipt");
      } else {
        dialog.current?.close();
        setOperation(null);
        setOptions(null);
        setSuccess(`${labels[operation]}: операцію виконано.`);
      }
      startRefresh(() => router.refresh());
    } catch {
      setError("Не вдалося отримати підтвердження. Перед повторною спробою оновіть сторінку та перевірте залишок і журнал рухів.");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  const allocation = options?.allocations.find((row) => String(row.id) === selectedId);
  const purchase = options?.purchases.find((row) => String(row.id) === selectedId);
  const quantityValue = Number(quantity);
  const current = options?.currentQuantity ?? 0;
  const projected = current + (direction === "in" ? 1 : -1) * (Number.isFinite(quantityValue) ? quantityValue : 0);
  const maxQuantity = operation === "issue" ? current
    : operation === "return" ? Number(allocation?.quantity ?? 0)
      : operation === "adjustment" && direction === "out" ? current : undefined;
  const needsSelection = !planning && operation !== "adjustment";
  const canSubmit = Boolean(options) && (!needsSelection || Boolean(selectedId));

  return (
    <section className={purchasingOnly ? "min-w-0" : "min-w-0 rounded-xl border bg-white p-4 sm:p-5"}>
      {!purchasingOnly && <h2 className="mb-3 font-semibold text-gray-900">Операції з матеріалом</h2>}
      {!purchasingOnly && <p className="mb-3 text-sm text-gray-600">{plannedQuantity === null ? "План закупівель тимчасово недоступний." : plannedQuantity > 0 ? `Заплановано ${formatWarehouseQuantity(plannedQuantity)} ${unit} · Очікує отримання` : "Закупівлю не створено"}</p>}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {!purchasingOnly && <>
          <button type="button" disabled={busy} onClick={() => open("receipt")} className={`${buttonClass} border-green-600 text-green-700 hover:bg-green-50`}>{Number(plannedQuantity) > 0 ? "Прийняти на склад" : buttons.receipt}</button>
          <button type="button" disabled={busy} onClick={() => open("issue")} className={`${buttonClass} border-green-600 text-green-700 hover:bg-green-50`}>{buttons.issue}</button>
          <button type="button" disabled={busy} onClick={() => open("return")} className={`${buttonClass} border-green-600 text-green-700 hover:bg-green-50`}>{buttons.return}</button>
          {canAdjust && <button type="button" disabled={busy} onClick={() => open("adjustment")} className={`${buttonClass} border-green-600 text-green-700 hover:bg-green-50`}>{buttons.adjustment}</button>}
        </>}
        {(purchasingOnly || recommendedQuantity !== null) && (Number(plannedQuantity) > 0 && purchasingOnly ? (
          <button type="button" disabled={busy} onClick={() => open("receipt")} className={`${buttonClass} col-span-2 border-green-600 text-green-700 hover:bg-green-50`}>Прийняти на склад</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => open("receipt", true)} className={`${buttonClass} col-span-2 bg-green-600 text-white hover:bg-green-700`}>Запланувати закупівлю</button>
        ))}
      </div>
      {success && <p role="status" className="mt-3 text-sm text-green-700">{success} {refreshing ? "Оновлення залишку та історії…" : ""}</p>}

      <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border bg-white p-4 text-gray-900 shadow-xl backdrop:bg-black/40 sm:p-6">
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold">{planning ? "Запланувати закупівлю" : operation && labels[operation]}</h2>
            <p className="mt-1 break-words text-sm text-gray-500">{name}</p>
          </div>
          <button type="button" disabled={busy} onClick={close} aria-label="Закрити форму" className={`${buttonClass} shrink-0`}>✕</button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {planMessage && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{planMessage}</p>}
        {loading ? <p role="status" className="py-5 text-sm text-gray-500">Завантаження даних…</p>
          : !options ? <button type="button" disabled={busy} onClick={() => operation && void loadOptions(operation)} className={buttonClass}>Повторити завантаження</button>
            : <>
              <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">Поточний залишок: <strong>{formatWarehouseQuantity(current)} {unit}</strong></p>
              {operation === "receipt" && <div className="mb-4 space-y-3">
                <p className="text-sm text-gray-600">Прихід — це фактичне отримання всієї вибраної закупівлі. Планування саме по собі не змінює залишок.</p>
                <button type="button" disabled={busy} onClick={() => { setPlanning(!planning); setQuantity(!planning && recommendedQuantity ? String(recommendedQuantity) : ""); setError(""); }} className={`${buttonClass} w-full`}>
                  {planning ? "Назад до оприбуткування" : "Додати до плану закупівель"}
                </button>
                {planning && <p className="text-sm text-amber-800">Якщо вже є запланована закупівля, ця кількість додасться до неї. Перед оприбуткуванням перевірте загальну кількість і ціну.</p>}
              </div>}
              <form onSubmit={submit} className="min-w-0 space-y-4">
                <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-60">
                  {operation === "issue" && <label className="block min-w-0 text-sm font-medium">Об’єкт
                    <select name="object_id" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required className={fieldClass}>
                      <option value="">Оберіть об’єкт</option>
                      {options.objects.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                    </select>
                    {!options.objects.length && <span className="mt-2 block text-gray-500">Доступних об’єктів на цій сторінці немає.</span>}
                  </label>}
                  {operation === "return" && <label className="block min-w-0 text-sm font-medium">Виданий матеріал / об’єкт
                    <select name="material_id" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setQuantity(""); }} required className={fieldClass}>
                      <option value="">Оберіть залишок на об’єкті</option>
                      {options.allocations.map((row) => <option key={row.id} value={row.id}>{row.object?.name || `Об’єкт #${row.object_id}`} — {formatWarehouseQuantity(Number(row.quantity))} {unit} (#{row.id})</option>)}
                    </select>
                    {!options.allocations.length && <span className="mt-2 block text-gray-500">Немає виданих залишків для повернення на цій сторінці.</span>}
                  </label>}
                  {operation === "receipt" && !planning && <>
                    <label className="block min-w-0 text-sm font-medium">Запланована закупівля
                      <select name="purchase_id" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required className={fieldClass}>
                        <option value="">Оберіть закупівлю</option>
                        {options.purchases.map((row) => <option key={row.id} value={row.id}>#{row.id} — {formatWarehouseQuantity(Number(row.quantity))} {unit} · {row.supplier || "Без постачальника"}</option>)}
                      </select>
                    </label>
                    {!options.purchases.length && <p className="text-sm text-gray-500">Запланованих закупівель на цій сторінці немає. Додайте матеріал до плану, щоб оприбуткувати його після отримання.</p>}
                    {purchase && <div className="space-y-2 rounded-xl border bg-green-50 p-3 text-sm [overflow-wrap:anywhere]">
                      <p>Буде отримано: <strong>{formatWarehouseQuantity(Number(purchase.quantity))} {unit}</strong></p>
                      <p>Ціна за одиницю: {money(purchase.purchase_price)}</p>
                      <p>Постачальник: {purchase.supplier || "Не вказано"}</p>
                      <p>Створено: {formatKyivTimestamp(purchase.created_at)}</p>
                      {purchase.note && <p>Примітка: {purchase.note}</p>}
                      <label className="flex items-start gap-2"><input key={purchase.id} type="checkbox" required className="mt-1" />Підтверджую фактичне отримання цієї закупівлі в повному обсязі.</label>
                    </div>}
                  </>}
                  {!planning && operation !== "adjustment" && (options.page > 1 || options.hasMore) && <nav aria-label="Сторінки варіантів" className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button type="button" disabled={options.page <= 1} onClick={() => operation && void loadOptions(operation, options.page - 1)} className={buttonClass}>Назад</button>
                    <span>{options.page}</span>
                    <button type="button" disabled={!options.hasMore} onClick={() => operation && void loadOptions(operation, options.page + 1)} className={buttonClass}>Далі</button>
                  </nav>}
                  {operation === "adjustment" && <>
                    <p className="text-sm text-amber-800">Для інвентаризації, втрат або виправлення залишку. Звичайне отримання матеріалу оформлюйте через «Прихід».</p>
                    <label className="block text-sm font-medium">Напрямок
                      <select name="direction" value={direction} onChange={(event) => setDirection(event.target.value)} className={fieldClass}>
                        <option value="in">+ Збільшити залишок</option><option value="out">− Зменшити залишок</option>
                      </select>
                    </label>
                  </>}
                  {(planning || operation !== "receipt") && <label className="block text-sm font-medium">Кількість, {unit}
                    <input type="number" name="quantity" inputMode="decimal" min={planning ? "0.000001" : "0.01"} step={planning ? "0.000001" : "0.01"} max={planning ? undefined : maxQuantity} value={quantity} onChange={(event) => setQuantity(event.target.value)} required className={fieldClass} />
                  </label>}
                  {operation === "adjustment" && <>
                    <p aria-live="polite" className={`rounded-lg p-3 text-sm ${projected < 0 ? "bg-red-50 text-red-700" : "bg-gray-50"}`}>Очікуваний залишок: <strong>{formatWarehouseQuantity(projected)} {unit}</strong>. Остаточний залишок буде перевірено під час збереження.</p>
                    {direction === "in" && <label className="block text-sm font-medium">Облікова ціна за одиницю, {currency}
                      <input name="unit_cost" type="number" min="0" step="0.01" inputMode="decimal" required className={fieldClass} />
                    </label>}
                    <label className="block text-sm font-medium">Причина коригування
                      <textarea name="reason" required maxLength={2000} rows={3} className={fieldClass} />
                    </label>
                  </>}
                  {planning && <>
                    <label className="block text-sm font-medium">Закупівельна ціна за одиницю, {currency}<input name="purchase_price" type="number" min="0" step="0.01" inputMode="decimal" required className={fieldClass} /></label>
                    <label className="block text-sm font-medium">Постачальник (необов’язково)<input name="supplier" defaultValue={supplier || ""} maxLength={500} className={fieldClass} /></label>
                    <label className="block text-sm font-medium">Примітка (необов’язково)<textarea name="note" maxLength={2000} rows={3} className={fieldClass} /></label>
                  </>}
                  <button type="submit" disabled={!canSubmit || (operation === "adjustment" && projected < 0)} className={`${buttonClass} w-full bg-green-600 text-white hover:bg-green-700`}>
                    {submitting ? "Збереження…" : planning ? "Зберегти план закупівлі" : operation === "receipt" ? "Оприбуткувати закупівлю" : operation === "issue" ? "Видати на об’єкт" : operation === "return" ? "Повернути на склад" : "Зберегти коригування"}
                  </button>
                </fieldset>
              </form>
            </>}
      </dialog>
    </section>
  );
}
