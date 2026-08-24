export const objectExpenseCategories = [
  "Доставка",
  "Оренда техніки",
  "Паливо",
  "Послуги",
  "Інше",
] as const;

export type ObjectExpenseCategory =
  (typeof objectExpenseCategories)[number];