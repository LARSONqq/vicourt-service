import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";
import { accountRedirect, type AccountIdentity } from "@/lib/auth/accountRouting";

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

  let identity: AccountIdentity = "guest";
  if (claims?.sub) {
    const result = await supabase.rpc("get_application_identity");
    identity = !result.error && (result.data === "internal" || result.data === "client")
      ? result.data : "denied";
  }

  const destination = accountRedirect(identity, pathname);
  if (destination) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    const response = NextResponse.redirect(url);
    // Retain refresh cookies on redirects as well as NextResponse.next().
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
    return response;
  }

  return supabaseResponse;
}
