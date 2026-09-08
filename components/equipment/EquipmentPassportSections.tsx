import Link from "next/link";

import type {
  ReactNode,
} from "react";

export type EquipmentTabId =
  | "overview"
  | "service"
  | "usage"
  | "tasks"
  | "history";

type Props = {
  equipmentId: number;
  activeTab: EquipmentTabId;
  canViewHistory: boolean;
  children: ReactNode;
};

const equipmentTabs: Array<{
  id: EquipmentTabId;
  label: string;
  icon: string;
}> = [
  {
    id: "overview",
    label: "Огляд",
    icon: "◉",
  },
  {
    id: "service",
    label: "Обслуговування",
    icon: "🔧",
  },
  {
    id: "usage",
    label: "Використання",
    icon: "⏱",
  },
  {
    id: "tasks",
    label: "Завдання",
    icon: "✓",
  },
  {
    id: "history",
    label: "Історія",
    icon: "↻",
  },
];

export const EQUIPMENT_TAB_IDS =
  equipmentTabs.map(
    (tab) => tab.id
  );

export default function EquipmentPassportSections({
  equipmentId,
  activeTab,
  canViewHistory,
  children,
}: Props) {
  const visibleTabs =
    equipmentTabs.filter(
      (tab) =>
        tab.id !== "history" ||
        canViewHistory
    );

  return (
    <div className="min-w-0">
      <nav
        aria-label="Розділи паспорта техніки"
        className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mb-6 sm:px-0"
      >
        <div className="flex min-w-max gap-2">
          {visibleTabs.map((tab) => {
            const isActive =
              activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                href={`/equipment/${equipmentId}?tab=${tab.id}`}
                scroll={false}
                aria-current={
                  isActive
                    ? "page"
                    : undefined
                }
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  isActive
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span aria-hidden="true">
                  {tab.icon}
                </span>
                {tab.label}
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
