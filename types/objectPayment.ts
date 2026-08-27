export interface ObjectPayment {
  id: number;
  object_id: number;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type ObjectPaymentStatus =
  | "price_missing"
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "overpaid";

export type ObjectPaymentSummary = {
  clientPrice: number | null;
  totalPaid: number;
  remainingToPay: number | null;
  overpayment: number | null;
  status: ObjectPaymentStatus;
  progressPercent: number | null;
};
