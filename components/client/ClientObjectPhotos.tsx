"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ClientObjectPhoto, ClientObjectPhotosPage } from "@/types/clientPhoto";
import { ImageOff, Expand } from "lucide-react";
import ClientPortalState from "@/components/client/ClientPortalState";

const fileUrl = (photo: ClientObjectPhoto) => `/client/objects/${photo.object_id}/photos/${photo.id}/file`;

function PhotoImage({ photo, preview = false }: { photo: ClientObjectPhoto; preview?: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  return <span className={`relative flex min-w-0 items-center justify-center bg-gray-100 ${preview ? "min-h-24" : "aspect-[4/3]"}`}>
    {state === "error" ? <span role="status" className="block space-y-2 p-4 text-center text-sm text-gray-600">
      <ImageOff aria-hidden="true" className="mx-auto size-6" /><span className="block">Фото тимчасово недоступне.</span><span className="block text-xs">Спробуйте оновити сторінку.</span>
    </span> : <>
      {state === "loading" && <span aria-hidden="true" className="absolute inset-0 bg-gray-100 motion-safe:animate-pulse" />}
      {/* Same-origin private/no-store endpoint; no shared image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fileUrl(photo)} alt={photo.caption || "Фото об’єкта"} loading={preview ? "eager" : "lazy"} decoding="async"
        onLoad={() => setState("ready")} onError={() => setState("error")}
        className={preview ? "relative max-h-[65dvh] w-full object-contain" : "absolute inset-0 h-full w-full object-cover"} />
    </>}
  </span>;
}

export default function ClientObjectPhotos({ objectId, photos, documentPage = 1 }: {
  objectId: number;
  // null means technical failure, not an empty/unpublished gallery.
  photos: ClientObjectPhotosPage | null;
  documentPage?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<ClientObjectPhoto | null>(null);
  const close = () => { dialog.current?.close(); setSelected(null); };

  return <section aria-labelledby="client-photos-title" className="min-w-0 space-y-5 rounded-2xl border bg-white p-5 sm:p-8">
    <div className="space-y-1"><h2 id="client-photos-title" className="scroll-mt-24 text-lg font-semibold text-gray-900">Фото</h2><p className="text-sm text-gray-600">Погляньте, як змінюється ваш об’єкт. Натисніть на фото, щоб роздивитися ближче.</p></div>
    {!photos ? <ClientPortalState error title="Не вдалося завантажити фото. Спробуйте оновити сторінку пізніше." />
      : photos.items.length === 0 ? <ClientPortalState title="Фото ще не опубліковано." description="Нові знімки з’являться тут після публікації менеджером." /> : <>
      <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.items.map((photo) => <li key={photo.id} className="min-w-0 overflow-hidden rounded-xl border border-gray-100">
          <button type="button" aria-haspopup="dialog" aria-label={photo.caption ? `Відкрити фото: ${photo.caption}` : "Відкрити фото"}
            className="relative block w-full rounded-xl focus-visible:outline-2 focus-visible:outline-green-700 focus-visible:-outline-offset-2"
            onClick={() => { setSelected(photo); dialog.current?.showModal(); }}>
            <PhotoImage key={photo.id} photo={photo} />
            <span aria-hidden="true" className="absolute bottom-2 right-2 rounded-lg bg-white/95 p-2 text-green-900 shadow-sm"><Expand className="size-4" /></span>
          </button>
          {photo.caption && <p className="whitespace-pre-wrap break-words p-3 text-sm leading-relaxed text-gray-700 [overflow-wrap:anywhere]">{photo.caption}</p>}
        </li>)}
      </ul>
      {(photos.page > 1 || photos.hasNextPage) && <nav aria-label="Сторінки фото" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="w-full text-center text-gray-500">Сторінка {photos.page}</span>
        {photos.page > 1 && <Link prefetch={false} href={`/client/objects/${objectId}?photoPage=${photos.page - 1}${documentPage > 1 ? `&documentPage=${documentPage}` : ""}#client-photos-title`}
          className="min-h-11 rounded-lg border px-3 py-3 focus-visible:outline-2 focus-visible:outline-green-700">← Назад</Link>}
        {photos.hasNextPage && <Link prefetch={false} href={`/client/objects/${objectId}?photoPage=${photos.page + 1}${documentPage > 1 ? `&documentPage=${documentPage}` : ""}#client-photos-title`}
          className="min-h-11 rounded-lg border px-3 py-3 focus-visible:outline-2 focus-visible:outline-green-700">Далі →</Link>}
      </nav>}
    </>}
    <dialog ref={dialog} aria-labelledby="client-photo-preview-title" onClose={() => setSelected(null)}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl border bg-white p-4 text-gray-900 shadow-xl backdrop:bg-black/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="client-photo-preview-title" className="font-semibold">Перегляд фото</h3>
        <button type="button" onClick={close} className="min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-green-700">Закрити</button>
      </div>
      {selected && <figure className="min-w-0">
        <PhotoImage key={selected.id} photo={selected} preview />
        {selected.caption && <figcaption className="mt-3 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{selected.caption}</figcaption>}
      </figure>}
    </dialog>
  </section>;
}
