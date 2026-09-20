"use server";

import { revalidatePath } from "next/cache";
import { ClientPortalInputError } from "@/lib/clientPortal";
import { changeClientActive, changeClientGrant } from "@/services/clientAccessService";
import { provisionAccount, type ProvisionAccountInput } from "@/services/accountProvisioningService";

function validClientId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)) throw new ClientPortalInputError("Некоректний клієнт.");
}

export async function createClientAccount(input: ProvisionAccountInput) {
  try {
    await provisionAccount("client", input);
    revalidatePath("/users/clients");
    return { ok: true as const, message: "Акаунт створено без доступу. Активуйте клієнта та окремо надайте доступ до об’єкта." };
  } catch (error) { return { ok: false as const, message: error instanceof ClientPortalInputError ? error.message : "Не вдалося створити акаунт." }; }
}

export async function createInternalAccount(input: ProvisionAccountInput) {
  try {
    await provisionAccount("internal", input);
    revalidatePath("/users");
    return { ok: true as const, message: "Акаунт працівника створено. Роль і зв’язок із працівником можна змінити у списку користувачів." };
  } catch (error) { return { ok: false as const, message: error instanceof ClientPortalInputError ? error.message : "Не вдалося створити акаунт." }; }
}

export async function setClientGrant(clientId: string, objectId: number, granted: boolean) {
  try {
    validClientId(clientId);
    if (!Number.isSafeInteger(objectId) || objectId <= 0 || typeof granted !== "boolean") throw new ClientPortalInputError("Перевірте об’єкт і дію.");
    await changeClientGrant(clientId, objectId, granted);
    revalidatePath("/users/clients");
    revalidatePath("/client", "layout");
    return { ok: true as const, message: granted ? "Доступ надано." : "Доступ відкликано." };
  } catch (error) { return { ok: false as const, message: error instanceof ClientPortalInputError ? error.message : "Не вдалося змінити доступ." }; }
}

export async function setClientActive(clientId: string, active: boolean) {
  try {
    validClientId(clientId);
    if (typeof active !== "boolean") throw new ClientPortalInputError("Некоректний стан клієнта.");
    await changeClientActive(clientId, active);
    revalidatePath("/users/clients");
    revalidatePath("/client", "layout");
    return { ok: true as const, message: active ? "Клієнта активовано." : "Доступ клієнта вимкнено. Записи доступу збережено." };
  } catch (error) { return { ok: false as const, message: error instanceof ClientPortalInputError ? error.message : "Не вдалося змінити стан." }; }
}
