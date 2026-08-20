import SettingsForm from "@/components/settings/SettingsForm";

import { requireSectionAccess } from "@/lib/auth/requireAccess";

import { getAppSettings } from "@/services/settingsService";

function formatUpdatedDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(date)
  );
}

export default async function SettingsPage() {
  await requireSectionAccess(
    "settings"
  );

  const settings =
    await getAppSettings();

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Налаштування
        </h1>

        <p className="mt-1 text-sm leading-5 text-gray-500 sm:text-base">
          Основна інформація про
          компанію та параметри
          системи
        </p>
      </div>

      {/* CONTENT */}
      <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* FORM */}
        <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Дані компанії
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Назва компанії та
              основні параметри
              ViCourt Service
            </p>
          </div>

          <div className="min-w-0">
            <SettingsForm
              settings={
                settings
              }
            />
          </div>
        </section>

        {/* INFO */}
        <aside className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-1">
          <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
            <p className="text-xs text-gray-500 sm:text-sm">
              Поточна назва
            </p>

            <p className="mt-2 break-words text-lg font-semibold text-gray-900 sm:text-xl">
              {
                settings.company_name
              }
            </p>
          </div>

          <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
            <p className="text-xs text-gray-500 sm:text-sm">
              Основна валюта
            </p>

            <p className="mt-2 text-lg font-semibold text-gray-900 sm:text-xl">
              {
                settings.currency
              }
            </p>
          </div>

          <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
            <p className="text-xs text-gray-500 sm:text-sm">
              Останнє оновлення
            </p>

            <p className="mt-2 break-words text-sm font-medium text-gray-800 sm:text-base">
              {formatUpdatedDate(
                settings.updated_at
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}