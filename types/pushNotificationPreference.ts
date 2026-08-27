export interface PushNotificationPreferenceRow {
  user_id: string;
  overdue_tasks_enabled: boolean;
  supervision_enabled: boolean;
  low_stock_enabled: boolean;
  equipment_maintenance_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  created_at: string;
  updated_at: string;
}

export type PushNotificationPreferences = Pick<
  PushNotificationPreferenceRow,
  | "overdue_tasks_enabled"
  | "supervision_enabled"
  | "low_stock_enabled"
  | "equipment_maintenance_enabled"
  | "quiet_hours_enabled"
  | "quiet_start"
  | "quiet_end"
>;

export const DEFAULT_PUSH_NOTIFICATION_PREFERENCES: PushNotificationPreferences = {
  overdue_tasks_enabled: true,
  supervision_enabled: true,
  low_stock_enabled: true,
  equipment_maintenance_enabled: true,
  quiet_hours_enabled: false,
  quiet_start: null,
  quiet_end: null,
};

export type PushNotificationPreferenceActionResult =
  | {
      success: true;
      message: string;
      preferences: PushNotificationPreferences;
    }
  | {
      success: false;
      message: string;
    };
