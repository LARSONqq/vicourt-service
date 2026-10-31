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

  const [
    previousPathname,
    setPreviousPathname,
  ] = useState(pathname);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
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
      <main className="min-h-dvh bg-background">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-dvh min-w-0 bg-background">
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
        className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-xl text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 lg:hidden"
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
            className="absolute inset-0 bg-gray-950/45 backdrop-blur-[1px]"
          />

          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[calc(100vw-3rem)] overflow-y-auto bg-white shadow-2xl"
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
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl text-gray-600 transition hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
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

        <main className="min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
