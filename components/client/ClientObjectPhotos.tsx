"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ClientObjectPhoto, ClientObjectPhotosPage } from "@/types/clientPhoto";

const fileUrl = (photo: ClientObjectPhoto) => `/client/objects/${photo.object_id}/photos/${photo.id}/file`;

export default function ClientObjectPhotos({ objectId, photos }: {
  objectId: number;
  // null means technical failure, not an empty/unpublished gallery.
  photos: ClientObjectPhotosPage | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<ClientObjectPhoto | null>(null);
  const close = () => { dialog.current?.close(); setSelected(null); };

  return <section aria-labelledby="client-photos-title" className="min-w-0 space-y-5 rounded-2xl border bg-white p-5 sm:p-8">
    <h2 id="client-photos-title" className="text-lg font-semibold text-gray-900">Фото</h2>
    {!photos ? <p role="status" className="text-sm leading-relaxed text-gray-600">
      Не вдалося завантажити фото. Спробуйте оновити сторінку пізніше.
    </p> : photos.items.length === 0 ? <p className="text-sm text-gray-600">Фото ще не опубліковано.</p> : <>
      <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.items.map((photo) => <li key={photo.id} className="min-w-0 overflow-hidden rounded-xl border border-gray-100">
          <button type="button" aria-haspopup="dialog" aria-label={photo.caption ? `Відкрити фото: ${photo.caption}` : "Відкрити фото"}
            className="block w-full focus-visible:outline-2 focus-visible:outline-green-700 focus-visible:outline-offset-2"
            onClick={() => { setSelected(photo); dialog.current?.showModal(); }}>
            {/* Authenticated, private/no-store endpoint: do not use shared image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(photo)} alt={photo.caption || "Фото об’єкта"} loading="lazy" decoding="async"
              className="aspect-[4/3] w-full bg-gray-50 object-cover" />
          </button>
          {photo.caption && <p className="whitespace-pre-wrap break-words p-3 text-sm leading-relaxed text-gray-700">{photo.caption}</p>}
        </li>)}
      </ul>
      {(photos.page > 1 || photos.hasNextPage) && <nav aria-label="Сторінки фото" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {photos.page > 1 && <Link prefetch={false} href={`/client/objects/${objectId}?photoPage=${photos.page - 1}`}
          className="min-h-11 rounded-lg border px-4 py-3">← Попередня</Link>}
        <span className="text-gray-500">Сторінка {photos.page}</span>
        {photos.hasNextPage && <Link prefetch={false} href={`/client/objects/${objectId}?photoPage=${photos.page + 1}`}
          className="min-h-11 rounded-lg border px-4 py-3">Наступна →</Link>}
      </nav>}
    </>}
    <dialog ref={dialog} aria-labelledby="client-photo-preview-title" onClose={() => setSelected(null)}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl border bg-white p-4 text-gray-900 shadow-xl backdrop:bg-black/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="client-photo-preview-title" className="font-semibold">Перегляд фото</h3>
        <button type="button" onClick={close} className="min-h-11 rounded-lg border px-4 py-2">Закрити</button>
      </div>
      {selected && <figure className="min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl(selected)} alt={selected.caption || "Фото об’єкта"}
          className="max-h-[65dvh] w-full object-contain" />
        {selected.caption && <figcaption className="mt-3 whitespace-pre-wrap break-words text-sm">{selected.caption}</figcaption>}
      </figure>}
    </dialog>
  </section>;
}
