"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/lib/supabase/server";
import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  resolvePushNotificationPreferences,
} from "@/services/pushNotificationPreferenceService";

import type {
  PushNotificationPreferenceActionResult,
  PushNotificationPreferenceRow,
} from "@/types/pushNotificationPreference";

const TIME_PATTERN =
  /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function getBooleanValue(
  input: Record<string, unknown>,
  field: string
) {
  const value = input[field];

  if (typeof value !== "boolean") {
    throw new Error(
      "Отримано некоректні налаштування автоматичних сповіщень."
    );
  }

  return value;
}

function getTimeValue(
  input: Record<string, unknown>,
  field: string
) {
  const value = input[field];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string" ||
    !TIME_PATTERN.test(value)
  ) {
    throw new Error(
      "Вкажіть коректний час у форматі години та хвилини."
    );
  }

  return value;
}

export async function savePushNotificationPreferences(
  input: unknown
): Promise<PushNotificationPreferenceActionResult> {
  try {
    const profile =
      await getCurrentUserProfile();

    if (!profile) {
      throw new Error(
        "Для зміни налаштувань потрібно увійти в систему."
      );
    }

    if (!isRecord(input)) {
      throw new Error(
        "Отримано некоректні налаштування автоматичних сповіщень."
      );
    }

    const overdueTasksEnabled =
      getBooleanValue(
        input,
        "overdue_tasks_enabled"
      );
    const supervisionEnabled =
      getBooleanValue(
        input,
        "supervision_enabled"
      );
    const lowStockEnabled =
      getBooleanValue(
        input,
        "low_stock_enabled"
      );
    const equipmentMaintenanceEnabled =
      getBooleanValue(
        input,
        "equipment_maintenance_enabled"
      );
    const quietHoursEnabled =
      getBooleanValue(
        input,
        "quiet_hours_enabled"
      );
    const quietStart =
      quietHoursEnabled
        ? getTimeValue(
            input,
            "quiet_start"
          )
        : null;
    const quietEnd =
      quietHoursEnabled
        ? getTimeValue(
            input,
            "quiet_end"
          )
        : null;

    if (
      quietHoursEnabled &&
      (!quietStart || !quietEnd)
    ) {
      throw new Error(
        "Вкажіть початок і кінець тихих годин."
      );
    }

    if (
      quietHoursEnabled &&
      quietStart === quietEnd
    ) {
      throw new Error(
        "Початок і кінець тихих годин мають відрізнятися."
      );
    }

    const supabase =
      await createClient();
    const {
      data,
      error,
    } = await supabase
      .from(
        "push_notification_preferences"
      )
      .upsert(
        {
          user_id: profile.id,
          overdue_tasks_enabled:
            overdueTasksEnabled,
          supervision_enabled:
            supervisionEnabled,
          low_stock_enabled:
            lowStockEnabled,
          equipment_maintenance_enabled:
            equipmentMaintenanceEnabled,
          quiet_hours_enabled:
            quietHoursEnabled,
          quiet_start:
            quietStart,
          quiet_end:
            quietEnd,
        },
        {
          onConflict:
            "user_id",
        }
      )
      .select(`
        user_id,
        overdue_tasks_enabled,
        supervision_enabled,
        low_stock_enabled,
        equipment_maintenance_enabled,
        quiet_hours_enabled,
        quiet_start,
        quiet_end,
        created_at,
        updated_at
      `)
      .single()
      .overrideTypes<
        PushNotificationPreferenceRow
      >();

    if (error || !data) {
      console.error(
        "Не вдалося зберегти push preferences поточного користувача.",
        error?.code ??
          "unknown"
      );

      return {
        success: false,
        message:
          "Не вдалося зберегти налаштування автоматичних сповіщень.",
      };
    }

    revalidatePath(
      "/notifications"
    );

    return {
      success: true,
      message:
        "Налаштування автоматичних сповіщень збережено.",
      preferences:
        resolvePushNotificationPreferences(
          data
        ),
    };
  } catch (error) {
    console.error(
      "Помилка збереження push preferences.",
      error instanceof Error
        ? error.message
        : "unknown"
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Не вдалося зберегти налаштування автоматичних сповіщень.",
    };
  }
}
