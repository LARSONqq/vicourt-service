import type {
  ObjectPaymentScheduleStatus,
} from "@/types/objectPaymentSchedule";

export const objectPaymentScheduleStatusLabels: Record<
  ObjectPaymentScheduleStatus,
  string
> = {
  planned: "Заплановано",
  partially_paid:
    "Частково оплачено",
  due_today:
    "До сплати сьогодні",
  overdue: "Прострочено",
  paid: "Оплачено",
};

export const objectPaymentScheduleTitlePresets = [
  "Аванс",
  "Проміжний платіж",
  "Фінальний платіж",
] as const;
