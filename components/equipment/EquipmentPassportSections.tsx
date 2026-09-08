"use client";

import {
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

type SectionId =
  | "overview"
  | "service"
  | "usage"
  | "tasks"
  | "activity";

type Props = {
  overview: ReactNode;
  service: ReactNode;
  usage: ReactNode;
  tasks: ReactNode;
  activity?: ReactNode;
};

const sections: Array<{
  id: SectionId;
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
    id: "activity",
    label: "Історія",
    icon: "↻",
  },
];

export default function EquipmentPassportSections({
  overview,
  service,
  usage,
  tasks,
  activity,
}: Props) {
  const [activeSection, setActiveSection] =
    useState<SectionId>(
      "overview"
    );
  const contentBySection: Record<
    SectionId,
    ReactNode
  > = {
    overview,
    service,
    usage,
    tasks,
    activity: activity ?? null,
  };
  const content =
    contentBySection[
      activeSection
    ];
  const visibleSections =
    activity === undefined
      ? sections.filter(
          (section) =>
            section.id !==
            "activity"
        )
      : sections;

  return (
    <div className="min-w-0 space-y-5">
      <nav
        aria-label="Розділи паспорта техніки"
        className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        <div
          role="tablist"
          className="flex min-w-max gap-2"
        >
          {visibleSections.map(
            (section) => {
              const isActive =
                activeSection ===
                section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  id={`equipment-tab-${section.id}`}
                  aria-selected={
                    isActive
                  }
                  aria-controls={`equipment-panel-${section.id}`}
                  onClick={() =>
                    setActiveSection(
                      section.id
                    )
                  }
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition sm:px-4 ${
                    isActive
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span aria-hidden="true">
                    {section.icon}
                  </span>
                  {section.label}
                </button>
              );
            }
          )}
        </div>
      </nav>

      <div
        role="tabpanel"
        id={`equipment-panel-${activeSection}`}
        aria-labelledby={`equipment-tab-${activeSection}`}
        className="min-w-0"
      >
        {content}
      </div>
    </div>
  );
}
