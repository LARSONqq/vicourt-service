"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateAppSettings } from "@/app/actions/settingsActions";

import type { AppSettings } from "@/types/appSettings";

type Props = {
  settings: AppSettings;
};

export default function SettingsForm({
  settings,
}: Props) {
  const router =
    useRouter();

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
    formData: FormData
  ) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateAppSettings(
        formData
      );

      setSuccessMessage(
        "Налаштування успішно збережено."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося зберегти налаштування."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="min-w-0 space-y-5 sm:space-y-6"
    >
      {/* ERROR */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700 sm:p-4">
          {errorMessage}
        </div>
      )}

      {/* SUCCESS */}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm leading-5 text-green-700 sm:p-4">
          {successMessage}
        </div>
      )}

      {/* COMPANY NAME */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Назва компанії
        </label>

        <input
          type="text"
          name="company_name"
          defaultValue={
            settings.company_name
          }
          placeholder="ViCourt Service"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          required
        />
      </div>

      {/* CONTACTS */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Телефон
          </label>

          <input
            type="tel"
            name="phone"
            inputMode="tel"
            defaultValue={
              settings.phone ||
              ""
            }
            placeholder="+380..."
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Email
          </label>

          <input
            type="email"
            name="email"
            inputMode="email"
            defaultValue={
              settings.email ||
              ""
            }
            placeholder="company@example.com"
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
          />
        </div>
      </div>

      {/* ADDRESS */}
      <div className="min-w-0">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Адреса
        </label>

        <input
          type="text"
          name="address"
          defaultValue={
            settings.address ||
            ""
          }
          placeholder="Місто, вулиця, номер будинку"
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition placeholder:text-gray-400 focus:border-green-600"
        />
      </div>

      {/* CURRENCY */}
      <div className="min-w-0 sm:max-w-md">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Основна валюта
        </label>

        <select
          name="currency"
          defaultValue={
            settings.currency
          }
          className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-3 outline-none transition focus:border-green-600"
          required
        >
          <option value="UAH">
            UAH — українська гривня
          </option>

          <option value="USD">
            USD — долар США
          </option>

          <option value="EUR">
            EUR — євро
          </option>
        </select>

        <p className="mt-2 text-xs leading-5 text-gray-500">
          Ця валюта
          використовується у
          звітах, на складі та в
          обслуговуванні техніки.
        </p>
      </div>

      {/* SAVE */}
      <div className="border-t pt-4">
        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="min-h-11 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting
            ? "Збереження..."
            : "Зберегти налаштування"}
        </button>
      </div>
    </form>
  );
}