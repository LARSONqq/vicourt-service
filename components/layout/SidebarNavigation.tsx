"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, Boxes, CalendarDays, ClipboardCheck, FileBarChart, Home, PackageSearch,
  Settings, ShieldCheck, Tractor, UserCog, UsersRound, Warehouse,
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
  "/users": UserCog,
} as const;

const navigationGroups = [
  {
    label: "Робота",
    hrefs: ["/", "/objects", "/notifications", "/tasks", "/calendar"],
  },
  {
    label: "Ресурси",
    hrefs: ["/warehouse", "/purchases", "/equipment", "/employees"],
  },
  {
    label: "Аналітика",
    hrefs: ["/reports"],
  },
  {
    label: "Система",
    hrefs: ["/activity", "/settings", "/users"],
  },
] as const;

export default function SidebarNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return <nav aria-label="Основна навігація" className="space-y-3">
    {navigationGroups.map((group) => {
      const groupItems = items.filter((item) => (group.hrefs as readonly string[]).includes(item.href));
      if (groupItems.length === 0) return null;

      return <section key={group.label} aria-labelledby={`sidebar-${group.label}`}>
        <h3 id={`sidebar-${group.label}`} className="vc-nav-section-label px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-[0.1em]">
          {group.label}
        </h3>
        <div className="space-y-0.5">
          {groupItems.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = iconByHref[item.href as keyof typeof iconByHref];
            return <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`vc-nav-item group relative flex min-h-10 min-w-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar lg:min-h-9 ${
                isActive
                  ? "vc-nav-item-active"
                  : ""
              }`}
            >
              {Icon && <Icon aria-hidden="true" className="vc-nav-icon size-4 shrink-0 transition" strokeWidth={1.8} />}
              <span className="min-w-0 break-words">{item.name}</span>
            </Link>;
          })}
        </div>
      </section>;
    })}
  </nav>;
}
