import type {
  ClientObjectSummary, ClientObjectProgress, ClientProgressStageStatus,
  ManagementClientObjectProgress, SaveClientObjectProgressInput,
} from "@/types/clientPortal";

export class ClientPortalInputError extends Error {}
export class ClientProgressConflictError extends ClientPortalInputError {}

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

export const CLIENT_PROGRESS_MAX_STAGES = 50;
export const CLIENT_PROGRESS_SUMMARY_LIMIT = 2000;
export const CLIENT_PROGRESS_TITLE_LIMIT = 120;
const progressStatuses = new Set<string>(["planned", "in_progress", "completed"]);
const invalidProgress = () => new ClientPortalInputError("Некоректні дані прогресу об’єкта.");
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const validOrder = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
const validPercent = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100;
// PostgreSQL length(text) counts Unicode characters, not UTF-16 code units.
const textLength = (value: string) => Array.from(value).length;
const trimSpaces = (value: string) => value.replace(/^ +| +$/gu, "");

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidProgress();
  return value as Record<string, unknown>;
}

function summary(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw invalidProgress();
  const text = trimSpaces(value);
  if (textLength(text) > CLIENT_PROGRESS_SUMMARY_LIMIT) throw new ClientPortalInputError("Публічний підсумок не може перевищувати 2000 символів.");
  return text || null;
}

function stageFields(value: unknown) {
  const row = record(value);
  if (typeof row.title !== "string" || !trimSpaces(row.title) || textLength(trimSpaces(row.title)) > CLIENT_PROGRESS_TITLE_LIMIT
    || typeof row.status !== "string" || !progressStatuses.has(row.status) || !validOrder(row.sort_order)) throw invalidProgress();
  return { title: trimSpaces(row.title), status: row.status as ClientProgressStageStatus, sort_order: row.sort_order };
}

export function clientObjectProgressDto(value: unknown): ClientObjectProgress {
  const row = record(value);
  if (!positiveId(row.object_id) || !validPercent(row.overall_percent)
    || typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))
    || !Array.isArray(row.stages) || row.stages.length > CLIENT_PROGRESS_MAX_STAGES) throw invalidProgress();
  const ids = new Set<number>();
  const orders = new Set<number>();
  const stages = row.stages.map((value: unknown) => {
    const stage = record(value);
    const fields = stageFields(stage);
    if (!positiveId(stage.id) || ids.has(stage.id) || orders.has(fields.sort_order)) throw invalidProgress();
    ids.add(stage.id); orders.add(fields.sort_order);
    return { id: stage.id, ...fields };
  }).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  return {
    object_id: row.object_id, overall_percent: row.overall_percent,
    completed_summary: summary(row.completed_summary), next_summary: summary(row.next_summary),
    updated_at: row.updated_at, stages,
  };
}

export function managementClientObjectProgressDto(value: unknown): ManagementClientObjectProgress {
  const row = record(value);
  if (!positiveId(row.version)) throw invalidProgress();
  return { ...clientObjectProgressDto(row), version: row.version };
}

export function clientProgressSaveInput(value: unknown): SaveClientObjectProgressInput {
  const row = record(value);
  if (!positiveId(row.object_id) || !validPercent(row.overall_percent)
    || !Number.isSafeInteger(row.expected_version) || Number(row.expected_version) < 0
    || !Array.isArray(row.stages) || row.stages.length > CLIENT_PROGRESS_MAX_STAGES) throw invalidProgress();
  const ids = new Set<number>();
  const orders = new Set<number>();
  const stages = row.stages.map((value: unknown) => {
    const stage = record(value);
    const fields = stageFields(stage);
    const id = stage.id ?? null;
    if (id !== null && (!positiveId(id) || ids.has(id))) throw invalidProgress();
    if (orders.has(fields.sort_order)) throw invalidProgress();
    if (id !== null) ids.add(id);
    orders.add(fields.sort_order);
    return { id, ...fields };
  });
  // Deliberately discard extra properties, including actor/timestamp/version fields.
  return {
    object_id: row.object_id, overall_percent: row.overall_percent,
    completed_summary: summary(row.completed_summary), next_summary: summary(row.next_summary),
    stages, expected_version: row.expected_version as number,
  };
}
