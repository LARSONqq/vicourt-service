"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
} from "next/navigation";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

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

  const [
    previousPathname,
    setPreviousPathname,
  ] = useState(pathname);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/update-password" ||
    pathname.startsWith(
      "/auth/"
    );

  if (
    pathname !==
    previousPathname
  ) {
    setPreviousPathname(
      pathname
    );
    setIsMobileMenuOpen(false);
  }

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
      <ThemeProvider>
        <main className="min-h-dvh bg-background">
          {children}
        </main>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="vc-app-shell flex h-dvh min-w-0 bg-background">
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
        className="fixed left-3 top-2.5 z-40 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-lg text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
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
            className="absolute inset-0 bg-gray-950/40"
          />

          <div
            className="absolute inset-y-0 left-0 w-64 max-w-[calc(100vw-3rem)] overflow-y-auto bg-sidebar shadow-xl"
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
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-xl text-sidebar-foreground/60 transition hover:bg-muted hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* PAGE */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="pl-14 lg:pl-0">
          {header}
        </div>

        <main className="vc-workspace min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
        </main>
      </div>
      </div>
    </ThemeProvider>
  );
}
