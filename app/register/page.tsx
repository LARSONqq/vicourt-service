"use client";

import Link from "next/link";

import {
  FormEvent,
  useState,
} from "react";

import {
  registerUser,
} from "@/app/actions/registerActions";

export default function RegisterPage() {
  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    companyCode,
    setCompanyCode,
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
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "Паролі не співпадають."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await registerUser({
          fullName,
          email,
          password,
          companyCode,
        });

      if (!result.success) {
        setErrorMessage(
          result.message
        );

        return;
      }

      setSuccessMessage(
        result.message
      );

      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setCompanyCode("");
    } catch {
      setErrorMessage(
        "Сталася помилка під час реєстрації."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
            ViCourt
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Реєстрація
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Створи робочий обліковий
            запис ViCourt Service.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}

            <div className="mt-3">
              <Link
                href="/login"
                className="font-semibold underline"
              >
                Перейти до входу
              </Link>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Ім’я та прізвище
            </label>

            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(
                  event.target.value
                )
              }
              autoComplete="name"
              placeholder="Іван Петренко"
              className="w-full rounded-lg border bg-white px-4 py-3 outline-none transition focus:border-green-600"
              required
            />
          </div>

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
              autoComplete="new-password"
              placeholder="Мінімум 8 символів"
              minLength={8}
              className="w-full rounded-lg border bg-white px-4 py-3 outline-none transition focus:border-green-600"
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Повтори пароль
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              autoComplete="new-password"
              placeholder="Повтори пароль"
              minLength={8}
              className="w-full rounded-lg border bg-white px-4 py-3 outline-none transition focus:border-green-600"
              required
            />
          </div>

          <div>
            <label
              htmlFor="companyCode"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Код компанії
            </label>

            <input
              id="companyCode"
              type="password"
              value={companyCode}
              onChange={(event) =>
                setCompanyCode(
                  event.target.value
                )
              }
              autoComplete="off"
              placeholder="Код доступу ViCourt"
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
              ? "Створення..."
              : "Створити акаунт"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Вже маєш акаунт?
          </p>

          <Link
            href="/login"
            className="mt-1 inline-block text-sm font-semibold text-green-700 hover:text-green-800"
          >
            Увійти
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          ViCourt Service
        </p>
      </div>
    </div>
  );
}