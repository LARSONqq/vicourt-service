import "server-only";

import { createClient } from "@/lib/supabase/server";

type EquipmentMaintenanceSummaryRow = {
  overdue_count: number;
  due_now_count: number;
  upcoming_7_count: number;
  usage_due_count: number;
  attention_count: number;
};

function toCount(value: number) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0
    ? count
    : 0;
}

export async function getEquipmentMaintenanceSummary(
  businessDate: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc(
      "get_equipment_maintenance_summary",
      { p_business_date: businessDate }
    )
    .overrideTypes<EquipmentMaintenanceSummaryRow[], { merge: false }>();

  const row = Array.isArray(data)
    ? data[0]
    : null;

  if (error || !row) {
    throw new Error("Не вдалося завантажити підсумок планового ТО.");
  }

  return {
    overdue: toCount(row.overdue_count),
    dueNow: toCount(row.due_now_count),
    upcoming: toCount(row.upcoming_7_count),
    usageDue: toCount(row.usage_due_count),
    attention: toCount(row.attention_count),
  };
}
