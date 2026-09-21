import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountIdentity } from "@/services/accountIdentityService";
import { accountHome } from "@/lib/auth/accountRouting";
import { clientObjectDto, clientObjectProgressDto } from "@/lib/clientPortal";
import type { ClientObjectProfile, ClientObjectProgress } from "@/types/clientPortal";

export async function requireClientAccess() {
  const identity = await getAccountIdentity();
  if (identity !== "client") redirect(accountHome(identity));
}

export async function getClientObjectsPage(page: number) {
  await requireClientAccess();
  const safePage = Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
  const supabase = await createClient();
  // The RPC scopes by auth.uid() and the current active grant, not a caller UUID.
  const { data, error } = await supabase.rpc("get_client_objects", { p_page: safePage });
  if (error) throw new Error("Не вдалося завантажити ваші об’єкти. Спробуйте пізніше.");
  const rows: unknown[] = Array.isArray(data) ? data : [];
  return { items: rows.slice(0, 20).map(clientObjectDto), page: safePage, hasMore: rows.length > 20 };
}

export async function getClientObject(id: number): Promise<ClientObjectProfile> {
  await requireClientAccess();
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_client_object", { p_object_id: id });
  if (error) throw new Error("Не вдалося завантажити об’єкт. Спробуйте пізніше.");
  if (!Array.isArray(data) || data.length !== 1) notFound();
  const object = clientObjectDto(data[0]);
  if (object.id !== id) notFound();
  return object;
}

export async function getClientObjectProgress(id: number): Promise<ClientObjectProgress | null> {
  await requireClientAccess();
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_client_object_progress", { p_object_id: id });
  // The DB uses the same denial for missing, revoked and unassigned objects.
  if (error?.code === "42501") notFound();
  if (error || !Array.isArray(data) || data.length > 1) throw new Error("Не вдалося завантажити прогрес об’єкта. Спробуйте пізніше.");
  if (data.length === 0) return null; // Authorized, but not yet published.
  const progress = clientObjectProgressDto(data[0]);
  if (progress.object_id !== id) notFound();
  return progress;
}
