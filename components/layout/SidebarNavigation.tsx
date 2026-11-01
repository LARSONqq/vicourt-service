"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, Boxes, CalendarDays, ClipboardCheck, FileBarChart, Home, PackageSearch,
  Settings, ShieldCheck, Tractor, UsersRound, Warehouse,
} from "lucide-react";

type NavigationItem = {
  name: string;
  href: string;
};

const iconByHref = {
  "/": Home,
  "/objects": Boxes,
  "/notifications": Bell,
  "/tasks": ClipboardCheck,
  "/calendar": CalendarDays,
  "/warehouse": Warehouse,
  "/purchases": PackageSearch,
  "/equipment": Tractor,
  "/employees": UsersRound,
  "/reports": FileBarChart,
  "/activity": ShieldCheck,
  "/settings": Settings,
  "/users": UsersRound,
} as const;

export default function SidebarNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return <nav aria-label="Основна навігація" className="space-y-1">
    {items.map((item) => {
      const isActive = item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
      const Icon = iconByHref[item.href as keyof typeof iconByHref];
      return <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`group relative flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
          isActive
            ? "bg-emerald-400/14 text-white shadow-[inset_2px_0_0_0_rgb(52_211_153)]"
            : "text-white/60 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        {Icon && <Icon aria-hidden="true" className={`size-[18px] shrink-0 ${isActive ? "text-emerald-300" : "text-white/40 transition group-hover:text-white/70"}`} />}
        <span className="min-w-0 break-words">{item.name}</span>
      </Link>;
    })}
  </nav>;
}
