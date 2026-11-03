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

  return <nav aria-label="Основна навігація" className="space-y-0.5">
    {items.map((item) => {
      const isActive = item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
      const Icon = iconByHref[item.href as keyof typeof iconByHref];
      return <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`vc-nav-item group relative flex min-h-10 min-w-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar ${
          isActive
            ? "vc-nav-item-active"
            : ""
        }`}
      >
        {Icon && <Icon aria-hidden="true" className="vc-nav-icon size-4 shrink-0 transition" />}
        <span className="min-w-0 break-words">{item.name}</span>
      </Link>;
    })}
  </nav>;
}
