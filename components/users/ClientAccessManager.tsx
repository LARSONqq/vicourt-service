"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setClientActive, setClientGrant } from "@/app/actions/clientAccessActions";
import TaskTemplateLookup from "@/components/tasks/TaskTemplateLookup";
import type { ClientObjectGrant, ClientProfile } from "@/types/clientPortal";

export default function ClientAccessManager({ clients, grants, object }: {
  clients: ClientProfile[]; grants: ClientObjectGrant[];
  object?: { id: number; name: string };
}) {
  const [objectId, setObjectId] = useState(object ? String(object.id) : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const router = useRouter();
  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    if (locked.current) return;
    locked.current = true; setPending(true); setMessage("");
    try { const result = await action(); setMessage(result.message); if (result.ok) router.refresh(); }
    catch { setMessage("Не вдалося отримати відповідь. Оновіть сторінку та перевірте стан доступу."); }
    finally { locked.current = false; setPending(false); }
  }
  return <div className="min-w-0 space-y-5">
    {message && <p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
    {object && <section className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="break-words text-lg font-semibold">Доступ до «{object.name}»</h2>
      {grants.length === 0 ? <p className="text-sm text-gray-500">Активних дозволів немає.</p> : grants.map(grant => <div key={grant.client_user_id} className="flex flex-wrap items-center justify-between gap-3 border-t py-3">
        <p className="min-w-0 break-words">{grant.display_name}<span className="block text-xs text-gray-500">{grant.is_active ? "Акаунт активний" : "Акаунт вимкнений"}</span></p>
        <button disabled={pending} className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => { if (window.confirm("Відкликати доступ клієнта до цього об’єкта?")) void run(() => setClientGrant(grant.client_user_id, object.id, false)); }}>Відкликати доступ</button>
      </div>)}
    </section>}
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">Клієнтські акаунти</h2>
      {!object && <TaskTemplateLookup kind="object" label="Об’єкт для надання доступу" value={objectId} onChange={setObjectId} emptyLabel="Оберіть об’єкт" loadInitial />}
      {clients.length === 0 && <p className="text-sm text-gray-500">Клієнтів не знайдено.</p>}
      {clients.map(client => <div key={client.user_id} className="flex flex-wrap items-center justify-between gap-3 border-t py-3">
        <p className="min-w-0 break-words font-medium">{client.display_name}<span className="block text-xs font-normal text-gray-500">{client.is_active ? "Активний" : "Неактивний"}</span></p>
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" onClick={() => { if (!client.is_active || window.confirm("Вимкнути доступ клієнта до всіх об’єктів?")) void run(() => setClientActive(client.user_id, !client.is_active)); }}>{client.is_active ? "Вимкнути" : "Активувати"}</button>
          <button disabled={pending || !objectId} className="min-h-11 rounded-lg bg-green-700 px-3 text-sm text-white disabled:opacity-50" onClick={() => { if (window.confirm(`Надати клієнту «${client.display_name}» доступ до вибраного об’єкта?`)) void run(() => setClientGrant(client.user_id, Number(objectId), true)); }}>Надати доступ</button>
        </div>
      </div>)}
    </section>
  </div>;
}
