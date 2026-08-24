import type {
  ObjectExpenseCategory,
} from "@/constants/objectExpenses";

export interface ObjectExpense {
  id: number;

  object_id: number;

  expense_date: string;

  category: ObjectExpenseCategory;

  description: string;

  amount: number;

  note: string | null;

  created_by:
    | string
    | null;

  created_by_name:
    | string
    | null;

  created_at: string;

  updated_at: string;
}