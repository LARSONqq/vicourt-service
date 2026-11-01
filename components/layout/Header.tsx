"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";
import GlobalSearch from "@/components/search/GlobalSearch";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

type UserRole =
  | "admin"
  | "object_manager"
  | "worker";

type UserProfile = {
  full_name: string | null;
  role: UserRole;
};

function getRoleLabel(
  role: UserRole | null
) {
  switch (role) {
    case "admin":
      return "Адміністратор";

    case "object_manager":
      return "Керівник об’єкта";

    case "worker":
      return "Працівник";

    default:
      return "Користувач";
  }
}

export function Header() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    role,
    setRole,
  ] =
    useState<UserRole | null>(
      null
    );

  const [
    isLoadingUser,
    setIsLoadingUser,
  ] = useState(true);

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  useEffect(() => {
    const supabase =
      createClient();

    async function loadUser() {
      try {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!user) {
          return;
        }

        setEmail(
          user.email || ""
        );

        const {
          data: profile,
        } = await supabase
          .from("profiles")
          .select(`
            full_name,
            role
          `)
          .eq(
            "id",
            user.id
          )
          .maybeSingle<UserProfile>();

        if (profile) {
          setFullName(
            profile.full_name || ""
          );

          setRole(
            profile.role
          );
        }
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      const supabase =
        createClient();

      await supabase.auth.signOut();

      router.replace(
        "/login"
      );

      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const displayName =
    fullName.trim() ||
    email ||
    "Користувач";

  return (
    <header className="vc-shell-header sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-[-0.025em] text-foreground sm:text-xl">
          <span className="sm:hidden">
            ViCourt
          </span>

          <span className="hidden sm:inline">
            ViCourt Service
          </span>
        </h1>

        <p className="mt-0.5 hidden text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:block">
          Service management
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <GlobalSearch />

        <ThemeSwitcher />

        <div className="hidden text-right md:block">
          {isLoadingUser ? (
            <p className="text-sm text-gray-400">
              Завантаження...
            </p>
          ) : (
            <>
              <p className="max-w-[220px] truncate text-sm font-semibold text-foreground">
                {displayName}
              </p>

              <div className="mt-1 flex items-center justify-end gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    role === "admin"
                      ? "vc-status-success"
                      : role ===
                          "object_manager"
                        ? "vc-status-info"
                        : "vc-status-neutral"
                  }`}
                >
                  {getRoleLabel(
                    role
                  )}
                </span>
              </div>

              {fullName &&
                email && (
                  <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                    {email}
                  </p>
                )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          {isLoggingOut
            ? "..."
            : "Вийти"}
        </button>
      </div>
    </header>
  );
}
