import "server-only";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  AutomaticPushNotificationType,
} from "@/types/notification";
import {
  DEFAULT_PUSH_NOTIFICATION_PREFERENCES,
  type PushNotificationPreferenceRow,
  type PushNotificationPreferences,
} from "@/types/pushNotificationPreference";

function normalizeTimeValue(
  value: string | null | undefined
) {
  return value
    ? value.slice(0, 5)
    : null;
}

export function resolvePushNotificationPreferences(
  row:
    | PushNotificationPreferenceRow
    | null
    | undefined
): PushNotificationPreferences {
  if (!row) {
    return {
      ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES,
    };
  }

  return {
    overdue_tasks_enabled:
      row.overdue_tasks_enabled,
    supervision_enabled:
      row.supervision_enabled,
    low_stock_enabled:
      row.low_stock_enabled,
    equipment_maintenance_enabled:
      row.equipment_maintenance_enabled,
    client_payments_enabled:
      row.client_payments_enabled,
    quiet_hours_enabled:
      row.quiet_hours_enabled,
    quiet_start:
      normalizeTimeValue(
        row.quiet_start
      ),
    quiet_end:
      normalizeTimeValue(
        row.quiet_end
      ),
  };
}

export function isAutomaticPushCategoryEnabled(
  preferences: PushNotificationPreferences,
  type: AutomaticPushNotificationType
) {
  switch (type) {
    case "overdue_task":
      return preferences.overdue_tasks_enabled;

    case "supervision_today":
    case "supervision_overdue":
      return preferences.supervision_enabled;

    case "low_stock":
      return preferences.low_stock_enabled;

    case "equipment_maintenance_today":
    case "equipment_maintenance_overdue":
      return preferences.equipment_maintenance_enabled;

    case "client_payment_due_today":
    case "client_payment_overdue":
      return preferences.client_payments_enabled;
  }
}

export function isWithinQuietHours(
  preferences: PushNotificationPreferences,
  kyivTime: string
) {
  const {
    quiet_hours_enabled,
    quiet_start,
    quiet_end,
  } = preferences;

  if (
    !quiet_hours_enabled ||
    !quiet_start ||
    !quiet_end ||
    quiet_start === quiet_end
  ) {
    return false;
  }

  if (quiet_start < quiet_end) {
    return (
      kyivTime >= quiet_start &&
      kyivTime < quiet_end
    );
  }

  return (
    kyivTime >= quiet_start ||
    kyivTime < quiet_end
  );
}

export async function getPushNotificationPreferences(
  userId: string
) {
  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from(
      "push_notification_preferences"
    )
    .select(`
      user_id,
      overdue_tasks_enabled,
      supervision_enabled,
      low_stock_enabled,
      equipment_maintenance_enabled,
      client_payments_enabled,
      quiet_hours_enabled,
      quiet_start,
      quiet_end,
      created_at,
      updated_at
    `)
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<
      PushNotificationPreferenceRow | null
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити налаштування автоматичних сповіщень: ${error.message}`
    );
  }

  return resolvePushNotificationPreferences(
    data
  );
}
