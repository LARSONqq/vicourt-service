import "server-only";

import { canViewReports } from "@/lib/auth/permissions";
import { isValidDateValue } from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import { getAccountIdentity } from "@/services/accountIdentityService";
import { getCurrentUserProfile } from "@/services/profileService";
import type { ReportOverviewCurrentFinance } from "@/types/report";

const loadError = () => new Error("Не вдалося завантажити поточні фінансові показники. Спробуйте пізніше.");

function nonnegativeNumber(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") throw loadError();
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw loadError();
  return parsed;
}

export async function getReportOverviewCurrentFinance(
  objectId: number | null,
  businessDate: string
): Promise<ReportOverviewCurrentFinance> {
  if (await getAccountIdentity() !== "internal") throw new Error("Недостатньо прав для перегляду звітів.");
  const profile = await getCurrentUserProfile();
  if (!profile?.is_active || !canViewReports(profile.role)) throw new Error("Недостатньо прав для перегляду звітів.");
  if ((objectId !== null && (!Number.isSafeInteger(objectId) || objectId <= 0))
    || typeof businessDate !== "string" || !isValidDateValue(businessDate)) {
    throw new Error("Некоректні параметри фінансового звіту.");
  }

  const supabase = await createClient();
  const { data, error } = await Promise.resolve(supabase.rpc("get_report_overview_current_finance", {
    p_object_id: objectId,
    p_business_date: businessDate,
  })).catch(() => { throw loadError(); });
  if (error || !Array.isArray(data) || data.length !== 1 || !data[0] || typeof data[0] !== "object") throw loadError();
  const row = data[0] as Record<string, unknown>;
  const outstanding = nonnegativeNumber(row.outstanding_receivables);
  const missingPrice = nonnegativeNumber(row.objects_without_client_price);
  const overdue = nonnegativeNumber(row.overdue_schedule_amount);
  if (!Number.isSafeInteger(missingPrice)
    || !Number.isSafeInteger(Math.round(outstanding * 100))
    || !Number.isSafeInteger(Math.round(overdue * 100))) throw loadError();

  return {
    outstanding_receivables: outstanding,
    objects_without_client_price: missingPrice,
    overdue_schedule_amount: overdue,
  };
}
