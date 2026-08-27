export const objectPaymentMethods = [
  "Готівка",
  "Банківський переказ",
  "Картка",
  "Інше",
] as const;

export const objectPaymentStatusLabels = {
  price_missing: "Ціна не задана",
  unpaid: "Не оплачено",
  partially_paid:
    "Частково оплачено",
  paid: "Оплачено",
  overpaid: "Переплата",
} as const;
