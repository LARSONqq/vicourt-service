"use client";

import {
  ReactNode,
  useRef,
  useState,
} from "react";

type TabId =
  | "info"
  | "tasks"
  | "materials"
  | "journal"
  | "expenses"
  | "documents"
  | "photos"
  | "history";

type Props = {
  info: ReactNode;
  tasks: ReactNode;
  materials: ReactNode;
  journal: ReactNode;
  expenses?: ReactNode;
  documents: ReactNode;
  photos: ReactNode;
  history?: ReactNode;
};

const baseTabs: Array<{
  id: TabId;
  label: string;
  icon: string;
}> = [
  {
    id: "info",
    label: "Інформація",
    icon: "📋",
  },
  {
    id: "tasks",
    label: "Завдання",
    icon: "✓",
  },
  {
    id: "materials",
    label: "Матеріали",
    icon: "📦",
  },
  {
    id: "journal",
    label: "Роботи",
    icon: "📝",
  },
  {
    id: "expenses",
    label: "Витрати",
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
    id: "history",
    label: "Історія",
    icon: "🕘",
  },
];

export default function ObjectTabs({
  info,
  tasks,
  materials,
  journal,
  expenses,
  documents,
  photos,
  history,
}: Props) {
  const [tab, setTab] =
    useState<TabId>("info");

  const scrollContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const tabs =
    baseTabs.filter(
      (item) =>
        item.id !==
          "expenses" ||
        expenses !==
          undefined
    ).filter(
      (item) =>
        item.id !==
          "history" ||
        history !==
          undefined
    );

  function handleTabChange(
    tabId: TabId,
    button: HTMLButtonElement
  ) {
    setTab(tabId);

    button.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  return (
    <div className="min-w-0">
      {/* TABS */}
      <div
        ref={scrollContainerRef}
        className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mb-6 sm:px-0"
      >
        <div className="flex min-w-max gap-2">
          {tabs.map(
            (item) => {
              const isActive =
                tab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(
                    event
                  ) =>
                    handleTabChange(
                      item.id,
                      event.currentTarget
                    )
                  }
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition sm:px-4 ${
                    isActive
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="text-sm"
                  >
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="min-w-0">
        {tab === "info" &&
          info}

        {tab === "tasks" &&
          tasks}

        {tab ===
          "materials" &&
          materials}

        {tab ===
          "journal" &&
          journal}

        {tab ===
          "expenses" &&
          expenses}

        {tab ===
          "documents" &&
          documents}

        {tab === "photos" &&
          photos}

        {tab === "history" &&
          history}
      </div>
    </div>
  );
}
