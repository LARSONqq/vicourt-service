export interface ObjectPaymentScheduleItem {
  id: number;
  object_id: number;
  title: string;
  due_date: string;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type ObjectPaymentScheduleStatus =
  | "planned"
  | "partially_paid"
  | "due_today"
  | "overdue"
  | "paid";

export type AllocatedObjectPaymentScheduleItem<
  T extends ObjectPaymentScheduleItem = ObjectPaymentScheduleItem,
> = T & {
  paidAmount: number;
  remainingAmount: number;
  overdueAmount: number;
  status: ObjectPaymentScheduleStatus;
};

export type ObjectPaymentScheduleSummary<
  T extends ObjectPaymentScheduleItem = ObjectPaymentScheduleItem,
> = {
  items: Array<AllocatedObjectPaymentScheduleItem<T>>;
  scheduledTotal: number;
  totalPaid: number;
  remainingScheduled: number;
  remainingToReceive: number;
  cumulativeDue: number;
  overdueAmount: number;
  unscheduledAmount: number | null;
  scheduleOverage: number | null;
  nextPayment: AllocatedObjectPaymentScheduleItem<T> | null;
};

export type ObjectPaymentScheduleWithObject =
  ObjectPaymentScheduleItem & {
    object: {
      id: number;
      name: string;
    } | null;
  };
