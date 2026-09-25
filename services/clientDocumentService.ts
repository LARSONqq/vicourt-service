import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_DOCUMENT_PAGE_SIZE, clientDocumentIsSafeFile, clientObjectDocumentDto, positiveDocumentId } from "@/lib/clientDocument";
import { requireClientAccess } from "@/services/clientPortalService";
import type { ClientObjectDocumentsPage } from "@/types/clientDocument";

export class ClientDocumentLoadError extends Error {
  constructor() { super("Не вдалося завантажити документи. Спробуйте пізніше."); this.name = "ClientDocumentLoadError"; }
}

async function documentRpc(name: "get_client_object_documents" | "get_client_object_document_file", args: Record<string, number>) {
  const supabase = await createClient();
  const response = await Promise.resolve(supabase.rpc(name, args)).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "42501") notFound();
    throw new ClientDocumentLoadError();
  });
  if (response.error?.code === "42501") notFound();
  if (response.error || !Array.isArray(response.data)) throw new ClientDocumentLoadError();
  return response.data as unknown[];
}

export async function getClientObjectDocumentsPage(objectId: number, requestedPage = 1): Promise<ClientObjectDocumentsPage> {
  await requireClientAccess();
  if (!positiveDocumentId(objectId)) notFound();
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const rows = await documentRpc("get_client_object_documents", { p_object_id: objectId, p_page: page });
  if (rows.length > CLIENT_DOCUMENT_PAGE_SIZE) throw new ClientDocumentLoadError();
  let items;
  try { items = rows.map(clientObjectDocumentDto); } catch { throw new ClientDocumentLoadError(); }
  if (items.some((item) => item.object_id !== objectId)) notFound();
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new ClientDocumentLoadError();
  const totalCount = rows.length ? (rows[0] as Record<string, unknown>).total_count : page === 1 ? 0 : null;
  if (rows.length && (!Number.isSafeInteger(totalCount)
    || Number(totalCount) < (page - 1) * CLIENT_DOCUMENT_PAGE_SIZE + rows.length
    || rows.some((row) => (row as Record<string, unknown>).total_count !== totalCount))) throw new ClientDocumentLoadError();
  return { items, page, pageSize: CLIENT_DOCUMENT_PAGE_SIZE, totalCount: totalCount as number | null,
    hasNextPage: typeof totalCount === "number" && page * CLIENT_DOCUMENT_PAGE_SIZE < totalCount };
}

// SERVER-ONLY delivery reference, not a DTO for RSC/actions/client components.
// Future delivery must independently authorize a user-scoped Storage GET.
// Knowing this path is not a bearer grant. No file route is added in 1.0C2b.
export async function getClientObjectDocumentFile(objectId: number, documentId: number): Promise<{
  storage_path: string; mime_type: string; client_title: string;
}> {
  await requireClientAccess();
  if (!positiveDocumentId(objectId) || !positiveDocumentId(documentId)) notFound();
  const rows = await documentRpc("get_client_object_document_file", { p_object_id: objectId, p_document_id: documentId });
  if (!rows.length) notFound();
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") throw new ClientDocumentLoadError();
  const row = rows[0] as Record<string, unknown>;
  const path = row.storage_path;
  if (typeof path !== "string" || !path || /[\\\u0000-\u001f\u007f]/u.test(path)
    || path.split("/").some((part) => !part || part === "." || part === "..")
    || !clientDocumentIsSafeFile(path, row.mime_type)
    || typeof row.client_title !== "string" || !row.client_title
    || row.client_title !== row.client_title.replace(/^ +| +$/gu, "")
    || Array.from(row.client_title).length > 150) throw new ClientDocumentLoadError();
  return { storage_path: path, mime_type: row.mime_type as string, client_title: row.client_title };
}
