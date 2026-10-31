import type { AppCurrency } from "@/types/appSettings";

type ObjectWatchlistBase = {
  objectId: number;
  name: string;
  status: string;
  responsibleEmployeeName: string | null;
  overdueTaskCount: number;
  supervisionOverdue: boolean;
  href: string;
};

export type WorkerObjectWatchlistItem = ObjectWatchlistBase;

export type ManagementObjectWatchlistItem = ObjectWatchlistBase & {
  hasOverduePayment: boolean;
  overduePaymentAmount: number;
  missingClientPrice: boolean;
};

export type WorkerObjectWatchlistData = {
  kind: "worker";
  items: WorkerObjectWatchlistItem[];
};

export type ManagementObjectWatchlistData = {
  kind: "management";
  currency: AppCurrency;
  items: ManagementObjectWatchlistItem[];
};

export type DashboardObjectWatchlistData =
  | WorkerObjectWatchlistData
  | ManagementObjectWatchlistData;
