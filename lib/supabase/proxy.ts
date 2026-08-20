import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,

      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY!,

      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) =>
                request.cookies.set(
                  name,
                  value
                )
            );

            supabaseResponse =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) =>
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options
                )
            );
          },
        },
      }
    );

  const {
    data,
    error,
  } =
    await supabase.auth.getClaims();

  const claims =
    error
      ? null
      : data?.claims;

  const pathname =
    request.nextUrl.pathname;

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/auth/confirm";

  const isGuestOnlyPage =
    pathname === "/login" ||
    pathname === "/register";

  let isActiveUser = false;

  if (
    claims?.sub
  ) {
    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("is_active")
      .eq(
        "id",
        claims.sub
      )
      .maybeSingle();

    if (
      !profileError &&
      profile?.is_active ===
        true
    ) {
      isActiveUser = true;
    }
  }

  // Заблокований користувач
  // не може відкривати ViCourt.
  if (
    claims &&
    !isActiveUser
  ) {
    if (
      pathname === "/login"
    ) {
      return supabaseResponse;
    }

    const url =
      request.nextUrl.clone();

    url.pathname =
      "/login";

    url.search =
      "";

    url.searchParams.set(
      "blocked",
      "1"
    );

    return NextResponse.redirect(
      url
    );
  }

  // Неавторизований користувач
  if (
    !claims &&
    !isPublicRoute
  ) {
    const url =
      request.nextUrl.clone();

    url.pathname =
      "/login";

    url.search =
      "";

    return NextResponse.redirect(
      url
    );
  }

  // Активний авторизований користувач
  // не повинен бачити login/register.
  if (
    claims &&
    isActiveUser &&
    isGuestOnlyPage
  ) {
    const url =
      request.nextUrl.clone();

    url.pathname =
      "/";

    url.search =
      "";

    return NextResponse.redirect(
      url
    );
  }

  return supabaseResponse;
}