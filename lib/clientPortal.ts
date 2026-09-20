import type { ClientObjectSummary } from "@/types/clientPortal";

export class ClientPortalInputError extends Error {}

const clientStatuses = new Set([
  "Новий", "В роботі", "На постійному обслуговуванні",
  "Під періодичним наглядом", "Призупинено", "Завершено",
]);

export function clientObjectDto(value: unknown): ClientObjectSummary {
  if (!value || typeof value !== "object") throw new Error("Некоректні дані об’єкта.");
  const row = value as Record<string, unknown>;
  if (!Number.isSafeInteger(row.id) || Number(row.id) <= 0 || typeof row.name !== "string") {
    throw new Error("Некоректні дані об’єкта.");
  }
  // Explicit mapping also protects the Flight payload if an RPC gains columns.
  return {
    id: row.id as number,
    name: row.name,
    address: typeof row.address === "string" ? row.address : null,
    status: typeof row.status === "string" && clientStatuses.has(row.status) ? row.status : "Об’єкт",
  };
}

export function clientPage(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value;
  const page = Number(text);
  return /^\d+$/u.test(text ?? "") && Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
}
