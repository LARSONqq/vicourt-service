import {
  NextResponse,
  type NextRequest,
} from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(
  request: NextRequest
) {
  // Vercel Cron не має browser session. Route виконує власну
  // server-side Bearer-перевірку CRON_SECRET.
  if (
    request.nextUrl.pathname ===
    "/api/cron/push-notifications"
  ) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
