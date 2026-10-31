"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  name: string;
  href: string;
};

export default function SidebarNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return <nav aria-label="Основна навігація" className="space-y-1">
    {items.map((item) => {
      const isActive = item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex min-h-11 min-w-0 items-center rounded-lg px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 ${
          isActive
            ? "bg-green-50 text-green-800 shadow-[inset_3px_0_0_0_rgb(22_101_52)]"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-950"
        }`}
      >
        <span className="min-w-0 break-words">{item.name}</span>
      </Link>;
    })}
  </nav>;
}
