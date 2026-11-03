"use client";

import Link from "next/link";

import {
  FormEvent,
  use,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";
import { AuthRecoveryCard } from "@/components/auth/AuthRecoveryCard";

type SearchParams = {
  blocked?: string | string[];
  error?: string | string[];
};

type Props = {
  searchParams: Promise<SearchParams>;
};

function getFirstParam(
  value:
    | string
    | string[]
    | undefined
) {
  return Array.isArray(value)
    ? value[0] || ""
    : value || "";
}

export default function LoginPage({
  searchParams,
}: Props) {
  const router =
    useRouter();

  const params =
    use(searchParams);

  const supabase =
    createClient();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState(() =>
    getFirstParam(
      params.error
    ) === "confirmation"
      ? "Не вдалося підтвердити email. Посилання могло застаріти або вже бути використане."
      : ""
  );

  const [
    blockedMessage,
    setBlockedMessage,
  ] = useState(() =>
    getFirstParam(
      params.blocked
    ) === "1"
      ? "Ваш акаунт заблоковано. Зверніться до адміністратора ViCourt."
      : ""
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setBlockedMessage("");

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword({
          email:
            email.trim(),

          password,
        });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          "Користувача не знайдено."
        );
      }

      // Proxy resolves the current DB identity; no client-side role fallback.
      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage(
        "Неправильний email або пароль."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthRecoveryCard
      eyebrow="ViCourt"
      title="Вхід у ViCourt Service"
      description="Увійди у свій робочий обліковий запис."
    >

        {/* BLOCKED */}
        {blockedMessage && (
          <div role="alert" aria-live="assertive" className="vc-panel-warning mb-5 min-w-0 rounded-lg border border-border p-3 sm:p-4">
            <p className="font-semibold">
              Акаунт заблоковано
            </p>

            <p className="mt-1 break-words text-sm leading-5">
              {blockedMessage}
            </p>
          </div>
        )}

        {/* ERROR */}
        {errorMessage && (
          <div role="alert" aria-live="assertive" className="vc-panel-danger mb-5 min-w-0 rounded-lg border border-border p-3 text-sm leading-5 sm:p-4">
            {errorMessage}
          </div>
        )}

        {/* FORM */}
        <form
          onSubmit={
            handleSubmit
          }
          className="min-w-0 space-y-5"
        >
          <div className="min-w-0">
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(
                event
              ) =>
                setEmail(
                  event.target.value
                )
              }
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@example.com"
              className="vc-field min-h-11"
              required
            />
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Пароль
              </label>

              <Link
                href="/forgot-password"
                className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Забули пароль?
              </Link>
            </div>

            <input
              id="password"
              type="password"
              value={
                password
              }
              onChange={(
                event
              ) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              placeholder="••••••••"
              className="vc-field min-h-11"
              required
            />
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting
            }
            className="min-h-11 w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Вхід..."
              : "Увійти"}
          </button>
        </form>

        {/* REGISTER */}
        <div className="mt-6 border-t pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ще немає облікового
            запису?
          </p>

          <Link
            href="/register"
            className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-primary transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Як отримати доступ
          </Link>
        </div>
    </AuthRecoveryCard>
  );
}
