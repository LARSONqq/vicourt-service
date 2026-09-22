import "server-only";

import { canManageObjects } from "@/lib/auth/permissions";
import { ClientPortalInputError } from "@/lib/clientPortal";
import { CLIENT_PHOTO_BATCH_LIMIT, clientPhotoPublicationInput, managementClientPhotoPublicationDto, positivePhotoId } from "@/lib/clientPhoto";
import { createClient } from "@/lib/supabase/server";
import { getAccountIdentity } from "@/services/accountIdentityService";
import { getCurrentUserProfile } from "@/services/profileService";
import type { ManagementClientPhotoPublication } from "@/types/clientPhoto";

async function requirePhotoPublicationManagement() {
  if (await getAccountIdentity() !== "internal") throw new ClientPortalInputError("Недостатньо прав для публікації фото.");
  const profile = await getCurrentUserProfile();
  if (!profile?.is_active || !canManageObjects(profile.role)) throw new ClientPortalInputError("Публікувати фото можуть лише активний адміністратор або керівник об’єкта.");
}

function failure(code?: string): Error {
  if (code === "42501") return new ClientPortalInputError("Недостатньо прав для публікації фото.");
  if (code === "P0002") return new ClientPortalInputError("Фото більше не знайдено на цьому об’єкті.");
  if (code === "22023") return new ClientPortalInputError("Перевірте підпис, порядок і формат фото. Для публікації доступні лише JPEG, PNG, WebP, GIF або AVIF з відповідним розширенням.");
  return new Error("Не вдалося виконати операцію з публікацією фото. Спробуйте пізніше.");
}

export async function getManagementClientPhotoPublications(objectId: number, photoIds: number[]): Promise<ManagementClientPhotoPublication[]> {
  await requirePhotoPublicationManagement();
  if (!positivePhotoId(objectId) || !Array.isArray(photoIds) || photoIds.length > CLIENT_PHOTO_BATCH_LIMIT || !photoIds.every(positivePhotoId)) throw new ClientPortalInputError("Некоректний перелік фото.");
  if (!photoIds.length) return [];
  const ids = [...new Set(photoIds)];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_management_client_photo_publications", { p_object_id: objectId, p_photo_ids: ids });
  if (error) throw failure(error.code);
  if (!Array.isArray(data) || data.length > ids.length) throw failure();
  let publications;
  try { publications = data.map(managementClientPhotoPublicationDto); } catch { throw failure(); }
  if (publications.some((item) => item.object_id !== objectId || !ids.includes(item.photo_id))
    || new Set(publications.map((item) => item.photo_id)).size !== publications.length) throw failure();
  return publications;
}

export async function setClientObjectPhotoPublication(input: unknown): Promise<ManagementClientPhotoPublication> {
  await requirePhotoPublicationManagement();
  const value = clientPhotoPublicationInput(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_client_object_photo_publication", {
    p_object_id: value.object_id, p_photo_id: value.photo_id, p_is_published: value.is_published,
    p_client_caption: value.client_caption, p_sort_order: value.sort_order,
  });
  if (error) throw failure(error.code);
  if (!Array.isArray(data) || data.length !== 1) throw failure();
  let result;
  try { result = managementClientPhotoPublicationDto(data[0]); } catch { throw failure(); }
  if (result.object_id !== value.object_id || result.photo_id !== value.photo_id || result.is_published !== value.is_published
    || result.client_caption !== value.client_caption || result.sort_order !== value.sort_order) throw failure();
  return result;
}
