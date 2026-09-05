import type {
  ActivityLog,
} from "@/types/activityLog";
import type {
  EmployeeActivityPage,
} from "@/types/employeeProfile";

const EMPLOYEE_RATE_METADATA_KEYS =
  new Set([
    "hourly_rate",
    "previous_hourly_rate",
    "new_hourly_rate",
  ]);

export function hideEmployeeRatesFromActivityLog(
  log: ActivityLog
): ActivityLog {
  const metadata = Object.fromEntries(
    Object.entries(
      log.metadata || {}
    ).filter(
      ([key]) =>
        !EMPLOYEE_RATE_METADATA_KEYS.has(
          key
        )
    )
  );

  return {
    ...log,
    metadata,
  };
}

export function prepareEmployeeActivityPage(
  page: EmployeeActivityPage,
  canViewHourlyRate: boolean
): EmployeeActivityPage {
  if (canViewHourlyRate) {
    return page;
  }

  return {
    ...page,
    items: page.items.map(
      hideEmployeeRatesFromActivityLog
    ),
  };
}
