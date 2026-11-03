"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { AuthRecoveryCard } from "@/components/auth/AuthRecoveryCard";
import { createClient } from "@/lib/supabase/client";

const SAFE_SUCCESS_MESSAGE = "Якщо обліковий запис із цією адресою існує, ми надіслали посилання для відновлення пароля.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Вкажіть email облікового запису.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();
      // Supabase intentionally receives the same response UX whether the account exists or not.
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=${encodeURIComponent("/update-password")}`,
      });
      if (error) {
        setErrorMessage("Не вдалося надіслати запит. Перевірте з’єднання та спробуйте ще раз.");
        return;
      }
      setSuccessMessage(SAFE_SUCCESS_MESSAGE);
    } catch {
      setErrorMessage("Не вдалося надіслати запит. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthRecoveryCard
    eyebrow="Відновлення доступу"
    title="Забули пароль?"
    description="Вкажіть email, пов’язаний із вашим обліковим записом."
  >
    {successMessage ? <div role="status" className="rounded-lg border border-border bg-secondary px-4 py-4 text-sm leading-6 text-foreground">
      {successMessage}
    </div> : <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
        {errorMessage}
      </div>}
      <div>
        <label htmlFor="recovery-email" className="mb-2 block text-sm font-medium text-foreground">Email</label>
        <input
          id="recovery-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          className="vc-field"
          placeholder="name@example.com"
          required
        />
      </div>
      <button type="submit" disabled={isSubmitting} className="min-h-11 w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Надсилання…" : "Надіслати посилання"}
      </button>
    </form>}

    <div className="mt-6 text-center">
      <Link href="/login" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Повернутися до входу
      </Link>
    </div>
  </AuthRecoveryCard>;
}
