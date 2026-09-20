import "server-only";
import { ClientPortalInputError } from "@/lib/clientPortal";

import { canManageUsers } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";
import type { ClientObjectGrant, ClientProfile } from "@/types/clientPortal";

export async function requireClientAdministrator() {
  const profile = await getCurrentUserProfile();
  if (!profile || !canManageUsers(profile.role)) throw new ClientPortalInputError("Ця дія доступна лише активному адміністратору.");
  return profile;
}

export async function getAdminClients(query: string, page: number) {
  await requireClientAdministrator();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_client_profiles", { p_query: query.slice(0, 120), p_page: page });
  if (error) throw new ClientPortalInputError("Не вдалося завантажити клієнтів.");
  const rows = (data ?? []) as ClientProfile[];
  return { items: rows.slice(0, 20).map(({ user_id, display_name, is_active }) => ({ user_id, display_name, is_active })), hasMore: rows.length > 20 };
}

export async function getAdminObjectClients(objectId: number, page: number) {
  await requireClientAdministrator();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_object_clients", { p_object_id: objectId, p_page: page });
  if (error) throw new ClientPortalInputError("Не вдалося завантажити доступ до об’єкта.");
  const rows = (data ?? []) as ClientObjectGrant[];
  return { items: rows.slice(0, 20), hasMore: rows.length > 20 };
}

export async function changeClientGrant(clientId: string, objectId: number, granted: boolean) {
  await requireClientAdministrator();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_client_object_access", { p_client_user_id: clientId, p_object_id: objectId, p_granted: granted });
  if (error) throw new ClientPortalInputError(error.code === "P0002" ? "Клієнта або об’єкт більше не знайдено." : "Не вдалося змінити доступ до об’єкта.");
}

export async function changeClientActive(clientId: string, active: boolean) {
  await requireClientAdministrator();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_client_active", { p_client_user_id: clientId, p_active: active });
  if (error) throw new ClientPortalInputError(error.code === "55000" ? "Активація клієнтів поки недоступна. Зверніться до адміністратора розгортання." : "Не вдалося змінити стан клієнта.");
}
