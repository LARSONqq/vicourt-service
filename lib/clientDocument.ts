import { ClientPortalInputError } from "@/lib/clientPortal";
import type { ClientObjectDocument, ManagementClientDocumentPublication, SetClientDocumentPublicationInput } from "@/types/clientDocument";

export const CLIENT_DOCUMENT_PAGE_SIZE = 20;
export const CLIENT_DOCUMENT_BATCH_LIMIT = 100;
export const CLIENT_DOCUMENT_MAX_SIZE = 26214400;
export const CLIENT_DOCUMENT_TITLE_LIMIT = 150;
export const CLIENT_DOCUMENT_DESCRIPTION_LIMIT = 1000;

// Exact metadata contract, not binary/content scanning. No MIME normalization
// that could make the app accept a pair rejected by the DB/Storage predicate.
const EXTENSION_MIMES: Readonly<Record<string, readonly string[]>> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
  txt: ["text/plain"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};
const mimes = new Set(Object.values(EXTENSION_MIMES).flat());
const invalid = () => new ClientPortalInputError("Некоректні дані публікації документа.");
export const positiveDocumentId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const order = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, nullable: boolean, normalize = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string") throw invalid();
  // PostgreSQL btrim/length: trim spaces and count Unicode code points.
  const trimmed = value.replace(/^ +| +$/gu, "");
  if (Array.from(trimmed).length > limit || (!trimmed && !nullable)
    || (!normalize && (!trimmed || trimmed !== value))) throw invalid();
  return trimmed || null;
}

export function clientDocumentIsSafeFile(path: unknown, mime: unknown): boolean {
  if (typeof path !== "string" || typeof mime !== "string") return false;
  const extension = path.toLowerCase().match(/\.([a-z]+)$/u)?.[1];
  return !!extension && Object.hasOwn(EXTENSION_MIMES, extension) && EXTENSION_MIMES[extension].includes(mime);
}

export function clientObjectDocumentDto(value: unknown): ClientObjectDocument {
  const row = record(value);
  if (!positiveDocumentId(row.id) || !positiveDocumentId(row.object_id) || !timestamp(row.published_at)
    || typeof row.mime_type !== "string" || !mimes.has(row.mime_type)
    || !positiveDocumentId(row.file_size) || row.file_size > CLIENT_DOCUMENT_MAX_SIZE) throw invalid();
  return {
    id: row.id, object_id: row.object_id,
    title: text(row.title, CLIENT_DOCUMENT_TITLE_LIMIT, false) as string,
    description: text(row.description, CLIENT_DOCUMENT_DESCRIPTION_LIMIT, true),
    mime_type: row.mime_type, file_size: row.file_size, published_at: row.published_at,
  };
}

export function managementClientDocumentPublicationDto(value: unknown): ManagementClientDocumentPublication {
  const row = record(value);
  if (!positiveDocumentId(row.document_id) || !positiveDocumentId(row.object_id)
    || typeof row.is_published !== "boolean" || !order(row.sort_order)
    || ![row.published_at, row.unpublished_at, row.updated_at].every((date) => date === null || timestamp(date))
    || (row.is_published && (row.published_at === null || row.client_title === null))
    || (row.updated_at !== null && row.client_title === null)) throw invalid();
  return {
    document_id: row.document_id, object_id: row.object_id, is_published: row.is_published,
    client_title: text(row.client_title, CLIENT_DOCUMENT_TITLE_LIMIT, true),
    client_description: text(row.client_description, CLIENT_DOCUMENT_DESCRIPTION_LIMIT, true), sort_order: row.sort_order,
    published_at: row.published_at as string | null, unpublished_at: row.unpublished_at as string | null,
    updated_at: row.updated_at as string | null,
  };
}

export function clientDocumentPublicationInput(value: unknown): SetClientDocumentPublicationInput {
  const row = record(value);
  if (!positiveDocumentId(row.document_id) || !positiveDocumentId(row.object_id)
    || typeof row.is_published !== "boolean" || !order(row.sort_order)) throw invalid();
  return {
    object_id: row.object_id, document_id: row.document_id, is_published: row.is_published,
    client_title: text(row.client_title, CLIENT_DOCUMENT_TITLE_LIMIT, false, true) as string,
    client_description: text(row.client_description, CLIENT_DOCUMENT_DESCRIPTION_LIMIT, true, true), sort_order: row.sort_order,
  };
}
