import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ClientObjectProgress from "@/components/client/ClientObjectProgress";
import ClientObjectPhotos from "@/components/client/ClientObjectPhotos";
import { ClientPhotoLoadError, getClientObjectPhotosPage } from "@/services/clientPhotoService";
import type { ClientObjectPhotosPage } from "@/types/clientPhoto";
import {
  ClientObjectProgressLoadError,
  getClientObject,
  getClientObjectProgress,
} from "@/services/clientPortalService";
import type { ClientObjectProgress as ClientObjectProgressDto } from "@/types/clientPortal";

export default async function ClientObjectPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ photoPage?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^\d+$/u.test(id)) notFound();
  const object = await getClientObject(Number(id));
  // Authorize the object first, then independently authorize its progress.
  // Resolve both before rendering so a revoked grant cannot leave a partial passport.
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
  let photos: ClientObjectPhotosPage | null = null;
  try {
    photos = await getClientObjectPhotosPage(object.id, photoPage);
  } catch (error) {
    // Only technical failures are local. Photo authorization/navigation errors
    // must abort the whole passport, including revocation after the object read.
    if (!(error instanceof ClientPhotoLoadError)) throw error;
  }
  if (photos && photos.page > 1 && photos.items.length === 0) {
    redirect(`/client/objects/${object.id}?photoPage=1`);
  }
  return <>
    <Link href="/client" className="inline-block py-2 text-sm font-medium text-green-700">← Ваші об’єкти</Link>
    <section className="min-w-0 space-y-4 rounded-2xl border bg-white p-5 sm:p-8">
      <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-sm text-green-800">{object.status}</span>
      <h1 className="break-words text-2xl font-bold sm:text-3xl">{object.name}</h1>
      <dl className="border-t pt-4"><dt className="text-sm text-gray-500">Адреса</dt><dd className="mt-1 break-words">{object.address || "Адресу не вказано"}</dd></dl>
    </section>
    <ClientObjectProgress progress={progress} unavailable={progressUnavailable} />
    <ClientObjectPhotos key={`${object.id}:${photoPage}`} objectId={object.id} photos={photos} />
  </>;
}
