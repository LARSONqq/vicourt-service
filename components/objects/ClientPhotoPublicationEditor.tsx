"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveClientPhotoPublication } from "@/app/actions/clientPhotoActions";
import { clientPhotoPublicationInput, CLIENT_PHOTO_CAPTION_LIMIT } from "@/lib/clientPhoto";
import { ClientPortalInputError } from "@/lib/clientPortal";
import type { ClientPhotoPublicationEditorState, SetClientPhotoPublicationInput } from "@/types/clientPhoto";

const buttonClass = "min-h-10 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
const inputClass = "mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

export default function ClientPhotoPublicationEditor({ objectId, initialPublication }: {
  objectId: number;
  initialPublication: ClientPhotoPublicationEditorState | null;
}) {
  const router = useRouter();
  const [publication, setPublication] = useState(initialPublication);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(initialPublication?.client_caption ?? "");
  const [order, setOrder] = useState(String(initialPublication?.sort_order ?? 0));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lock = useRef(false);

  async function save(input: SetClientPhotoPublicationInput) {
    if (lock.current || !publication) return;
    lock.current = true; setPending(true); setError(null); setSuccess(null);
    try {
      const result = await saveClientPhotoPublication(input);
      if (!result.ok) { setError(result.message); return; }
      setPublication(result.publication);
      setCaption(result.publication.client_caption ?? "");
      setOrder(String(result.publication.sort_order));
      setEditing(false);
      setSuccess(result.publication.is_published ? "Публікацію збережено." : "Фото приховано від клієнтів.");
    } catch {
      setError("Не вдалося зберегти публікацію фото. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      lock.current = false; setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !publication) return;
    setError(null); setSuccess(null);
    let input: SetClientPhotoPublicationInput;
    try {
      if (!/^\d+$/u.test(order)) throw new ClientPortalInputError("Порядок має бути цілим числом від 0.");
      input = clientPhotoPublicationInput({ object_id: objectId, photo_id: publication.photo_id,
        is_published: true, client_caption: caption, sort_order: Number(order) });
    } catch (failure) {
      setError(failure instanceof ClientPortalInputError ? failure.message : "Перевірте підпис і порядок.");
      return;
    }
    if (!publication.is_published && !window.confirm("Опублікувати це фото? Його бачитимуть клієнти, які мають доступ до цього об’єкта.")) return;
    await save(input);
  }

  async function unpublish() {
    if (lock.current || !publication?.is_published || !window.confirm("Приховати це фото від клієнтів?")) return;
    // Preserve saved caption/order, not any unsaved editor draft. Never delete.
    await save({ object_id: objectId, photo_id: publication.photo_id, is_published: false,
      client_caption: publication.client_caption, sort_order: publication.sort_order });
  }

  if (!publication) return <div className="mt-3 space-y-2 border-t pt-3 text-sm text-gray-600">
    <p role="status">Стан публікації недоступний.</p>
    <button type="button" className={buttonClass} onClick={() => router.refresh()}>Оновити стан</button>
  </div>;

  return <div className="mt-3 min-w-0 space-y-3 border-t pt-3" aria-busy={pending}>
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${publication.is_published ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-600"}`}>
      {publication.is_published ? "Видно клієнту" : "Не опубліковано"}
    </span>
    {!editing ? <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} className={`${buttonClass} text-green-800`} onClick={() => {
        setCaption(publication.client_caption ?? ""); setOrder(String(publication.sort_order));
        setError(null); setSuccess(null); setEditing(true);
      }}>{publication.is_published ? "Редагувати публікацію" : "Опублікувати для клієнта"}</button>
      {publication.is_published && <button type="button" disabled={pending} className={buttonClass} onClick={unpublish}>Приховати від клієнта</button>}
    </div> : <form onSubmit={submit} className="min-w-0 rounded-lg bg-gray-50 p-3">
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        <label className="block text-sm font-medium">Підпис для клієнта
          <textarea rows={3} maxLength={CLIENT_PHOTO_CAPTION_LIMIT} value={caption}
            onChange={(event) => setCaption(event.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-gray-500">Необов’язково, до 500 символів. Окремий від внутрішнього підпису.</span>
        </label>
        <label className="block text-sm font-medium">Порядок
          <input type="number" required min={0} max={2147483647} step={1} inputMode="numeric" value={order}
            onChange={(event) => setOrder(event.target.value)} className={inputClass} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="min-h-10 rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "Збереження…" : publication.is_published ? "Зберегти" : "Опублікувати"}
          </button>
          <button type="button" className={buttonClass} onClick={() => setEditing(false)}>Скасувати</button>
        </div>
      </fieldset>
    </form>}
    {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="text-sm text-green-800">{success}</p>}
  </div>;
}
