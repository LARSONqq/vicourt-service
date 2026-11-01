export type AccountIdentity = "internal" | "client" | "denied" | "guest";

export function accountHome(identity: AccountIdentity): string {
  if (identity === "internal") return "/";
  if (identity === "client") return "/client";
  return identity === "guest" ? "/login" : "/access-denied";
}

export function accountRedirect(identity: AccountIdentity, pathname: string): string | null {
  // Auth recovery routes must remain reachable before and after Supabase establishes a session.
  if (pathname === "/auth/confirm" || pathname === "/forgot-password" || pathname === "/update-password") return null;
  const guestPage = pathname === "/login" || pathname === "/register";
  if (identity === "guest") return guestPage ? null : "/login";
  if (identity === "denied") return pathname === "/access-denied" ? null : "/access-denied";
  const clientRoute = pathname === "/client" || pathname.startsWith("/client/");
  if (identity === "client") return clientRoute ? null : "/client";
  return clientRoute || guestPage || pathname === "/access-denied" ? "/" : null;
}
