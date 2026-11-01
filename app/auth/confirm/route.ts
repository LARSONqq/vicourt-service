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

  const code =
    searchParams.get(
      "code"
    );

  const requestedNext =
    searchParams.get(
      "next"
    );

  const isRecovery =
    type === "recovery" ||
    (Boolean(code) && requestedNext === "/update-password");

  const redirectTo =
    request.nextUrl.clone();

  redirectTo.search = "";

  if ((tokenHash && type) || code) {
    const supabase =
      await createClient();

    const result = tokenHash && type
      ? await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })
      : await supabase.auth.exchangeCodeForSession(code!);

    if (!result.error) {
      redirectTo.pathname =
        isRecovery
          ? "/update-password"
          : "/";

      return NextResponse.redirect(
        redirectTo
      );
    }
  }

  if (isRecovery) {
    redirectTo.pathname =
      "/update-password";

    redirectTo.searchParams.set(
      "error",
      "invalid"
    );

    return NextResponse.redirect(
      redirectTo
    );
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
