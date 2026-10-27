import "server-only";

import { objectExpenseCategories } from "@/constants/objectExpenses";
import { canViewReports } from "@/lib/auth/permissions";
import { isValidDateValue } from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import { getAccountIdentity } from "@/services/accountIdentityService";
import { getCurrentUserProfile } from "@/services/profileService";
import type { ReportOverviewPeriodTotals, ReportsFilters } from "@/types/report";

type PeriodTotalsInput = Pick<ReportsFilters,
  "dateFrom" | "dateTo" | "objectId" | "employeeId" | "expenseCategory">;

const loadError = () => new Error("Не вдалося завантажити підсумки звітного періоду. Спробуйте пізніше.");

function finiteNumber(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && value.trim() === "")) throw loadError();
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw loadError();
  return parsed;
}

export async function getReportOverviewPeriodTotals(input: PeriodTotalsInput): Promise<ReportOverviewPeriodTotals> {
  if (await getAccountIdentity() !== "internal") throw new Error("Недостатньо прав для перегляду звітів.");
  const profile = await getCurrentUserProfile();
  if (!profile?.is_active || !canViewReports(profile.role)) throw new Error("Недостатньо прав для перегляду звітів.");

  if (!input || typeof input.dateFrom !== "string" || typeof input.dateTo !== "string"
    || !isValidDateValue(input.dateFrom) || !isValidDateValue(input.dateTo) || input.dateFrom > input.dateTo
    || [input.objectId, input.employeeId].some((id) => id !== null && (!Number.isSafeInteger(id) || id <= 0))
    || (input.expenseCategory !== null && !objectExpenseCategories.includes(input.expenseCategory))) {
    throw new Error("Некоректні параметри звітного періоду.");
  }

  const supabase = await createClient();
  const { data, error } = await Promise.resolve().then(() => supabase.rpc("get_report_overview_period_totals", {
    p_date_from: input.dateFrom,
    p_date_to: input.dateTo,
    p_object_id: input.objectId,
    p_employee_id: input.employeeId,
    p_expense_category: input.expenseCategory,
  })).catch(() => { throw loadError(); });
  if (error || !Array.isArray(data) || data.length !== 1 || !data[0] || typeof data[0] !== "object") throw loadError();
  const row = data[0] as Record<string, unknown>;
  // Labor/expenses/hours/purchases retain their existing signed, finite values.
  const result: ReportOverviewPeriodTotals = {
    labor_cost: finiteNumber(row.labor_cost),
    other_expenses_cost: finiteNumber(row.other_expenses_cost),
    total_hours: finiteNumber(row.total_hours),
    purchased_cost: finiteNumber(row.purchased_cost),
    payments_received: finiteNumber(row.payments_received),
  };
  if (result.payments_received < 0) throw loadError();
  return result;
}
