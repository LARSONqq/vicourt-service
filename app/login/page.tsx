"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        throw error;
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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
            ViCourt
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Вхід у ViCourt Service
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Увійди у свій робочий
            обліковий запис.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
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
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              autoComplete="email"
              placeholder="name@example.com"
              className="w-full rounded-lg border bg-white px-4 py-3 outline-none transition focus:border-green-600"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Пароль
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border bg-white px-4 py-3 outline-none transition focus:border-green-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Вхід..."
              : "Увійти"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          ViCourt Service
        </p>
      </div>
    </div>
  );
}