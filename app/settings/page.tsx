import SettingsForm from "@/components/settings/SettingsForm";
import { getAppSettings } from "@/services/settingsService";
import { requireSectionAccess } from "@/lib/auth/requireAccess";

function formatUpdatedDate(date: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default async function SettingsPage() {
  await requireSectionAccess("settings");

  const settings = await getAppSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Налаштування
        </h1>

        <p className="mt-1 text-gray-500">
          Основна інформація про компанію та параметри
          системи
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <section className="rounded-xl border bg-white p-6">
          <h2 className="mb-6 text-xl font-semibold">
            Дані компанії
          </h2>

          <SettingsForm settings={settings} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Поточна назва
            </p>

            <p className="mt-2 text-xl font-semibold">
              {settings.company_name}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Основна валюта
            </p>

            <p className="mt-2 text-xl font-semibold">
              {settings.currency}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Останнє оновлення
            </p>

            <p className="mt-2 font-medium">
              {formatUpdatedDate(settings.updated_at)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}