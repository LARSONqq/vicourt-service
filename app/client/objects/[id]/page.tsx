import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ClientObjectProgress from "@/components/client/ClientObjectProgress";
import ClientObjectPhotos from "@/components/client/ClientObjectPhotos";
import ClientObjectDocuments from "@/components/client/ClientObjectDocuments";
import { ClientDocumentLoadError, getClientObjectDocumentsPage } from "@/services/clientDocumentService";
import type { ClientObjectDocumentsPage } from "@/types/clientDocument";
import { ClientPhotoLoadError, getClientObjectPhotosPage } from "@/services/clientPhotoService";
import type { ClientObjectPhotosPage } from "@/types/clientPhoto";
import {
  ClientObjectProgressLoadError,
  getClientObject,
  getClientObjectProgress,
} from "@/services/clientPortalService";
import type { ClientObjectProgress as ClientObjectProgressDto } from "@/types/clientPortal";
import ClientObjectNavigation from "@/components/client/ClientObjectNavigation";
import ClientObjectStatus from "@/components/client/ClientObjectStatus";
import { MapPin } from "lucide-react";

export default async function ClientObjectPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ photoPage?: string | string[]; documentPage?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^\d+$/u.test(id)) notFound();
  const object = await getClientObject(Number(id));
  // Authorize the object first, then independently authorize each section.
  // Resolve all before rendering so a revoked grant cannot leave a partial passport.
  let progress: ClientObjectProgressDto | null = null;
  let progressUnavailable = false;
  try {
    progress = await getClientObjectProgress(object.id);
  } catch (error) {
    if (!(error instanceof ClientObjectProgressLoadError)) throw error;
    progressUnavailable = true;
  }
  const query = await searchParams;
  const rawPage = query?.photoPage;
  const parsedPage = typeof rawPage === "string" && /^\d+$/u.test(rawPage) ? Number(rawPage) : 1;
  const photoPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 100000 ? parsedPage : 1;
  const rawDocumentPage = query?.documentPage;
  const parsedDocumentPage = typeof rawDocumentPage === "string" && /^\d+$/u.test(rawDocumentPage) ? Number(rawDocumentPage) : 1;
  const documentPage = Number.isSafeInteger(parsedDocumentPage) && parsedDocumentPage > 0 && parsedDocumentPage <= 100000 ? parsedDocumentPage : 1;
  let photos: ClientObjectPhotosPage | null = null;
  try {
    photos = await getClientObjectPhotosPage(object.id, photoPage);
  } catch (error) {
    // Only technical failures are local. Photo authorization/navigation errors
    // must abort the whole passport, including revocation after the object read.
    if (!(error instanceof ClientPhotoLoadError)) throw error;
  }
  let documents: ClientObjectDocumentsPage | null = null;
  try {
    documents = await getClientObjectDocumentsPage(object.id, documentPage);
  } catch (error) {
    if (!(error instanceof ClientDocumentLoadError)) throw error;
  }
  const emptyPhotoPage = photos && photos.page > 1 && photos.items.length === 0;
  const emptyDocumentPage = documents && documents.page > 1 && documents.items.length === 0;
  if (emptyPhotoPage || emptyDocumentPage) {
    const normalizedQuery = new URLSearchParams();
    if (emptyPhotoPage || photoPage > 1) normalizedQuery.set("photoPage", String(emptyPhotoPage ? 1 : photoPage));
    if (emptyDocumentPage || documentPage > 1) normalizedQuery.set("documentPage", String(emptyDocumentPage ? 1 : documentPage));
    redirect(`/client/objects/${object.id}?${normalizedQuery}`);
  }
  return <>
    <Link href="/client" className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-green-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-700">← Ваші об’єкти</Link>
    <section id="client-overview" aria-labelledby="client-object-title" className="min-w-0 scroll-mt-24 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
      <ClientObjectStatus status={object.status} />
      <h1 id="client-object-title" className="break-words text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{object.name}</h1>
      <p className="flex min-w-0 items-start gap-2 text-sm leading-relaxed text-gray-600"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{object.address || "Адресу не вказано"}</span></p>
    </section>
    <ClientObjectNavigation />
    <ClientObjectProgress progress={progress} unavailable={progressUnavailable} />
    <ClientObjectPhotos key={`${object.id}:${photoPage}`} objectId={object.id} photos={photos} documentPage={documentPage} />
    <ClientObjectDocuments objectId={object.id} documents={documents} photoPage={photoPage} />
  </>;
}
