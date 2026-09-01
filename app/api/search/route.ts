import {
  NextResponse,
} from "next/server";

import {
  GlobalSearchInputError,
} from "@/lib/globalSearch";
import {
  GlobalSearchAuthError,
  searchViCourt,
} from "@/services/globalSearchService";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: Request
) {
  const url = new URL(
    request.url
  );
  const query =
    url.searchParams.get("q") ||
    "";

  try {
    const result =
      await searchViCourt(
        query
      );

    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    if (
      error instanceof
      GlobalSearchAuthError
    ) {
      return NextResponse.json(
        {
          error:
            "Потрібно увійти в систему.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "private, no-store, max-age=0",
          },
        }
      );
    }

    if (
      error instanceof
      GlobalSearchInputError
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "private, no-store, max-age=0",
          },
        }
      );
    }

    console.error(
      "[GlobalSearch] Search request failed.",
      error
    );

    return NextResponse.json(
      {
        error:
          "Не вдалося виконати пошук.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      }
    );
  }
}
