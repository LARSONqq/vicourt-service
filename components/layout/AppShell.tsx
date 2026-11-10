"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
} from "next/navigation";
import { Menu, X } from "lucide-react";
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
        className="vc-shell-control fixed left-3 top-2 z-40 flex size-10 items-center justify-center rounded-md text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" strokeWidth={1.8} />
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
            className="absolute inset-0 bg-slate-900/35 dark:bg-slate-950/55"
          />

          <div
            className="absolute inset-y-0 left-0 w-64 max-w-[calc(100vw-3rem)] overflow-y-auto bg-sidebar shadow-lg"
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
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <X aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}

      {/* PAGE */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="pl-14 lg:pl-0">
          {header}
        </div>

        <main className="vc-workspace min-w-0 flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-5">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
        </main>
      </div>
      </div>
    </ThemeProvider>
  );
}
