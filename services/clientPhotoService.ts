import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_PHOTO_PAGE_SIZE, clientObjectPhotoDto, positivePhotoId } from "@/lib/clientPhoto";
import { requireClientAccess } from "@/services/clientPortalService";
import type { ClientObjectPhotosPage } from "@/types/clientPhoto";

export class ClientPhotoLoadError extends Error {
  constructor() { super("Не вдалося завантажити фото. Спробуйте пізніше."); this.name = "ClientPhotoLoadError"; }
}

async function photoRpc(name: "get_client_object_photos" | "get_client_object_photo_file", args: Record<string, number>) {
  const supabase = await createClient();
  const response = await Promise.resolve(supabase.rpc(name, args)).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "42501") notFound();
    throw new ClientPhotoLoadError();
  });
  if (response.error?.code === "42501") notFound();
  if (response.error || !Array.isArray(response.data)) throw new ClientPhotoLoadError();
  return response.data as unknown[];
}

export async function getClientObjectPhotosPage(objectId: number, requestedPage = 1): Promise<ClientObjectPhotosPage> {
  await requireClientAccess();
  if (!positivePhotoId(objectId)) notFound();
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const rows = await photoRpc("get_client_object_photos", { p_object_id: objectId, p_page: page });
  if (rows.length > CLIENT_PHOTO_PAGE_SIZE) throw new ClientPhotoLoadError();
  let items;
  try { items = rows.map(clientObjectPhotoDto); } catch { throw new ClientPhotoLoadError(); }
  if (items.some((photo) => photo.object_id !== objectId)) notFound();
  if (new Set(items.map((photo) => photo.id)).size !== items.length) throw new ClientPhotoLoadError();
  const totalCount = rows.length ? (rows[0] as Record<string, unknown>).total_count : page === 1 ? 0 : null;
  if (rows.length && (!Number.isSafeInteger(totalCount) || Number(totalCount) < (page - 1) * CLIENT_PHOTO_PAGE_SIZE + rows.length
    || rows.some((row) => (row as Record<string, unknown>).total_count !== totalCount))) throw new ClientPhotoLoadError();
  return { items, page, pageSize: CLIENT_PHOTO_PAGE_SIZE, totalCount: totalCount as number | null,
    hasNextPage: typeof totalCount === "number" && page * CLIENT_PHOTO_PAGE_SIZE < totalCount };
}

// SERVER-ONLY delivery reference. Do not pass this return value to a gallery,
// Server Action response or Client Component. Future delivery must recheck via
// authenticated Storage GET; a prior file lookup is not a reusable access grant.
export async function getClientObjectPhotoFile(objectId: number, photoId: number): Promise<{ storage_path: string }> {
  await requireClientAccess();
  if (!positivePhotoId(objectId) || !positivePhotoId(photoId)) notFound();
  const rows = await photoRpc("get_client_object_photo_file", { p_object_id: objectId, p_photo_id: photoId });
  if (rows.length === 0) notFound();
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") throw new ClientPhotoLoadError();
  const path = (rows[0] as Record<string, unknown>).storage_path;
  if (typeof path !== "string" || !path || /[\\\u0000-\u001f]/u.test(path)
    || path.split("/").some((part) => !part || part === "." || part === "..")) throw new ClientPhotoLoadError();
  return { storage_path: path };
}
