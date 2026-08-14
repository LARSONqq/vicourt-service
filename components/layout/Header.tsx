"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [fullName, setFullName] =
    useState("");

  const [role, setRole] =
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
          .eq("id", user.id)
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
    <header className="flex items-center justify-between border-b bg-white px-8 py-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          ViCourt Service
        </h1>

        <p className="text-xs text-gray-400">
          Система управління
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          {isLoadingUser ? (
            <p className="text-sm text-gray-400">
              Завантаження...
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-800">
                👤 {displayName}
              </p>

              <div className="mt-1 flex items-center justify-end gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    role === "admin"
                      ? "bg-green-100 text-green-700"
                      : role ===
                          "object_manager"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {getRoleLabel(
                    role
                  )}
                </span>
              </div>

              {fullName && email && (
                <p className="mt-1 text-xs text-gray-400">
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
          className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoggingOut
            ? "Вихід..."
            : "Вийти"}
        </button>
      </div>
    </header>
  );
}