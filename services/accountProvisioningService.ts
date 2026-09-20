import "server-only";
import { ClientPortalInputError } from "@/lib/clientPortal";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireClientAdministrator } from "@/services/clientAccessService";

export type ProvisionAccountInput = { displayName: string; email: string; password: string };

export async function provisionAccount(kind: "internal" | "client", input: ProvisionAccountInput) {
  await requireClientAdministrator();
  const sessionClient = await createClient();
  const contract = await sessionClient.rpc("get_client_portal_provisioning_state");
  if (contract.error || typeof contract.data !== "boolean" || (kind === "client" && !contract.data)) {
    throw new ClientPortalInputError("Створення акаунтів поки недоступне. Перевірте завершення розгортання.");
  }
  const displayName = String(input.displayName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (displayName.length < 2 || displayName.length > 120) throw new ClientPortalInputError("Вкажіть ім’я від 2 до 120 символів.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 254) throw new ClientPortalInputError("Перевірте адресу email.");
  if (password.length < 12 || password.length > 128) throw new ClientPortalInputError("Пароль має містити від 12 до 128 символів.");
  const admin = createServiceRoleClient();
  // Kind comes only from a guarded server action; never from user_metadata.
  // createUser does not reuse/link existing emails and does not send an invite.
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { account_type: kind },
    user_metadata: { full_name: displayName },
  });
  if (error || !data.user) throw new ClientPortalInputError("Не вдалося створити акаунт. Перевірте дані або зверніться до адміністратора.");
  // Never return the Auth object, credentials, metadata, or an Admin client.
  return { id: data.user.id };
}
