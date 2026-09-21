"use server";

import { revalidatePath } from "next/cache";
import {
  ClientPortalInputError, ClientProgressConflictError, clientProgressSaveInput,
  managementClientObjectProgressDto,
} from "@/lib/clientPortal";
import { getAccountIdentity } from "@/services/accountIdentityService";
import {
  getManagementClientObjectProgress, saveClientObjectProgress,
} from "@/services/clientProgressManagementService";

async function requireInternalIdentity() {
  if (await getAccountIdentity() !== "internal") {
    throw new ClientPortalInputError("Недостатньо прав для роботи з прогресом об’єкта.");
  }
  // Management services additionally require an active admin/object_manager
  // profile before any progress RPC; SQL independently enforces the same guard.
}

function failure(error: unknown) {
  if (error instanceof ClientProgressConflictError) {
    return { ok: false as const, conflict: true, message: "Прогрес уже було змінено іншим користувачем. Оновіть дані перед повторним збереженням." };
  }
  return {
    ok: false as const, conflict: false,
    message: error instanceof ClientPortalInputError ? error.message : "Не вдалося виконати операцію з прогресом. Спробуйте ще раз.",
  };
}

export async function publishClientProgress(input: unknown) {
  try {
    await requireInternalIdentity();
    const value = clientProgressSaveInput(input);
    const progress = managementClientObjectProgressDto(await saveClientObjectProgress(value));
    revalidatePath(`/objects/${value.object_id}`);
    revalidatePath(`/client/objects/${value.object_id}`);
    return { ok: true as const, progress };
  } catch (error) {
    return failure(error);
  }
}

// Explicit reload after conflict, never an automatic retry with a newer version.
export async function reloadClientProgress(objectId: number) {
  try {
    await requireInternalIdentity();
    if (!Number.isSafeInteger(objectId) || objectId <= 0) throw new ClientPortalInputError("Некоректний об’єкт.");
    const progress = await getManagementClientObjectProgress(objectId);
    return { ok: true as const, progress: progress ? managementClientObjectProgressDto(progress) : null };
  } catch (error) {
    return failure(error);
  }
}
