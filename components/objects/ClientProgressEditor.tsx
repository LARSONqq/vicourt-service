"use client";

import { useRef, useState, type FormEvent } from "react";
import { publishClientProgress, reloadClientProgress } from "@/app/actions/clientProgressActions";
import {
  CLIENT_PROGRESS_MAX_STAGES, CLIENT_PROGRESS_SUMMARY_LIMIT, CLIENT_PROGRESS_TITLE_LIMIT,
  ClientPortalInputError, clientProgressSaveInput,
} from "@/lib/clientPortal";
import { formatKyivTimestamp } from "@/lib/kyivDate";
import type { ClientProgressStageStatus, ManagementClientObjectProgress } from "@/types/clientPortal";

type Props = {
  objectId: number;
  initialProgress: ManagementClientObjectProgress | null;
  loadFailed?: boolean;
};
type DraftStage = { key: string; id: number | null; title: string; status: ClientProgressStageStatus };
const stageStatuses: { value: ClientProgressStageStatus; label: string }[] = [
  { value: "planned", label: "Заплановано" },
  { value: "in_progress", label: "В роботі" },
  { value: "completed", label: "Завершено" },
];
const inputClass = "mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-gray-50";
const buttonClass = "min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

function draftFrom(progress: ManagementClientObjectProgress | null) {
  return {
    percent: String(progress?.overall_percent ?? 0),
    completed: progress?.completed_summary ?? "",
    next: progress?.next_summary ?? "",
    version: progress?.version ?? 0,
    updatedAt: progress?.updated_at ?? null,
    stages: (progress?.stages ?? []).map((stage): DraftStage => ({
      key: `saved-${stage.id}`, id: stage.id, title: stage.title, status: stage.status,
    })),
  };
}

