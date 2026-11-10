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
import { LogOut, UserRound } from "lucide-react";
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
    <header className="vc-shell-header sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 px-3 py-2 sm:px-6 lg:px-8">
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-xs font-medium text-muted-foreground">
          Робочий простір
        </p>
      </div>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
        <GlobalSearch />

        <ThemeSwitcher />

        <div className="vc-account-cluster flex min-w-0 items-center gap-1 rounded-lg p-0.5 md:pl-2">
          <div className="hidden min-w-0 items-center gap-2 pr-1 md:flex">
            <span aria-hidden="true" className="vc-account-avatar flex size-8 shrink-0 items-center justify-center rounded-md">
              <UserRound className="size-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 leading-tight">
              {isLoadingUser ? (
                <p className="text-xs text-muted-foreground">Завантаження...</p>
              ) : (
                <>
                  <p className="max-w-36 truncate text-xs font-semibold text-foreground xl:max-w-44">{displayName}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{getRoleLabel(role)}</p>
                  {fullName && email && <span className="sr-only">{email}</span>}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-label={isLoggingOut ? "Вихід з облікового запису" : "Вийти"}
            className="inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-auto sm:px-2.5"
          >
            {isLoggingOut ? <span aria-hidden="true">...</span> : <LogOut aria-hidden="true" className="size-4" strokeWidth={1.8} />}
            <span className="hidden lg:inline">Вийти</span>
          </button>
        </div>
      </div>
    </header>
  );
}
