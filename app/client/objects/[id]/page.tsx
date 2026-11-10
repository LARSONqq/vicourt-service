import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ClientObjectOverview from "@/components/client/ClientObjectOverview";
import ClientObjectProgress from "@/components/client/ClientObjectProgress";
import ClientObjectPhotos from "@/components/client/ClientObjectPhotos";
import ClientObjectDocuments from "@/components/client/ClientObjectDocuments";
import ClientObjectNavigation, { clientObjectSection } from "@/components/client/ClientObjectNavigation";
import { ClientDocumentLoadError, getClientObjectDocumentsPage } from "@/services/clientDocumentService";
import type { ClientObjectDocumentsPage } from "@/types/clientDocument";
import { ClientPhotoLoadError, getClientObjectPhotosPage } from "@/services/clientPhotoService";
import type { ClientObjectPhotosPage } from "@/types/clientPhoto";
import { ClientObjectProgressLoadError, getClientObject, getClientObjectProgress } from "@/services/clientPortalService";
import type { ClientObjectProgress as ClientObjectProgressDto } from "@/types/clientPortal";
import ClientObjectStatus from "@/components/client/ClientObjectStatus";
import { MapPin } from "lucide-react";

type Query = {
  section?: string | string[];
  photoPage?: string | string[];
  documentPage?: string | string[];
};

function requestedPage(value: string | string[] | undefined) {
  const parsed = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000 ? parsed : 1;
}

export default async function ClientObjectPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Query>;
}) {
  const { id } = await params;
  if (!/^\d+$/u.test(id)) notFound();
  const object = await getClientObject(Number(id));
  const query = await searchParams;
  const section = clientObjectSection(query?.section);

  let progress: ClientObjectProgressDto | null = null;
  let progressUnavailable = false;
  let photos: ClientObjectPhotosPage | null = null;
  let documents: ClientObjectDocumentsPage | null = null;

  if (section === "overview" || section === "updates") {
    try {
      progress = await getClientObjectProgress(object.id);
    } catch (error) {
      if (!(error instanceof ClientObjectProgressLoadError)) throw error;
      progressUnavailable = true;
    }
  }

  if (section === "photos") {
    const page = requestedPage(query?.photoPage);
    try {
      photos = await getClientObjectPhotosPage(object.id, page);
    } catch (error) {
      if (!(error instanceof ClientPhotoLoadError)) throw error;
    }
    if (photos && photos.page > 1 && photos.items.length === 0) {
      redirect(`/client/objects/${object.id}?section=photos&photoPage=1`);
    }
  }

  if (section === "documents") {
    const page = requestedPage(query?.documentPage);
    try {
      documents = await getClientObjectDocumentsPage(object.id, page);
    } catch (error) {
      if (!(error instanceof ClientDocumentLoadError)) throw error;
    }
    if (documents && documents.page > 1 && documents.items.length === 0) {
      redirect(`/client/objects/${object.id}?section=documents&documentPage=1`);
    }
  }

  return <>
    <Link href="/client" className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700">← Ваші об’єкти</Link>
    <ClientObjectNavigation objectId={object.id} active={section} />
    {section !== "overview" && <header className="flex min-w-0 flex-col gap-3 rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-gray-200/80 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0"><h1 className="truncate text-lg font-semibold text-gray-950">{object.name}</h1><p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs text-gray-500"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span className="truncate">{object.address || "Адресу не вказано"}</span></p></div><ClientObjectStatus status={object.status} />
    </header>}
    {section === "overview" && <ClientObjectOverview object={object} progress={progress} unavailable={progressUnavailable} />}
    {section === "updates" && <ClientObjectProgress progress={progress} unavailable={progressUnavailable} />}
    {section === "photos" && <ClientObjectPhotos key={`${object.id}:${photos?.page ?? "error"}`} objectId={object.id} photos={photos} />}
    {section === "documents" && <ClientObjectDocuments objectId={object.id} documents={documents} />}
  </>;
}
