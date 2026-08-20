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

    if (isSubmitting) {
      return;
    }

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
    <main className="flex min-h-dvh items-center justify-center bg-gray-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
        {/* HEADER */}
        <div className="mb-6 min-w-0 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700 sm:text-sm">
            ViCourt
          </p>

          <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Реєстрація
          </h1>

          <p className="mt-2 text-sm leading-5 text-gray-500">
            Створи робочий
            обліковий запис
            ViCourt Service.
          </p>
        </div>

        {/* ERROR */}
        {errorMessage && (
          <div className="mb-5 min-w-0 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700 sm:p-4">
            {errorMessage}
          </div>
        )}

        {/* SUCCESS */}
        {successMessage && (
          <div className="mb-5 min-w-0 rounded-lg border border-green-200 bg-green-50 p-3 sm:p-4">
            <p className="break-words text-sm leading-5 text-green-700">
              {successMessage}
            </p>

            <div className="mt-3">
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-green-700 transition hover:bg-green-100"
              >
                Перейти до входу →
              </Link>
            </div>
          </div>
        )}

        {/* FORM */}
        <form
          onSubmit={
            handleSubmit
          }
          className="min-w-0 space-y-5"
        >
          {/* NAME */}
          <div className="min-w-0">
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Ім’я та прізвище
            </label>

            <input
              id="fullName"
              type="text"
              value={
                fullName
              }
              onChange={(
                event
              ) =>
                setFullName(
                  event.target.value
                )
              }
              autoComplete="name"
              placeholder="Іван Петренко"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />
          </div>

          {/* EMAIL */}
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

          {/* PASSWORD */}
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
              autoComplete="new-password"
              placeholder="Мінімум 8 символів"
              minLength={8}
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="min-w-0">
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Повтори пароль
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={
                confirmPassword
              }
              onChange={(
                event
              ) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              autoComplete="new-password"
              placeholder="Повтори пароль"
              minLength={8}
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />
          </div>

          {/* COMPANY CODE */}
          <div className="min-w-0">
            <label
              htmlFor="companyCode"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Код компанії
            </label>

            <input
              id="companyCode"
              type="password"
              value={
                companyCode
              }
              onChange={(
                event
              ) =>
                setCompanyCode(
                  event.target.value
                )
              }
              autoComplete="off"
              placeholder="Код доступу ViCourt"
              className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-4 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
              required
            />

            <p className="mt-2 text-xs leading-4 text-gray-400">
              Код доступу надає
              адміністратор ViCourt.
            </p>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={
              isSubmitting
            }
            className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Створення..."
              : "Створити акаунт"}
          </button>
        </form>

        {/* LOGIN */}
        <div className="mt-6 border-t pt-6 text-center">
          <p className="text-sm text-gray-500">
            Вже маєш акаунт?
          </p>

          <Link
            href="/login"
            className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-green-700 transition hover:bg-green-50 hover:text-green-800"
          >
            Увійти
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          ViCourt Service
        </p>
      </div>
    </main>
  );
}