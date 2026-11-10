import "server-only";

import Link from "next/link";
import { Camera, FileText, LayoutDashboard, ListChecks } from "lucide-react";

export const clientObjectSections = ["overview", "updates", "photos", "documents"] as const;
export type ClientObjectSection = (typeof clientObjectSections)[number];

const sections = [
  { id: "overview", label: "Огляд", Icon: LayoutDashboard },
  { id: "updates", label: "Оновлення", Icon: ListChecks },
  { id: "photos", label: "Фото", Icon: Camera },
  { id: "documents", label: "Документи", Icon: FileText },
] as const;

export function clientObjectSection(value: string | string[] | undefined): ClientObjectSection {
  const section = Array.isArray(value) ? value[0] : value;
  return clientObjectSections.includes(section as ClientObjectSection) ? section as ClientObjectSection : "overview";
}

export default function ClientObjectNavigation({ objectId, active }: { objectId: number; active: ClientObjectSection }) {
  return <nav aria-label="Розділи об’єкта" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
    <div className="flex w-max min-w-full gap-1 rounded-xl bg-gray-200/70 p-1">
      {sections.map(({ id, label, Icon }) => <Link key={id}
        href={id === "overview" ? `/client/objects/${objectId}` : `/client/objects/${objectId}?section=${id}`}
        aria-current={active === id ? "page" : undefined} scroll={false}
        className={`inline-flex min-h-11 min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${active === id ? "bg-white text-gray-950 shadow-sm" : "text-gray-600 hover:bg-white/60 hover:text-gray-950"}`}>
        <Icon aria-hidden="true" className={`size-4 ${active === id ? "text-emerald-700" : "text-gray-400"}`} />{label}
      </Link>)}
    </div>
  </nav>;
}
