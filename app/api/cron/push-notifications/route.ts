import {
  timingSafeEqual,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  runAutomaticPushDelivery,
} from "@/services/automaticPushService";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string
) {
  const prefix = "Bearer ";

  if (
    !authorization?.startsWith(
      prefix
    )
  ) {
    return false;
  }

  const provided =
    Buffer.from(
      authorization.slice(
        prefix.length
      ),
      "utf8"
    );
  const expected =
    Buffer.from(
      secret,
      "utf8"
    );

  return (
    provided.length ===
      expected.length &&
    timingSafeEqual(
      provided,
      expected
    )
  );
}

export async function GET(
  request: Request
) {
  const cronSecret =
    process.env
      .CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error(
      "[AutomaticPush] CRON_SECRET не налаштовано."
    );

    return NextResponse.json(
      {
        error:
          "Automatic push cron не налаштовано.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    !isAuthorizedCronRequest(
      request.headers.get(
        "authorization"
      ),
      cronSecret
    )
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const stats =
      await runAutomaticPushDelivery();

    return NextResponse.json(
      stats
    );
  } catch (error) {
    console.error(
      "[AutomaticPush] Cron run завершився fatal error.",
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "unknown"
    );

    return NextResponse.json(
      {
        error:
          "Automatic push evaluator не завершив роботу.",
      },
      {
        status: 500,
      }
    );
  }
}
