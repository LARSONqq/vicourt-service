import "server-only";

import { canViewReports } from "@/lib/auth/permissions";
import { isValidDateValue } from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import { getAccountIdentity } from "@/services/accountIdentityService";
import { getCurrentUserProfile } from "@/services/profileService";
import type {
  ReportMaterialPeriodMode,
  ReportOverviewMaterialTotals,
  ReportsFilters,
} from "@/types/report";

type MaterialTotalsInput = Pick<
  ReportsFilters,
  "dateFrom" | "dateTo" | "objectId"
>;

const periodModes = new Set<ReportMaterialPeriodMode>([
  "legacy",
  "exact",
  "mixed",
]);

const loadError = () =>
  new Error(
    "Не вдалося завантажити підсумок матеріалів. Спробуйте пізніше."
  );

function finiteNumber(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    throw loadError();
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw loadError();
  }

  return parsed;
}

function nullableFiniteNumber(value: unknown) {
  return value === null ? null : finiteNumber(value);
}

function parseCutover(value: unknown) {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== "string" ||
    Number.isNaN(Date.parse(value))
  ) {
    throw loadError();
  }

  return value;
}

export async function getReportOverviewMaterialTotals(
  input: MaterialTotalsInput
): Promise<ReportOverviewMaterialTotals> {
  if ((await getAccountIdentity()) !== "internal") {
    throw new Error("Недостатньо прав для перегляду звітів.");
  }

  const profile = await getCurrentUserProfile();

  if (!profile?.is_active || !canViewReports(profile.role)) {
    throw new Error("Недостатньо прав для перегляду звітів.");
  }

  if (
    !input ||
    typeof input.dateFrom !== "string" ||
    typeof input.dateTo !== "string" ||
    !isValidDateValue(input.dateFrom) ||
    !isValidDateValue(input.dateTo) ||
    input.dateFrom > input.dateTo ||
    (input.objectId !== null &&
      (!Number.isSafeInteger(input.objectId) || input.objectId <= 0))
  ) {
    throw new Error("Некоректні параметри звітного періоду.");
  }

  const supabase = await createClient();
  const { data, error } = await Promise.resolve().then(() =>
    supabase.rpc("get_report_overview_material_totals", {
      p_date_from: input.dateFrom,
      p_date_to: input.dateTo,
      p_object_id: input.objectId,
    })
  ).catch(() => {
    throw loadError();
  });

  if (
    error ||
    !Array.isArray(data) ||
    data.length !== 1 ||
    !data[0] ||
    typeof data[0] !== "object"
  ) {
    throw loadError();
  }

  const row = data[0] as Record<string, unknown>;
  const periodMode = row.period_mode;

  if (
    typeof periodMode !== "string" ||
    !periodModes.has(periodMode as ReportMaterialPeriodMode)
  ) {
    throw loadError();
  }

  const result: ReportOverviewMaterialTotals = {
    materials_cost: finiteNumber(row.materials_cost),
    exact_cost: finiteNumber(row.exact_cost),
    legacy_approximate_cost: nullableFiniteNumber(
      row.legacy_approximate_cost
    ),
    period_mode: periodMode as ReportMaterialPeriodMode,
    cutover_at: parseCutover(row.cutover_at),
  };

  if (
    (result.period_mode === "mixed" &&
      (result.legacy_approximate_cost !== null ||
        result.materials_cost !== result.exact_cost)) ||
    (result.period_mode === "exact" &&
      (result.legacy_approximate_cost !== 0 ||
        result.materials_cost !== result.exact_cost)) ||
    (result.period_mode === "legacy" &&
      (result.exact_cost !== 0 ||
        result.legacy_approximate_cost === null ||
        result.materials_cost !== result.legacy_approximate_cost)) ||
    (result.period_mode !== "legacy" && result.cutover_at === null)
  ) {
    throw loadError();
  }

  return result;
}
