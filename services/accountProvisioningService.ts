import "server-only";
import { ClientPortalInputError } from "@/lib/clientPortal";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireClientAdministrator } from "@/services/clientAccessService";

export type ProvisionAccountInput = { displayName: string; email: string; password: string };

// Never log Auth responses, credentials, emails, metadata, messages or stacks.
function reportFailure(kind: "internal" | "client", stage: string, error?: { code?: string; status?: number } | null) {
  const code = error?.code;
  const knownCodes = ["email_exists", "user_already_exists", "weak_password", "validation_failed", "email_address_invalid", "not_admin", "bad_jwt", "no_authorization", "unexpected_failure", "over_request_rate_limit", "request_timeout"];
  console.error("[account-provisioning]", {
    kind, stage,
    code: code && (knownCodes.includes(code) || /^(?:[0-9A-Z]{5}|PGRST\d{3})$/u.test(code)) ? code : "unknown",
    status: Number.isInteger(error?.status) ? error?.status : null,
  });
}

function authFailureMessage(error: { code?: string; status?: number }) {
  if (error.code === "email_exists" || error.code === "user_already_exists") {
    return "Акаунт із цим email уже існує. Якщо попередня спроба не додала клієнта до списку, потрібна перевірка Auth-акаунта; повторне створення не відновлює профіль.";
  }
  if (error.code === "weak_password") return "Пароль не відповідає політиці безпеки. Вкажіть складніший пароль.";
  if (error.code === "validation_failed" || error.code === "email_address_invalid") return "Перевірте email і пароль: сервіс авторизації відхилив ці дані.";
  if (error.status === 401 || error.status === 403) return "Сервер не має доступу до Supabase Admin API. Перевірте Production-конфігурацію SUPABASE_SERVICE_ROLE_KEY.";
  if (error.status === 429) return "Забагато запитів створення акаунтів. Спробуйте пізніше.";
  return "Supabase не підтвердив створення акаунта. Адміністратору розгортання слід перевірити Auth Logs і запис [account-provisioning] у Vercel. Перед повтором перевірте, чи акаунт уже існує.";
}

export async function provisionAccount(kind: "internal" | "client", input: ProvisionAccountInput) {
  await requireClientAdministrator();
  const sessionClient = await createClient();
  const contract = await sessionClient.rpc("get_client_portal_provisioning_state");
  if (contract.error || typeof contract.data !== "boolean" || (kind === "client" && !contract.data)) {
    reportFailure(kind, "deployment_contract", contract.error);
    throw new ClientPortalInputError("Створення акаунтів поки недоступне. Перевірте завершення розгортання.");
  }
  const displayName = String(input.displayName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (displayName.length < 2 || displayName.length > 120) throw new ClientPortalInputError("Вкажіть ім’я від 2 до 120 символів.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 254) throw new ClientPortalInputError("Перевірте адресу email.");
  if (password.length < 12 || password.length > 128) throw new ClientPortalInputError("Пароль має містити від 12 до 128 символів.");
  let admin: ReturnType<typeof createServiceRoleClient>;
  try { admin = createServiceRoleClient(); }
  catch {
    reportFailure(kind, "admin_client_configuration");
    throw new ClientPortalInputError("Створення акаунтів не налаштовано. Перевірте NEXT_PUBLIC_SUPABASE_URL і server-only SUPABASE_SERVICE_ROLE_KEY у Production Vercel.");
  }
  // Kind comes only from a guarded server action; never from user_metadata.
  // createUser does not reuse/link existing emails and does not send an invite.
  let response: Awaited<ReturnType<typeof admin.auth.admin.createUser>>;
  try {
    response = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { account_type: kind },
      user_metadata: { full_name: displayName },
    });
  } catch {
    reportFailure(kind, "auth_create_transport");
    throw new ClientPortalInputError("Не вдалося отримати відповідь Supabase. Перед повтором перевірте, чи акаунт уже створено; запит автоматично не повторюється.");
  }
  const { data, error } = response;
  if (error || !data.user) {
    reportFailure(kind, "auth_create", error);
    throw new ClientPortalInputError(authFailureMessage(error ?? {}));
  }

  // Auth may INSERT the user before UPDATE-ing trusted app_metadata. Auth success
  // alone therefore does not prove that our DB trigger created an identity.
  // Read back only the new ID, never insert/repair a profile in application code.
  const user = data.user;
  if (user.app_metadata?.account_type !== kind) {
    reportFailure(kind, "trusted_classification_missing");
    throw new ClientPortalInputError("Auth-акаунт створено, але його тип не підтверджено. Не повторюйте створення; зверніться до адміністратора розгортання.");
  }
  let profileConfirmed = false;
  try {
    const profile = await (kind === "client"
      ? admin.from("client_profiles").select("user_id").eq("user_id", user.id).maybeSingle()
      : admin.from("profiles").select("id").eq("id", user.id).maybeSingle());
    profileConfirmed = !profile.error && !!profile.data;
    if (!profileConfirmed) reportFailure(kind, profile.error ? "profile_read_failed" : "profile_missing", profile.error);
  } catch {
    reportFailure(kind, "profile_read_transport");
  }
  if (!profileConfirmed) {
    throw new ClientPortalInputError("Auth-акаунт створено, але профіль застосунку не підтверджено. Не створюйте його повторно. Перевірте виправлення signup trigger і серверні журнали [account-provisioning].");
  }
  // Never return the Auth object, credentials, metadata, or an Admin client.
  return { id: data.user.id };
}
