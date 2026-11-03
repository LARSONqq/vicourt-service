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
    <header className="vc-shell-header sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-[-0.015em] text-foreground sm:text-lg">
          Робочий простір
        </h1>

      </div>

      <div className="flex shrink-0 items-center gap-2">
        <GlobalSearch />

        <ThemeSwitcher />

        <div className="hidden text-right md:block">
          {isLoadingUser ? (
            <p className="text-sm text-muted-foreground">
              Завантаження...
            </p>
          ) : (
            <>
              <p className="max-w-[180px] truncate text-sm font-medium text-foreground">
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

              {fullName && email && <span className="sr-only">{email}</span>}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5"
        >
          {isLoggingOut
            ? "..."
            : "Вийти"}
        </button>
      </div>
    </header>
  );
}
