import "server-only";

import Link from "next/link";
import { formatObjectDocumentFileSize } from "@/constants/objectDocuments";
import { clientDocumentFileType } from "@/lib/clientDocument";
import { formatKyivTimestamp } from "@/lib/kyivDate";
import type { ClientObjectDocumentsPage } from "@/types/clientDocument";

export default function ClientObjectDocuments({ objectId, documents, photoPage = 1 }: {
  objectId: number;
  documents: ClientObjectDocumentsPage | null;
  photoPage?: number;
}) {
  const pageUrl = (page: number) => `/client/objects/${objectId}?documentPage=${page}${photoPage > 1 ? `&photoPage=${photoPage}` : ""}#client-documents-title`;
  return <section aria-labelledby="client-documents-title" className="min-w-0 space-y-5 rounded-2xl border bg-white p-5 sm:p-8">
    <h2 id="client-documents-title" className="text-lg font-semibold text-gray-900">Документи</h2>
    {!documents ? <p role="status" className="text-sm leading-relaxed text-gray-600">
      Не вдалося завантажити документи. Спробуйте оновити сторінку пізніше.
    </p> : documents.items.length === 0 ? <p className="text-sm text-gray-600">Документи ще не опубліковано.</p> : <>
      <ul className="min-w-0 space-y-3">
        {documents.items.map((document) => <li key={document.id} className="min-w-0 space-y-3 rounded-xl border border-gray-100 p-4">
          <h3 className="break-words font-semibold text-gray-900">{document.title}</h3>
          {document.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{document.description}</p>}
          <p className="text-xs text-gray-500">{clientDocumentFileType(document.mime_type)?.label} · {formatObjectDocumentFileSize(document.file_size)}</p>
          <p className="text-xs text-gray-500">Опубліковано: <time dateTime={document.published_at}>{formatKyivTimestamp(document.published_at)}</time></p>
          <a href={`/client/objects/${objectId}/documents/${document.id}/file`} download
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50">
            Завантажити<span className="sr-only">: {document.title}</span>
          </a>
        </li>)}
      </ul>
      {(documents.page > 1 || documents.hasNextPage) && <nav aria-label="Сторінки документів" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {documents.page > 1 && <Link prefetch={false} href={pageUrl(documents.page - 1)} className="min-h-11 rounded-lg border px-4 py-3">← Попередня</Link>}
        <span className="text-gray-500">Сторінка {documents.page}</span>
        {documents.hasNextPage && <Link prefetch={false} href={pageUrl(documents.page + 1)} className="min-h-11 rounded-lg border px-4 py-3">Наступна →</Link>}
      </nav>}
    </>}
  </section>;
}
