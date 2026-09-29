import "server-only";

import Link from "next/link";
import { formatObjectDocumentFileSize } from "@/constants/objectDocuments";
import { clientDocumentFileType } from "@/lib/clientDocument";
import { formatKyivTimestamp } from "@/lib/kyivDate";
import type { ClientObjectDocumentsPage } from "@/types/clientDocument";
import { Download, FileText, Image as ImageIcon, Sheet } from "lucide-react";
import ClientPortalState from "@/components/client/ClientPortalState";

export default function ClientObjectDocuments({ objectId, documents, photoPage = 1 }: {
  objectId: number;
  documents: ClientObjectDocumentsPage | null;
  photoPage?: number;
}) {
  const pageUrl = (page: number) => `/client/objects/${objectId}?documentPage=${page}${photoPage > 1 ? `&photoPage=${photoPage}` : ""}#client-documents-title`;
  return <section aria-labelledby="client-documents-title" className="min-w-0 space-y-5 rounded-2xl border bg-white p-5 sm:p-8">
    <div className="space-y-1"><h2 id="client-documents-title" className="scroll-mt-24 text-lg font-semibold text-gray-900">Документи</h2><p className="text-sm text-gray-600">Опубліковані для вас файли. Натисніть «Завантажити», щоб зберегти документ.</p></div>
    {!documents ? <ClientPortalState error title="Не вдалося завантажити документи. Спробуйте оновити сторінку пізніше." />
      : documents.items.length === 0 ? <ClientPortalState title="Документи ще не опубліковано." description="Тут з’являться файли, якими з вами поділиться менеджер." /> : <>
      <ul className="min-w-0 space-y-3">
        {documents.items.map((document) => {
          const type = clientDocumentFileType(document.mime_type);
          const Icon = document.mime_type.startsWith("image/") ? ImageIcon : type?.label === "Excel" || type?.label === "CSV" ? Sheet : FileText;
          return <li key={document.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-start sm:p-5">
          <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-800"><Icon className="size-5" /></div>
          <div className="min-w-0 flex-1 space-y-2">
          <h3 className="break-words font-semibold text-gray-900 [overflow-wrap:anywhere]">{document.title}</h3>
          {document.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 [overflow-wrap:anywhere]">{document.description}</p>}
          <p className="text-xs text-gray-500">{clientDocumentFileType(document.mime_type)?.label} · {formatObjectDocumentFileSize(document.file_size)}</p>
          <p className="text-xs text-gray-500">Опубліковано: <time dateTime={document.published_at}>{formatKyivTimestamp(document.published_at)}</time></p>
          </div>
          <a href={`/client/objects/${objectId}/documents/${document.id}/file`} download
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-3 text-sm font-medium text-white hover:bg-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 sm:w-auto">
            <Download aria-hidden="true" className="size-4" />Завантажити<span className="sr-only">: {document.title}</span>
          </a>
        </li>; })}
      </ul>
      {(documents.page > 1 || documents.hasNextPage) && <nav aria-label="Сторінки документів" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="w-full text-center text-gray-500">Сторінка {documents.page}</span>
        {documents.page > 1 && <Link prefetch={false} href={pageUrl(documents.page - 1)} className="min-h-11 rounded-lg border px-3 py-3 focus-visible:outline-2 focus-visible:outline-green-700">← Назад</Link>}
        {documents.hasNextPage && <Link prefetch={false} href={pageUrl(documents.page + 1)} className="min-h-11 rounded-lg border px-3 py-3 focus-visible:outline-2 focus-visible:outline-green-700">Далі →</Link>}
      </nav>}
    </>}
  </section>;
}
