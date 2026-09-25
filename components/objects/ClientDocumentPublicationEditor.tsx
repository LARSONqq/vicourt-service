"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveClientDocumentPublication } from "@/app/actions/clientDocumentActions";
import {
  clientDocumentPublicationInput, CLIENT_DOCUMENT_TITLE_LIMIT, CLIENT_DOCUMENT_DESCRIPTION_LIMIT,
} from "@/lib/clientDocument";
import { ClientPortalInputError } from "@/lib/clientPortal";
import type { ClientDocumentPublicationEditorState, SetClientDocumentPublicationInput } from "@/types/clientDocument";

const buttonClass = "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
const inputClass = "mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
const hideConfirmation = "Приховати документ від клієнтів? Оригінал залишиться у внутрішніх документах об’єкта.";

export default function ClientDocumentPublicationEditor({ objectId, defaultTitle, initialPublication }: {
  objectId: number;
  defaultTitle: string;
  initialPublication: ClientDocumentPublicationEditorState | null;
}) {
  const router = useRouter();
  const [publication, setPublication] = useState(initialPublication);
  const [editing, setEditing] = useState(false);
  const [published, setPublished] = useState(initialPublication?.is_published ?? false);
  const [title, setTitle] = useState(initialPublication?.client_title ?? defaultTitle);
  const [description, setDescription] = useState(initialPublication?.client_description ?? "");
  const [order, setOrder] = useState(String(initialPublication?.sort_order ?? 0));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lock = useRef(false);

  async function save(input: SetClientDocumentPublicationInput) {
    if (lock.current || !publication) return;
    lock.current = true; setPending(true); setError(null); setSuccess(null);
    try {
      const result = await saveClientDocumentPublication(input);
      if (!result.ok) { setError(result.message); return; }
      setPublication(result.publication);
      setEditing(false);
      setSuccess(result.publication.is_published ? "Публікацію збережено." : "Збережено. Документ не опубліковано для клієнтів.");
      // Keep the mobile card and desktop row in sync, without a full page reload.
      router.refresh();
    } catch {
      setError("Не вдалося зберегти публікацію документа. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      lock.current = false; setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !publication) return;
    setError(null); setSuccess(null);
    let input: SetClientDocumentPublicationInput;
    try {
      const normalizedTitle = title.replace(/^ +| +$/gu, "");
      if (!normalizedTitle || Array.from(normalizedTitle).length > CLIENT_DOCUMENT_TITLE_LIMIT) {
        throw new ClientPortalInputError("Вкажіть назву для клієнта від 1 до 150 символів.");
      }
      if (Array.from(description.replace(/^ +| +$/gu, "")).length > CLIENT_DOCUMENT_DESCRIPTION_LIMIT) {
        throw new ClientPortalInputError("Опис для клієнта має містити не більше 1000 символів.");
      }
      if (!/^\d+$/u.test(order) || Number(order) > 2147483647) {
        throw new ClientPortalInputError("Порядок має бути цілим числом від 0 до 2147483647.");
      }
      input = clientDocumentPublicationInput({ object_id: objectId, document_id: publication.document_id,
        is_published: published, client_title: title, client_description: description, sort_order: Number(order) });
    } catch (failure) {
      setError(failure instanceof ClientPortalInputError ? failure.message : "Перевірте назву, опис і порядок.");
      return;
    }
    if (published && !publication.is_published
      && !window.confirm("Опублікувати цей документ? Його бачитимуть клієнти, які мають доступ до цього об’єкта.")) return;
    if (!published && publication.is_published && !window.confirm(hideConfirmation)) return;
    await save(input);
  }

  async function unpublish() {
    if (lock.current || !publication?.is_published || !window.confirm(hideConfirmation)) return;
    // Preserve saved metadata; hiding never edits/deletes the source document.
    await save({ object_id: objectId, document_id: publication.document_id, is_published: false,
      client_title: publication.client_title ?? "", client_description: publication.client_description, sort_order: publication.sort_order });
  }

  if (!publication) return <div className="mt-3 space-y-2 border-t pt-3 text-sm text-gray-600">
    <p role="status">Стан публікації недоступний.</p>
    <button type="button" className={buttonClass} onClick={() => router.refresh()}>Оновити стан публікації</button>
  </div>;

  return <div className="mt-3 min-w-0 space-y-3 border-t pt-3" aria-busy={pending}>
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${publication.is_published ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-600"}`}>
      {publication.is_published ? "Видно клієнту" : "Не опубліковано"}
    </span>
    {!editing ? <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} className={`${buttonClass} text-green-800`} onClick={() => {
        setPublished(publication.is_published);
        setTitle(publication.client_title ?? defaultTitle);
        setDescription(publication.client_description ?? ""); setOrder(String(publication.sort_order));
        setError(null); setSuccess(null); setEditing(true);
      }}>Доступ клієнта</button>
      {publication.is_published && <button type="button" disabled={pending} className={buttonClass} onClick={unpublish}>Приховати від клієнта</button>}
    </div> : <form onSubmit={submit} className="min-w-0 rounded-lg bg-gray-50 p-3">
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} className="h-4 w-4 shrink-0 accent-green-700" />
          Видно клієнтам об’єкта
        </label>
        <p className="text-xs text-gray-500">Публікація для клієнтів окрема від внутрішнього рівня доступу. Оригінал документа не зміниться.</p>
        <label className="block text-sm font-medium">Назва для клієнта
          <input type="text" required maxLength={CLIENT_DOCUMENT_TITLE_LIMIT} value={title}
            onChange={(event) => setTitle(event.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-gray-500">Перевірте назву перед публікацією, до 150 символів.</span>
        </label>
        <label className="block text-sm font-medium">Опис для клієнта
          <textarea rows={3} maxLength={CLIENT_DOCUMENT_DESCRIPTION_LIMIT} value={description}
            onChange={(event) => setDescription(event.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-gray-500">Необов’язково, до 1000 символів. Внутрішня примітка не копіюється.</span>
        </label>
        <label className="block text-sm font-medium">Порядок
          <input type="number" required min={0} max={2147483647} step={1} inputMode="numeric" value={order}
            onChange={(event) => setOrder(event.target.value)} className={inputClass} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="min-h-11 rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "Збереження…" : published && !publication.is_published ? "Опублікувати" : "Зберегти"}
          </button>
          <button type="button" className={buttonClass} onClick={() => setEditing(false)}>Скасувати</button>
        </div>
      </fieldset>
    </form>}
    {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="text-sm text-green-800">{success}</p>}
  </div>;
}