export default function ClientProgressEditor({ objectId, initialProgress, loadFailed = false }: Props) {
  // This editing session owns its snapshot/version. Background RSC revalidation
  // must not silently rebase an unsaved draft onto another manager's version.
  const [draft, setDraft] = useState(() => draftFrom(initialProgress));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(loadFailed ? "Не вдалося завантажити прогрес об’єкта." : null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [unavailable, setUnavailable] = useState(loadFailed);
  const lock = useRef(false);
  const nextKey = useRef(0);

  function changeStage(index: number, changes: Partial<Pick<DraftStage, "title" | "status">>) {
    setSuccess(null);
    setDraft((current) => ({ ...current, stages: current.stages.map((stage, i) => i === index ? { ...stage, ...changes } : stage) }));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setSuccess(null);
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.stages.length) return current;
      const stages = [...current.stages];
      [stages[index], stages[target]] = [stages[target], stages[index]];
      return { ...current, stages };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || conflict || unavailable) return;
    lock.current = true;
    setPending(true); setError(null); setSuccess(null);
    try {
      if (!/^\d+$/u.test(draft.percent)) throw new ClientPortalInputError("Вкажіть цілий відсоток від 0 до 100.");
      const payload = clientProgressSaveInput({
        object_id: objectId, overall_percent: Number(draft.percent),
        completed_summary: draft.completed, next_summary: draft.next,
        expected_version: draft.version,
        stages: draft.stages.map((stage, sort_order) => ({
          id: stage.id, title: stage.title, status: stage.status, sort_order,
        })),
      });
      const result = await publishClientProgress(payload);
      if (!result.ok) {
        setError(result.message); setConflict(result.conflict);
        return;
      }
      setDraft(draftFrom(result.progress));
      setSuccess("Оновлення опубліковано.");
    } catch (error) {
      setError(error instanceof ClientPortalInputError ? error.message : "Не вдалося опублікувати оновлення. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      lock.current = false; setPending(false);
    }
  }

  async function reload() {
    if (lock.current) return;
    lock.current = true; setPending(true); setSuccess(null);
    try {
      const result = await reloadClientProgress(objectId);
      if (!result.ok) { setError(result.message); return; }
      setDraft(draftFrom(result.progress));
      setConflict(false); setUnavailable(false); setError(null);
      setSuccess("Завантажено актуальні дані.");
    } catch {
      setError("Не вдалося оновити дані. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      lock.current = false; setPending(false);
    }
  }

  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900">Прогрес для клієнта</h2>
      <p className="mt-1 text-sm font-medium text-green-800">Цю інформацію бачитиме клієнт.</p>
      {!unavailable && (
        <p className="mt-2 text-sm text-gray-500">
          {draft.updatedAt ? <>Останнє оновлення: <time dateTime={draft.updatedAt}>{formatKyivTimestamp(draft.updatedAt)}</time></> : "Прогрес ще не опубліковано. Заповніть поля та опублікуйте перше оновлення."}
        </p>
      )}
      {error && <div role="alert" className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p>{error}</p>
        {(conflict || unavailable) && <>
          {conflict && <p>Оновлення даних замінить незбережені зміни в цій формі.</p>}
          <button type="button" disabled={pending} onClick={reload} className={buttonClass}>Оновити дані</button>
        </>}
      </div>}
      {success && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p>}
      {!unavailable && <form onSubmit={handleSubmit} className="mt-5 min-w-0 space-y-5" aria-busy={pending}>
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          <div>
            <label htmlFor="client-progress-percent" className="text-sm font-medium text-gray-800">Загальний прогрес, %</label>
            <input id="client-progress-percent" type="number" min={0} max={100} step={1} required inputMode="numeric"
              value={draft.percent} onChange={(event) => { setDraft({ ...draft, percent: event.target.value }); setSuccess(null); }}
              className={`${inputClass} max-w-40`} />
            <p className="mt-1 text-xs text-gray-500">Вкажіть загальну оцінку вручну. Статуси етапів не змінюють відсоток автоматично.</p>
          </div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="min-w-0 text-sm font-medium text-gray-800">Що виконано
              <textarea rows={4} maxLength={CLIENT_PROGRESS_SUMMARY_LIMIT} value={draft.completed}
                onChange={(event) => { setDraft({ ...draft, completed: event.target.value }); setSuccess(null); }} className={inputClass} />
              <span className="mt-1 block text-xs font-normal text-gray-500">До 2000 символів</span>
            </label>
            <label className="min-w-0 text-sm font-medium text-gray-800">Що далі
              <textarea rows={4} maxLength={CLIENT_PROGRESS_SUMMARY_LIMIT} value={draft.next}
                onChange={(event) => { setDraft({ ...draft, next: event.target.value }); setSuccess(null); }} className={inputClass} />
              <span className="mt-1 block text-xs font-normal text-gray-500">До 2000 символів</span>
            </label>
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="font-medium text-gray-900">Публічні етапи <span className="text-sm font-normal text-gray-500">({draft.stages.length}/{CLIENT_PROGRESS_MAX_STAGES})</span></h3>
            {draft.stages.length === 0 && <p className="text-sm text-gray-500">Етапів ще немає. За потреби додайте їх до оновлення.</p>}
            {draft.stages.map((stage, index) => (
              <div key={stage.key} className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="min-w-0 text-sm font-medium text-gray-800">Етап {index + 1}
                    <input required maxLength={CLIENT_PROGRESS_TITLE_LIMIT} value={stage.title}
                      onChange={(event) => changeStage(index, { title: event.target.value })} className={inputClass} />
                  </label>
                  <label className="min-w-0 text-sm font-medium text-gray-800">Статус етапу {index + 1}
                    <select value={stage.status} onChange={(event) => changeStage(index, { status: event.target.value as ClientProgressStageStatus })} className={inputClass}>
                      {stageStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={index === 0} aria-label={`Перемістити етап ${index + 1} вгору`} onClick={() => moveStage(index, -1)} className={buttonClass}>↑ Вгору</button>
                  <button type="button" disabled={index === draft.stages.length - 1} aria-label={`Перемістити етап ${index + 1} вниз`} onClick={() => moveStage(index, 1)} className={buttonClass}>↓ Вниз</button>
                  <button type="button" aria-label={`Видалити етап ${index + 1}`} onClick={() => { setDraft((current) => ({ ...current, stages: current.stages.filter((item) => item.key !== stage.key) })); setSuccess(null); }} className={`${buttonClass} text-red-700`}>Видалити</button>
                </div>
              </div>
            ))}
            <button type="button" disabled={draft.stages.length >= CLIENT_PROGRESS_MAX_STAGES} onClick={() => {
              const key = `new-${nextKey.current++}`;
              setDraft((current) => current.stages.length >= CLIENT_PROGRESS_MAX_STAGES ? current : ({
                ...current, stages: [...current.stages, { key, id: null, title: "", status: "planned" }],
              }));
              setSuccess(null);
            }} className={buttonClass}>+ Додати етап</button>
          </div>
          <button type="submit" disabled={pending || conflict} className="min-h-11 w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {pending ? "Публікація…" : "Опублікувати оновлення"}
          </button>
        </fieldset>
      </form>}
    </section>
  );
}
