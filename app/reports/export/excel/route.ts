import type {
  NextRequest,
} from "next/server";

import {
  canViewReports,
} from "@/lib/auth/permissions";
import {
  getReportFilterInput,
} from "@/lib/reportExportParams";

import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  createReportsWorkbook,
} from "@/services/reportExcelService";
import {
  getReportsData,
  normalizeReportsFilters,
} from "@/services/reportService";

export const dynamic =
  "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest
) {
  try {
    const profile =
      await getCurrentUserProfile();

    if (!profile) {
      return new Response(
        "Потрібна авторизація.",
        { status: 401 }
      );
    }

    if (
      !canViewReports(
        profile.role
      )
    ) {
      return new Response(
        "Недостатньо прав.",
        { status: 403 }
      );
    }

    const filters =
      normalizeReportsFilters(
        getReportFilterInput(
          request.nextUrl
            .searchParams
        )
      );
    const data =
      await getReportsData(
        filters
      );
    const workbook =
      await createReportsWorkbook(
        data
      );
    const filename =
      `vicourt-report-${data.filters.dateFrom}-${data.filters.dateTo}.xlsx`;

    return new Response(
      new Uint8Array(workbook),
      {
        headers: {
          "Cache-Control":
            "no-store",
          "Content-Disposition":
            `attachment; filename="${filename}"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(
      "Не вдалося сформувати Excel-звіт:",
      error instanceof Error
        ? error.message
        : error
    );

    return new Response(
      "Не вдалося сформувати Excel-звіт.",
      { status: 500 }
    );
  }
}
