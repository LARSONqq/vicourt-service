"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
} from "next/navigation";

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
  const pathname =
    usePathname();

  const [
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  ] = useState(false);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register";

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (
      !isMobileMenuOpen
    ) {
      document.body.style.overflow =
        "";

      return;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [isMobileMenuOpen]);

  if (isAuthPage) {
    return (
      <main className="min-h-screen bg-gray-100">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* DESKTOP SIDEBAR */}
      <div className="hidden shrink-0 lg:block">
        {sidebar}
      </div>

      {/* MOBILE MENU BUTTON */}
      <button
        type="button"
        onClick={() =>
          setIsMobileMenuOpen(true)
        }
        aria-label="Відкрити меню"
        className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg border bg-white text-xl text-gray-700 shadow-sm lg:hidden"
      >
        ☰
      </button>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Закрити меню"
            onClick={() =>
              setIsMobileMenuOpen(false)
            }
            className="absolute inset-0 bg-black/40"
          />

          <div
            className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white shadow-xl"
            onClick={(event) => {
              const target =
                event.target as HTMLElement;

              if (
                target.closest("a")
              ) {
                setIsMobileMenuOpen(
                  false
                );
              }
            }}
          >
            {sidebar}

            <button
              type="button"
              onClick={() =>
                setIsMobileMenuOpen(false)
              }
              aria-label="Закрити меню"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-xl text-gray-600 hover:bg-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* PAGE */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="pl-12 lg:pl-0">
          {header}
        </div>

        <main className="flex-1 overflow-auto p-4 sm:p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}