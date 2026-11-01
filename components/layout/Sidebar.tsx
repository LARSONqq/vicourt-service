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
    <aside className="vc-sidebar flex h-dvh w-72 flex-col px-4 py-5 text-sidebar-foreground">
      <div className="mb-6 border-b border-white/10 px-2 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/15 text-sm font-bold tracking-[0.12em] text-emerald-300 shadow-sm">VC</span>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold leading-tight tracking-[-0.025em] text-white">
              {settings.company_name}
            </h2>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-200/55">ViCourt Service</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNavigation items={visibleMenuItems.map(({ name, href }) => ({ name, href }))} />
      </div>

      <div className="mt-5 border-t border-white/10 px-2 pt-4">
        {currentProfile && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              Ви увійшли як
            </p>

            <p className="mt-1 break-words text-sm font-semibold text-white/75">
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
