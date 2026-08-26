import {
  unstable_rethrow,
} from "next/navigation";

import { getAppSettings } from "@/services/settingsService";
import { getCurrentUserProfile } from "@/services/profileService";
import {
  getNotificationCenter,
} from "@/services/notificationService";

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
    name: "Сповіщення",
    href: "/notifications",
    section: "notifications",
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
    notificationCenter,
  ] = await Promise.all([
    getAppSettings(),
    getCurrentUserProfile(),
    getNotificationCenter().catch(
      (error: unknown) => {
        unstable_rethrow(error);

        console.error(
          "[Notifications] Не вдалося завантажити badge у навігації.",
          error
        );

        return null;
      }
    ),
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
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-4 py-3 font-medium text-gray-700 transition hover:bg-green-50 hover:text-green-700"
            >
              <span className="min-w-0 break-words">
                {item.name}
              </span>

              {item.section ===
                "notifications" &&
                Number(
                  notificationCenter
                    ?.summary.total ||
                    0
                ) > 0 && (
                  <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {Number(
                      notificationCenter
                        ?.summary.total ||
                        0
                    ) > 99
                      ? "99+"
                      : notificationCenter
                          ?.summary
                          .total}
                  </span>
                )}
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
