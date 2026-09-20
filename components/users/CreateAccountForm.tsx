"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientAccount, createInternalAccount } from "@/app/actions/clientAccessActions";

export default function CreateAccountForm({ kind }: { kind: "internal" | "client" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const locked = useRef(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setPending(true); setResult(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const input = { displayName: String(values.get("displayName") ?? ""), email: String(values.get("email") ?? ""), password: String(values.get("password") ?? "") };
      const response = await (kind === "client" ? createClientAccount(input) : createInternalAccount(input));
      setResult(response);
      if (response.ok) { form.reset(); setOpen(false); router.refresh(); }
    } catch { setResult({ ok: false, message: "Не вдалося отримати відповідь. Перед повтором перевірте, чи акаунт уже створено." }); }
    finally { locked.current = false; setPending(false); }
  }
  return <section className="min-w-0 space-y-3 rounded-xl border bg-white p-4">
    <button type="button" onClick={() => setOpen(!open)} disabled={pending} className="min-h-11 rounded-lg bg-green-700 px-4 py-2 font-medium text-white">{open ? "Закрити" : kind === "client" ? "Створити клієнтський акаунт" : "Створити внутрішній акаунт"}</button>
    {result && <p role="status" className={`text-sm ${result.ok ? "text-green-700" : "text-red-700"}`}>{result.message}</p>}
    {open && <form onSubmit={submit} className="grid min-w-0 gap-3 sm:max-w-lg">
      <label className="text-sm">Ім’я<input name="displayName" required minLength={2} maxLength={120} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
      <label className="text-sm">Email<input name="email" type="email" autoComplete="off" required maxLength={254} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
      <label className="text-sm">Пароль<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
      <p className="text-xs text-gray-500">Створюйте акаунт лише для перевіреного власника email. Передайте пароль безпечним каналом. Автоматичне запрошення не надсилається.{kind === "client" ? " Новий клієнт неактивний і не має доступу до об’єктів." : " Початкова роль — Працівник; запис працівника не створюється."}</p>
      <button disabled={pending} className="min-h-11 rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50">{pending ? "Створення…" : "Створити"}</button>
    </form>}
  </section>;
}
