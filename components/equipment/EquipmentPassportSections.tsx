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
        className="sticky top-16 z-20 -mx-4 mb-5 max-w-[calc(100%+2rem)] overflow-x-auto overscroll-x-contain bg-background/95 px-4 pb-2 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:mx-0 sm:mb-6 sm:max-w-full sm:px-0"
      >
        <span className="mb-1 block text-[11px] text-muted-foreground sm:hidden">
          Розділи можна гортати горизонтально →
        </span>

        <div className="vc-surface flex w-max min-w-full gap-1.5 p-1.5">
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
