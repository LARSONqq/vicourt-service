import { getAppSettings } from "@/services/settingsService";
import { getCurrentUserProfile } from "@/services/profileService";

import {
  canAccessSection,
  type AppSection,
} from "@/lib/auth/permissions";

import {
  getUserRoleLabel,
} from "@/types/userProfile";

type MenuItem = {
  name: string;
  href: string;
  section: AppSection;
};

const menuItems: MenuItem[] = [
  {
    name: "Головна",
    href: "/",
    section: "home",
  },
  {
    name: "Об'єкти",
    href: "/objects",
    section: "objects",
  },
  {
    name: "Завдання",
    href: "/task",
    section: "tasks",
  },
  {
    name: "Календар",
    href: "/calendar",
    section: "calendar",
  },
  {
    name: "Склад",
    href: "/warehouse",
    section: "warehouse",
  },
  {
    name: "Закупівлі",
    href: "/purchases",
    section: "purchases",
  },
  {
    name: "Техніка",
    href: "/equipment",
    section: "equipment",
  },
  {
    name: "Працівники",
    href: "/employees",
    section: "employees",
  },
  {
    name: "Звіти",
    href: "/reports",
    section: "reports",
  },
  {
    name: "Журнал дій",
    href: "/activity",
    section: "activity",
  },
  {
    name: "Налаштування",
    href: "/settings",
    section: "settings",
  },
  {
    name: "Користувачі",
    href: "/users",
    section: "users",
  },
];

export async function Sidebar() {
  const [
    settings,
    currentProfile,
  ] = await Promise.all([
    getAppSettings(),
    getCurrentUserProfile(),
  ]);

  const visibleMenuItems =
    currentProfile
      ? menuItems.filter(
          (item) =>
            canAccessSection(
              currentProfile.role,
              item.section
            )
        )
      : [];

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r bg-white p-5">
      <div className="mb-8">
        <h2 className="break-words text-2xl font-bold text-green-800">
          {settings.company_name}
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Управління роботою компанії
        </p>
      </div>

      <nav className="space-y-2">
        {visibleMenuItems.map(
          (item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-lg px-4 py-3 font-medium text-gray-700 transition hover:bg-green-50 hover:text-green-700"
            >
              {item.name}
            </a>
          )
        )}
      </nav>

      <div className="mt-auto border-t pt-5">
        {currentProfile && (
          <div className="mb-4">
            <p className="text-xs text-gray-400">
              Ви увійшли як
            </p>

            <p className="mt-1 text-sm font-semibold text-gray-700">
              {getUserRoleLabel(
                currentProfile.role
              )}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400">
          ViCourt Service
        </p>
      </div>
    </aside>
  );
}
