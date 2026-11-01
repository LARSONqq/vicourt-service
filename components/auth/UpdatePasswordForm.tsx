"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { AuthRecoveryCard } from "@/components/auth/AuthRecoveryCard";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

export function UpdatePasswordForm({ invalidLink }: { invalidLink: boolean }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(!invalidLink);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (invalidLink) return;
    let active = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setHasValidSession(!error && Boolean(data.user));
      setIsCheckingSession(false);
    }).catch(() => {
      if (!active) return;
      setHasValidSession(false);
      setIsCheckingSession(false);
    });
    return () => { active = false; };
  }, [invalidLink]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !hasValidSession) return;

    if (!password || !confirmation) {
      setErrorMessage("Заповніть обидва поля пароля.");
      return;
    }
    if (password !== confirmation) {
      setErrorMessage("Паролі не збігаються.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setErrorMessage("Пароль має містити від 12 до 128 символів.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage("Не вдалося оновити пароль. Запросіть нове посилання та спробуйте ще раз.");
        return;
      }
      await supabase.auth.signOut();
      setPassword("");
      setConfirmation("");
      setIsComplete(true);
    } catch {
      setErrorMessage("Не вдалося оновити пароль. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (invalidLink || (!isCheckingSession && !hasValidSession)) {
    return <AuthRecoveryCard
      eyebrow="Відновлення доступу"
      title="Посилання недійсне"
      description="Посилання для відновлення пароля застаріло, вже використане або пошкоджене."
    >
      <Link href="/forgot-password" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Запросити нове посилання
      </Link>
    </AuthRecoveryCard>;
  }

  if (isCheckingSession) {
    return <AuthRecoveryCard eyebrow="Відновлення доступу" title="Перевіряємо посилання" description="Зачекайте, поки ми перевіримо захищену сесію відновлення.">
      <p role="status" className="rounded-lg border border-border bg-secondary px-4 py-4 text-sm text-muted-foreground">Перевірка…</p>
    </AuthRecoveryCard>;
  }

  if (isComplete) {
    return <AuthRecoveryCard eyebrow="Пароль оновлено" title="Доступ відновлено" description="Новий пароль збережено. Тепер увійдіть у ViCourt з новим паролем.">
      <Link href="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Увійти з новим паролем
      </Link>
    </AuthRecoveryCard>;
  }

  return <AuthRecoveryCard eyebrow="Відновлення доступу" title="Створіть новий пароль" description="Використайте новий пароль довжиною від 12 до 128 символів.">
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{errorMessage}</div>}
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-foreground">Новий пароль</label>
        <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} className="vc-field" required />
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-foreground">Підтвердьте пароль</label>
        <input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} className="vc-field" required />
      </div>
      <button type="submit" disabled={isSubmitting} className="min-h-11 w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Збереження…" : "Оновити пароль"}
      </button>
    </form>
  </AuthRecoveryCard>;
}
