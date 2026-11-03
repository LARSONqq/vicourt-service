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
    <aside className="vc-sidebar flex h-dvh w-64 flex-col px-3 py-4 text-sidebar-foreground">
      <div className="mb-4 border-b border-sidebar-border px-2 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent text-xs font-bold tracking-[0.1em] text-sidebar-accent-foreground">VC</span>
          <div className="min-w-0">
            <h2 className="break-words text-sm font-semibold leading-tight tracking-[-0.015em] text-sidebar-foreground">
              {settings.company_name}
            </h2>
            <p className="vc-sidebar-secondary mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em]">ViCourt Service</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNavigation items={visibleMenuItems.map(({ name, href }) => ({ name, href }))} />
      </div>

      <div className="mt-4 shrink-0 border-t border-sidebar-border px-2 pt-4 pb-[env(safe-area-inset-bottom)]">
        {currentProfile && (
          <div>
            <p className="vc-sidebar-secondary text-[10px] font-medium uppercase tracking-[0.12em]">
              Ви увійшли як
            </p>

            <p className="mt-1 break-words text-sm font-medium text-sidebar-foreground">
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
