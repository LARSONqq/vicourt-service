"use client";

import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header: React.ReactNode;
};

export default function AppShell({
  children,
  sidebar,
  header,
}: Props) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === "/login";

  if (isAuthPage) {
    return (
      <main className="min-h-screen bg-gray-100">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {sidebar}

      <div className="flex flex-1 flex-col">
        {header}

        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}