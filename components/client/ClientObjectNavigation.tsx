"use client";

import { useSyncExternalStore } from "react";

const sections = [
  ["client-overview", "Огляд"],
  ["client-progress-title", "Прогрес"],
  ["client-photos-title", "Фото"],
  ["client-documents-title", "Документи"],
] as const;

function currentSection() {
  const id = window.location.hash.slice(1);
  return sections.some(([section]) => section === id) ? id : "client-overview";
}
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

export default function ClientObjectNavigation() {
  const active = useSyncExternalStore(subscribe, currentSection, () => "client-overview");
  // Native fragment links retain BOTH pagination query parameters, support
  // browser Back/Forward and work before hydration. No data/router refactor.
  return <nav aria-label="Розділи об’єкта" className="sticky top-2 z-10 grid min-w-0 grid-cols-4 gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
    {sections.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined}
      className={`flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 sm:text-sm ${active === id ? "bg-green-800 text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
      {label}
    </a>)}
  </nav>;
}
