"use client";

import { ReactNode, useState } from "react";

type TabId =
  | "info"
  | "tasks"
  | "materials"
  | "journal"
  | "photos";

type Props = {
  info: ReactNode;
  tasks: ReactNode;
  materials: ReactNode;
  journal: ReactNode;
  photos: ReactNode;
};

export default function ObjectTabs({
  info,
  tasks,
  materials,
  journal,
  photos,
}: Props) {
  const [tab, setTab] = useState<TabId>("info");

  const tabs: Array<{
    id: TabId;
    label: string;
  }> = [
    { id: "info", label: "Інформація" },
    { id: "tasks", label: "Завдання" },
    { id: "materials", label: "Матеріали" },
    { id: "journal", label: "Роботи" },
    { id: "photos", label: "Фото" },
  ];

  return (
    <div>
      <div className="mb-6 overflow-x-auto border-b">
        <div className="flex min-w-max gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`border-b-2 px-4 py-3 transition ${
                tab === item.id
                  ? "border-green-600 font-semibold text-green-600"
                  : "border-transparent text-gray-500 hover:text-black"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "info" && info}
      {tab === "tasks" && tasks}
      {tab === "materials" && materials}
      {tab === "journal" && journal}
      {tab === "photos" && photos}
    </div>
  );
}