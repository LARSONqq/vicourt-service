"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

export default function LoginPage() {
  const router =
    useRouter();

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
  ] = useState("");

  const [
    blockedMessage,
    setBlockedMessage,
  ] = useState("");

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("blocked") ===
      "1"
    ) {
      setBlockedMessage(
        "Ваш акаунт заблоковано. Зверніться до адміністратора ViCourt."
      );

      return;
    }

    if (
      params.get("error") ===
      "confirmation"
    ) {
      setErrorMessage(
        "Не вдалося підтвердити email. Посилання могло застаріти або вже бути використане."
      );
    }
  }, []);

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

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          is_active
        `)
        .eq(
          "id",
          data.user.id
        )
        .maybeSingle();

      if (
        profileError ||
        !profile
      ) {
        await supabase.auth.signOut();

        setErrorMessage(
          "Не вдалося перевірити акаунт. Зверніться до адміністратора."
        );

        return;
      }

      if (
        profile.is_active !== true
      ) {
        await supabase.auth.signOut();

        setBlockedMessage(
          "Ваш акаунт заблоковано. Зверніться до адміністратора ViCourt."
        );

        return;
      }

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
    <main className="flex min-h-dvh items-center justify-center bg-gray-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
        {/* HEADER */}
        <div className="mb-6 min-w-0 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700 sm:text-sm">
            ViCourt
          </p>

          <h1 className="mt-2 break-words text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
            Вхід у ViCourt Service
          </h1>

          <p className="mt-2 text-sm leading-5 text-gray-500">
            Увійди у свій робочий
            обліковий запис.
          </p>
        </div>

        {/* BLOCKED */}
        {blockedMessage && (
          <div className="mb-5 min-w-0 rounded-lg border border-orange-200 bg-orange-50 p-3 sm:p-4">
            <p className="font-semibold text-orange-800">
              Акаунт заблоковано
            </p>

            <p className="mt-1 break-words text-sm leading-5 text-orange-700">
              {blockedMessage}
            </p>
          </div>
        )}

        {/* ERROR */}
        {errorMessage && (
          <div className="mb-5 min-w-0 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700 sm:p-4">
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
              className="mb-2 block text-sm font-medium text-gray-700"
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
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Пароль
            </label>

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
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting
            }
            className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Вхід..."
              : "Увійти"}
          </button>
        </form>

        {/* REGISTER */}
        <div className="mt-6 border-t pt-6 text-center">
          <p className="text-sm text-gray-500">
            Ще немає облікового
            запису?
          </p>

          <Link
            href="/register"
            className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-green-700 transition hover:bg-green-50 hover:text-green-800"
          >
            Створити акаунт
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          ViCourt Service
        </p>
      </div>
    </main>
  );
}