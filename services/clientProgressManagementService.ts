import "server-only";

import { canManageObjects } from "@/lib/auth/permissions";
import {
  ClientPortalInputError, ClientProgressConflictError, clientProgressSaveInput, managementClientObjectProgressDto,
} from "@/lib/clientPortal";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";
import type { ManagementClientObjectProgress, SaveClientObjectProgressInput } from "@/types/clientPortal";

async function requireProgressManagement() {
  const profile = await getCurrentUserProfile();
  if (!profile?.is_active || !canManageObjects(profile.role)) {
    throw new ClientPortalInputError("Публікація прогресу доступна лише активному адміністратору або керівнику об’єкта.");
  }
}

function progressError(code: string): Error {
  if (code === "40001") return new ClientProgressConflictError("Прогрес уже змінено. Оновіть дані перед публікацією.");
  if (code === "P0002") return new ClientPortalInputError("Об’єкт більше не знайдено.");
  if (code === "42501") return new ClientPortalInputError("Недостатньо прав для роботи з прогресом об’єкта.");
  if (code === "22023") return new ClientPortalInputError("Перевірте відсоток, публічні підсумки та етапи. Оновіть дані, якщо склад етапів змінився.");
  // Unexpected failures stay errors; never send raw Supabase messages/details.
  return new Error("Не вдалося виконати операцію з прогресом об’єкта. Спробуйте пізніше.");
}

export async function getManagementClientObjectProgress(objectId: number): Promise<ManagementClientObjectProgress | null> {
  await requireProgressManagement();
  if (!Number.isSafeInteger(objectId) || objectId <= 0) throw new ClientPortalInputError("Некоректний об’єкт.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_management_client_object_progress", { p_object_id: objectId });
  if (error) throw progressError(error.code);
  if (!Array.isArray(data) || data.length > 1) throw progressError("invalid_response");
  if (data.length === 0) return null;
  const progress = managementClientObjectProgressDto(data[0]);
  if (progress.object_id !== objectId) throw progressError("invalid_response");
  return progress;
}

export async function saveClientObjectProgress(input: SaveClientObjectProgressInput): Promise<ManagementClientObjectProgress> {
  await requireProgressManagement();
  const value = clientProgressSaveInput(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_client_object_progress", {
    p_object_id: value.object_id, p_overall_percent: value.overall_percent,
    p_completed_summary: value.completed_summary, p_next_summary: value.next_summary,
    p_stages: value.stages, p_expected_version: value.expected_version,
  });
  if (error) throw progressError(error.code);
  if (!Array.isArray(data) || data.length !== 1) throw progressError("invalid_response");
  const progress = managementClientObjectProgressDto(data[0]);
  if (progress.object_id !== value.object_id || progress.version !== value.expected_version + 1) throw progressError("invalid_response");
  return progress;
}
