import Link from "next/link";

import type { ReactNode } from "react";

export type ObjectTabId =
  | "overview"
  | "materials"
  | "work"
  | "equipment"
  | "tasks"
  | "finance"
  | "documents"
  | "photos"
  | "client-progress"
  | "history";

type Props = {
  objectId: number;
  activeTab: ObjectTabId;
  canViewFinance: boolean;
  canViewHistory: boolean;
  canManageClientProgress: boolean;
  children: ReactNode;
};

const baseTabs: Array<{
  id: ObjectTabId;
  label: string;
  icon: string;
}> = [
  {
    id: "overview",
    label: "Огляд",
    icon: "◉",
  },
  {
    id: "materials",
    label: "Матеріали",
    icon: "📦",
  },
  {
    id: "work",
    label: "Роботи",
    icon: "📝",
  },
  {
    id: "equipment",
    label: "Техніка",
    icon: "🛠",
  },
  {
    id: "tasks",
    label: "Завдання",
    icon: "✓",
  },
  {
    id: "finance",
    label: "Фінанси",
    icon: "💰",
  },
  {
    id: "documents",
    label: "Документи",
    icon: "📄",
  },
  {
    id: "photos",
    label: "Фото",
    icon: "📷",
  },
  {
    id: "client-progress",
    label: "Прогрес для клієнта",
    icon: "◔",
  },
  {
    id: "history",
    label: "Історія",
    icon: "🕘",
  },
];

export const OBJECT_TAB_IDS =
  baseTabs.map((tab) => tab.id);

export default function ObjectTabs({
  objectId,
  activeTab,
  canViewFinance,
  canViewHistory,
  canManageClientProgress,
  children,
}: Props) {
  const tabs = baseTabs
    .filter(
      (item) =>
        item.id !== "finance" ||
        canViewFinance
    )
    .filter(
      (item) =>
        item.id !== "history" ||
        canViewHistory
    )
    .filter(
      (item) =>
        item.id !== "client-progress" ||
        canManageClientProgress
    );

  return (
    <div className="min-w-0">
      <nav
        aria-label="Розділи паспорта об’єкта"
        className="-mx-4 mb-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mb-6 sm:px-0"
      >
        <div className="vc-surface flex min-w-max gap-1.5 p-1.5">
          {tabs.map((item) => {
            const isActive =
              activeTab === item.id;

            return (
              <Link
                key={item.id}
                href={`/objects/${objectId}?tab=${item.id}`}
                scroll={false}
                aria-current={
                  isActive
                    ? "page"
                    : undefined
                }
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 sm:px-4 ${
                  isActive
                    ? "bg-green-700 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="text-sm"
                >
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0">
        {children}
      </div>
    </div>
  );
}
