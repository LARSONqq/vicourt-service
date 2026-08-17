import type {
  EmailOtpType,
} from "@supabase/supabase-js";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export async function GET(
  request: NextRequest
) {
  const {
    searchParams,
  } = new URL(
    request.url
  );

  const tokenHash =
    searchParams.get(
      "token_hash"
    );

  const type =
    searchParams.get(
      "type"
    ) as EmailOtpType | null;

  const redirectTo =
    request.nextUrl.clone();

  redirectTo.search = "";

  if (
    tokenHash &&
    type
  ) {
    const supabase =
      await createClient();

    const {
      error,
    } =
      await supabase.auth.verifyOtp({
        token_hash:
          tokenHash,

        type,
      });

    if (!error) {
      redirectTo.pathname =
        "/";

      return NextResponse.redirect(
        redirectTo
      );
    }
  }

  redirectTo.pathname =
    "/login";

  redirectTo.searchParams.set(
    "error",
    "confirmation"
  );

  return NextResponse.redirect(
    redirectTo
  );
}