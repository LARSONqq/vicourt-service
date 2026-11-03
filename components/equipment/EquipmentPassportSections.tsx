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
        className="-mx-4 mb-5 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:mb-6 sm:px-0"
      >
        <div className="vc-surface flex min-w-max gap-1.5 p-1.5">
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
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:px-4 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
