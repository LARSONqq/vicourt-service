import { getAppSettings } from "@/services/settingsService";
import { getCurrentUserProfile } from "@/services/profileService";

import {
  canAccessSection,
  type AppSection,
} from "@/lib/auth/permissions";

import {
  getUserRoleLabel,
} from "@/types/userProfile";
import SidebarNavigation from "@/components/layout/SidebarNavigation";

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
    name: "Сповіщення",
    href: "/notifications",
    section: "notifications",
  },
  {
    name: "Завдання",
    href: "/tasks",
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
    <aside className="flex h-dvh w-72 flex-col border-r border-gray-200/90 bg-white px-4 py-5">
      <div className="mb-5 border-b border-gray-100 px-2 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-700 text-sm font-bold tracking-wide text-white shadow-sm">VC</span>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold leading-tight tracking-tight text-gray-950">
              {settings.company_name}
            </h2>
            <p className="mt-1 text-xs text-gray-500">ViCourt Service</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNavigation items={visibleMenuItems.map(({ name, href }) => ({ name, href }))} />
      </div>

      <div className="mt-5 border-t border-gray-100 px-2 pt-4">
        {currentProfile && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Ви увійшли як
            </p>

            <p className="mt-1 break-words text-sm font-semibold text-gray-700">
              {getUserRoleLabel(
                currentProfile.role
              )}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
