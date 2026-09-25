import "server-only";

import { canManageObjects } from "@/lib/auth/permissions";
import { ClientPortalInputError } from "@/lib/clientPortal";
import { CLIENT_DOCUMENT_BATCH_LIMIT, clientDocumentPublicationInput, managementClientDocumentPublicationDto, positiveDocumentId } from "@/lib/clientDocument";
import { createClient } from "@/lib/supabase/server";
import { getAccountIdentity } from "@/services/accountIdentityService";
import { getCurrentUserProfile } from "@/services/profileService";
import type { ManagementClientDocumentPublication } from "@/types/clientDocument";

async function requireDocumentPublicationManagement() {
  if (await getAccountIdentity() !== "internal") throw failure("42501");
  const profile = await getCurrentUserProfile();
  if (!profile?.is_active || !canManageObjects(profile.role)) throw failure("42501");
}

function failure(code?: string): Error {
  if (code === "42501") return new ClientPortalInputError("Недостатньо прав для публікації документів.");
  if (code === "P0002") return new ClientPortalInputError("Документ більше не знайдено на цьому об’єкті.");
  if (code === "22023") return new ClientPortalInputError("Перевірте назву для клієнта, опис, порядок і готовність файла. Формат документа має бути дозволеним.");
  return new Error("Не вдалося виконати операцію з публікацією документа. Спробуйте пізніше.");
}

async function managementRpc(name: "get_management_client_document_publications" | "set_client_object_document_publication", args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await Promise.resolve(supabase.rpc(name, args)).catch(() => { throw failure(); });
  if (error) throw failure(error.code);
  if (!Array.isArray(data)) throw failure();
  return data as unknown[];
}

export async function getManagementClientDocumentPublications(objectId: number, documentIds: number[]): Promise<ManagementClientDocumentPublication[]> {
  await requireDocumentPublicationManagement();
  if (!positiveDocumentId(objectId) || !Array.isArray(documentIds) || documentIds.length > CLIENT_DOCUMENT_BATCH_LIMIT
    || !documentIds.every(positiveDocumentId)) throw new ClientPortalInputError("Некоректний перелік документів.");
  if (!documentIds.length) return [];
  const ids = [...new Set(documentIds)];
  const data = await managementRpc("get_management_client_document_publications", { p_object_id: objectId, p_document_ids: ids });
  if (data.length > ids.length) throw failure();
  let publications;
  try { publications = data.map(managementClientDocumentPublicationDto); } catch { throw failure(); }
  if (publications.some((item) => item.object_id !== objectId || !ids.includes(item.document_id))
    || new Set(publications.map((item) => item.document_id)).size !== publications.length) throw failure();
  return publications;
}

export async function setClientObjectDocumentPublication(input: unknown): Promise<ManagementClientDocumentPublication> {
  await requireDocumentPublicationManagement();
  const value = clientDocumentPublicationInput(input);
  const data = await managementRpc("set_client_object_document_publication", {
    p_object_id: value.object_id, p_document_id: value.document_id, p_is_published: value.is_published,
    p_client_title: value.client_title, p_client_description: value.client_description, p_sort_order: value.sort_order,
  });
  if (data.length !== 1) throw failure();
  let result;
  try { result = managementClientDocumentPublicationDto(data[0]); } catch { throw failure(); }
  if (result.object_id !== value.object_id || result.document_id !== value.document_id
    || result.is_published !== value.is_published || result.client_title !== value.client_title
    || result.client_description !== value.client_description || result.sort_order !== value.sort_order) throw failure();
  return result;
}
