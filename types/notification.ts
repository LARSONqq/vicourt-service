export type NotificationCategory =
  | "tasks"
  | "supervision"
  | "warehouse"
  | "purchases";

export type NotificationType =
  | "overdue_task"
  | "supervision_today"
  | "supervision_overdue"
  | "low_stock"
  | "planned_purchase";

export type NotificationSeverity =
  | "critical"
  | "warning"
  | "info";

export type NotificationTiming =
  | "overdue"
  | "today"
  | "current";

export interface NotificationItem {
  key: string;
  type: NotificationType;
  category: NotificationCategory;
  severity: NotificationSeverity;
  timing: NotificationTiming;
  title: string;
  message: string;
  detail: string | null;
  contextLabel: string | null;
  href: string;
  date: string | null;
  overdueDays: number | null;
  objectId?: number;
  taskId?: number;
  warehouseItemId?: number;
  purchaseId?: number;
}

export interface NotificationSummary {
  total: number;
  critical: number;
  today: number;
}

export interface NotificationCenterData {
  items: NotificationItem[];
  summary: NotificationSummary;
}
