import type { AppCurrency } from "@/types/appSettings";

export type DashboardAttentionSeverity = "critical" | "warning" | "info";
export type DashboardAttentionTiming = "overdue" | "today" | "current" | "upcoming";

type DashboardAttentionBase = {
  id: string;
  severity: DashboardAttentionSeverity;
  timing: DashboardAttentionTiming;
  title: string;
  description: string;
  entityId: number;
  objectId: number | null;
  relevantDate: string | null;
  href: string;
};

export type DashboardOperationalAttentionKind =
  | "task_overdue"
  | "task_today"
  | "supervision_overdue"
  | "supervision_today"
  | "warehouse_out"
  | "warehouse_low"
  | "equipment_overdue"
  | "equipment_today"
  | "equipment_today_usage_due"
  | "equipment_usage_due"
  | "equipment_upcoming";

export type DashboardOperationalAttentionItem = DashboardAttentionBase & {
  source: "operational";
  kind: DashboardOperationalAttentionKind;
  entityType: "task" | "object" | "warehouse_item" | "equipment";
};

export type DashboardFinanceAttentionItem = DashboardAttentionBase & {
  source: "finance";
  kind: "payment_overdue" | "payment_today";
  entityType: "payment_schedule";
  objectId: number;
  amount: number;
};

export type DashboardAttentionItem =
  | DashboardOperationalAttentionItem
  | DashboardFinanceAttentionItem;

export type WorkerDashboardAttentionData = {
  kind: "worker";
  items: DashboardOperationalAttentionItem[];
  partialFailure: false;
};

export type ManagementDashboardAttentionData = {
  kind: "management";
  currency: AppCurrency;
  items: DashboardAttentionItem[];
  partialFailure: boolean;
};

export type DashboardAttentionData =
  | WorkerDashboardAttentionData
  | ManagementDashboardAttentionData;
