export type NotificationCategory =
  | "tasks"
  | "supervision"
  | "warehouse"
  | "purchases"
  | "equipment"
  | "finance";

export type NotificationType =
  | "overdue_task"
  | "supervision_today"
  | "supervision_overdue"
  | "low_stock"
  | "equipment_maintenance_today"
  | "equipment_maintenance_overdue"
  | "equipment_maintenance_usage_due"
  | "client_payment_due_today"
  | "client_payment_overdue"
  | "planned_purchase";

export type AutomaticPushNotificationType =
  | "overdue_task"
  | "supervision_today"
  | "supervision_overdue"
  | "low_stock"
  | "equipment_maintenance_today"
  | "equipment_maintenance_overdue"
  | "equipment_maintenance_usage_due"
  | "client_payment_due_today"
  | "client_payment_overdue";

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
  amount?: number;
  objectId?: number;
  taskId?: number;
  warehouseItemId?: number;
  purchaseId?: number;
  equipmentId?: number;
  equipmentUsageType?: "hours" | "km";
  equipmentMaintenanceUsage?: number;
  equipmentMaintenanceDate?: string;
  paymentScheduleItemId?: number;
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
