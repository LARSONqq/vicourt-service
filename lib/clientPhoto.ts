import { ClientPortalInputError } from "@/lib/clientPortal";
import type { ClientObjectPhoto, ClientPhotoPublicationEditorState, ManagementClientPhotoPublication, SetClientPhotoPublicationInput } from "@/types/clientPhoto";

export const CLIENT_PHOTO_PAGE_SIZE = 12;
export const CLIENT_PHOTO_BATCH_LIMIT = 100;
export const CLIENT_PHOTO_CAPTION_LIMIT = 500;
const invalid = () => new ClientPortalInputError("Некоректні дані публікації фото.");
export const positivePhotoId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const order = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function caption(value: unknown, normalize = false): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw invalid();
  // Match PostgreSQL btrim and length (Unicode code points).
  const trimmed = value.replace(/^ +| +$/gu, "");
  if (Array.from(trimmed).length > CLIENT_PHOTO_CAPTION_LIMIT) throw invalid();
  if (!normalize && (!trimmed || trimmed !== value)) throw invalid();
  return trimmed || null;
}

export function clientObjectPhotoDto(value: unknown): ClientObjectPhoto {
  const row = record(value);
  if (!positivePhotoId(row.id) || !positivePhotoId(row.object_id) || !timestamp(row.published_at)) throw invalid();
  return { id: row.id, object_id: row.object_id, caption: caption(row.caption), published_at: row.published_at };
}

export function managementClientPhotoPublicationDto(value: unknown): ManagementClientPhotoPublication {
  const row = record(value);
  if (!positivePhotoId(row.photo_id) || !positivePhotoId(row.object_id) || typeof row.is_published !== "boolean" || !order(row.sort_order)
    || ![row.published_at, row.unpublished_at, row.updated_at].every((date) => date === null || timestamp(date))
    || (row.is_published && row.published_at === null)) throw invalid();
  return {
    photo_id: row.photo_id, object_id: row.object_id, is_published: row.is_published,
    client_caption: caption(row.client_caption), sort_order: row.sort_order,
    published_at: row.published_at as string | null, unpublished_at: row.unpublished_at as string | null,
    updated_at: row.updated_at as string | null,
  };
}

export function clientPhotoPublicationInput(value: unknown): SetClientPhotoPublicationInput {
  const row = record(value);
  if (!positivePhotoId(row.photo_id) || !positivePhotoId(row.object_id) || typeof row.is_published !== "boolean" || !order(row.sort_order)) throw invalid();
  return { object_id: row.object_id, photo_id: row.photo_id, is_published: row.is_published,
    client_caption: caption(row.client_caption, true), sort_order: row.sort_order };
}

export function clientPhotoPublicationEditorDto(value: ManagementClientPhotoPublication): ClientPhotoPublicationEditorState {
  return { photo_id: value.photo_id, is_published: value.is_published,
    client_caption: value.client_caption, sort_order: value.sort_order };
}
