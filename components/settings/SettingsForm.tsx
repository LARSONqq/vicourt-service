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
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateAppSettings(formData);

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
    <form action={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Назва компанії
        </label>

        <input
          type="text"
          name="company_name"
          defaultValue={settings.company_name}
          placeholder="ViCourt Service"
          className="w-full rounded-lg border bg-white p-3"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Телефон
          </label>

          <input
            type="tel"
            name="phone"
            defaultValue={settings.phone || ""}
            placeholder="+380..."
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Email
          </label>

          <input
            type="email"
            name="email"
            defaultValue={settings.email || ""}
            placeholder="company@example.com"
            className="w-full rounded-lg border bg-white p-3"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Адреса
        </label>

        <input
          type="text"
          name="address"
          defaultValue={settings.address || ""}
          placeholder="Місто, вулиця, номер будинку"
          className="w-full rounded-lg border bg-white p-3"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Основна валюта
        </label>

        <select
          name="currency"
          defaultValue={settings.currency}
          className="w-full rounded-lg border bg-white p-3 md:max-w-md"
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

        <p className="mt-2 text-xs text-gray-500">
          Пізніше ця валюта використовуватиметься у
          звітах, на складі та в обслуговуванні техніки.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Збереження..."
          : "Зберегти налаштування"}
      </button>
    </form>
  );
}