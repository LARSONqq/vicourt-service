"use client";
import { useEffect, useRef, useState } from "react";
import { searchTemplateOptions } from "@/app/actions/taskTemplateLookupActions";
import type { TemplateLookupKind, TemplateOption } from "@/types/taskTemplateWorkspace";

export default function TaskTemplateLookup({ kind, label, value, onChange, initial, required = false, emptyLabel = "Не призначено", loadInitial = false }: {
  kind: TemplateLookupKind; label: string; value: string; onChange: (value: string) => void;
  initial?: TemplateOption; required?: boolean; emptyLabel?: string; loadInitial?: boolean;
}) {
  const shouldLoadInitially = kind === "employee" || loadInitial;
  const [search, setSearch] = useState("");
  const [loadedSearch, setLoadedSearch] = useState("");
  const [options, setOptions] = useState<TemplateOption[]>([]);
  const [selected, setSelected] = useState(initial);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(shouldLoadInitially);
  const [error, setError] = useState("");
  const lock = useRef(shouldLoadInitially);
  const initialRequest = useRef<ReturnType<typeof searchTemplateOptions> | null>(null);

  useEffect(() => {
    if (!shouldLoadInitially) return;
    let mounted = true;
    // This picker mounts only when a management form opens. Fetch one page,
    // not the directory; retain the current assignee even if outside this page.
    // Reuse the promise when Strict Mode replays the effect.
    initialRequest.current ??= searchTemplateOptions(kind, "", 1);
    void initialRequest.current.then((result) => {
      if (!mounted) return;
      if (!result.ok) { setError(result.error); return; }
      setOptions(result.options);
      setHasMore(result.hasMore);
      setLoaded(true);
    }).catch(() => {
      if (mounted) setError("Не вдалося завантажити працівників. Спробуйте пошук ще раз.");
    }).finally(() => {
      if (mounted) { lock.current = false; setPending(false); }
    });
    return () => { mounted = false; };
  }, [kind, shouldLoadInitially]);

  async function load(query: string, nextPage: number) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError("");
    try {
      const result = await searchTemplateOptions(kind, query, nextPage);
      if (!result.ok) { setError(result.error); return; }
      setOptions(result.options); setPage(result.page); setHasMore(result.hasMore); setLoadedSearch(query); setLoaded(true);
    } catch { setError("Не вдалося виконати пошук. Спробуйте ще раз."); }
    finally { lock.current = false; setPending(false); }
  }
  const choices = selected ? [selected, ...options.filter((option) => option.id !== selected.id)] : options;
  return <div className="min-w-0 space-y-2">
    <label className="block text-sm font-medium">{label}
      <select required={required} value={value} onChange={(event) => { onChange(event.target.value); setSelected(choices.find((option) => String(option.id) === event.target.value)); }} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2">
        <option value="">{required ? "Оберіть після пошуку" : emptyLabel}</option>
        {choices.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
    <input aria-label={`Пошук: ${label}`} value={search} maxLength={100} disabled={pending} onChange={(event) => setSearch(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void load(search, 1); } }}
      placeholder="Назва або ім’я" className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
    <div className="flex flex-wrap gap-2 text-sm">
      <button type="button" disabled={pending} onClick={() => void load(search, 1)} className="min-h-10 rounded-lg border px-3 py-2">{pending ? "Пошук…" : "Знайти"}</button>
      {page > 1 && <button type="button" disabled={pending} onClick={() => void load(loadedSearch, page - 1)} className="min-h-10 rounded-lg border px-3">Назад</button>}
      {hasMore && <button type="button" disabled={pending} onClick={() => void load(loadedSearch, page + 1)} className="min-h-10 rounded-lg border px-3">Далі</button>}
    </div>
    <p role="status" className="text-xs text-gray-500">{pending ? "Завантаження варіантів…" : loaded && !options.length ? "Нічого не знайдено." : "До 20 результатів. Оберіть запис у списку або уточніть пошук."}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
