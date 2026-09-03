import type {
  ActivityCategory,
  ActivityEntityType,
} from "@/types/activityLog";

type ActivityEventDefinition = {
  label: string;
  category: ActivityCategory;
  icon: string;
};

export const activityCategories: ReadonlyArray<{
  value: ActivityCategory;
  label: string;
}> = [
  { value: "objects", label: "Об’єкти" },
  { value: "tasks", label: "Завдання" },
  { value: "warehouse", label: "Склад" },
  { value: "purchases", label: "Закупівлі" },
  { value: "finance", label: "Фінанси" },
  { value: "equipment", label: "Техніка" },
  { value: "supervision", label: "Огляди" },
  { value: "documents", label: "Документи" },
  { value: "employees", label: "Працівники" },
  { value: "other", label: "Інше" },
];

// Єдиний registry для labels, категорій та іконок фактичних business events.
export const activityEventRegistry = {
  "object.created": { label: "Створено об’єкт", category: "objects", icon: "🏡" },
  "object.updated": { label: "Оновлено об’єкт", category: "objects", icon: "✏️" },
  "object.status_changed": { label: "Змінено статус об’єкта", category: "objects", icon: "🔄" },
  "object.deleted": { label: "Видалено об’єкт", category: "objects", icon: "🗑️" },
  "object.supervision_completed": { label: "Виконано періодичний огляд", category: "supervision", icon: "👁️" },
  "object.supervision_rescheduled": { label: "Перенесено періодичний огляд", category: "supervision", icon: "📅" },
  "task.created": { label: "Створено завдання", category: "tasks", icon: "✅" },
  "task.updated": { label: "Оновлено завдання", category: "tasks", icon: "✏️" },
  "task.status_changed": { label: "Змінено статус завдання", category: "tasks", icon: "🔄" },
  "task.completed": { label: "Виконано завдання", category: "tasks", icon: "✓" },
  "task.rescheduled": { label: "Перенесено завдання", category: "tasks", icon: "📅" },
  "task.deleted": { label: "Видалено завдання", category: "tasks", icon: "🗑️" },
  "material.added_from_warehouse": { label: "Списано матеріал зі складу", category: "warehouse", icon: "📦" },
  "material.added": { label: "Додано матеріал до об’єкта", category: "warehouse", icon: "📦" },
  "material.quantity_changed": { label: "Змінено кількість матеріалу", category: "warehouse", icon: "⚖️" },
  "material.updated": { label: "Оновлено матеріал", category: "warehouse", icon: "✏️" },
  "material.deleted_stock_restored": { label: "Видалено матеріал і повернено залишок", category: "warehouse", icon: "↩️" },
  "material.deleted": { label: "Видалено матеріал", category: "warehouse", icon: "🗑️" },
  "work_log.created": { label: "Додано запис про роботи", category: "objects", icon: "📝" },
  "work_log.updated": { label: "Оновлено запис про роботи", category: "objects", icon: "✏️" },
  "work_log.deleted": { label: "Видалено запис про роботи", category: "objects", icon: "🗑️" },
  "object_expense.created": { label: "Додано витрату об’єкта", category: "finance", icon: "💸" },
  "object_expense.updated": { label: "Оновлено витрату об’єкта", category: "finance", icon: "✏️" },
  "object_expense.deleted": { label: "Видалено витрату об’єкта", category: "finance", icon: "🗑️" },
  "object.payment.created": { label: "Додано оплату клієнта", category: "finance", icon: "💳" },
  "object.payment.updated": { label: "Оновлено оплату клієнта", category: "finance", icon: "✏️" },
  "object.payment.deleted": { label: "Видалено оплату клієнта", category: "finance", icon: "🗑️" },
  "object.payment_schedule.created": { label: "Додано етап графіка оплат", category: "finance", icon: "🗓️" },
  "object.payment_schedule.updated": { label: "Оновлено етап графіка оплат", category: "finance", icon: "✏️" },
  "object.payment_schedule.deleted": { label: "Видалено етап графіка оплат", category: "finance", icon: "🗑️" },
  "object.document.created": { label: "Додано документ", category: "documents", icon: "📄" },
  "object.document.updated": { label: "Оновлено документ", category: "documents", icon: "✏️" },
  "object.document.deleted": { label: "Видалено документ", category: "documents", icon: "🗑️" },
  "purchase.planned": { label: "Заплановано закупівлю", category: "purchases", icon: "🛒" },
  "purchase.updated": { label: "Оновлено закупівлю", category: "purchases", icon: "✏️" },
  "purchase.completed": { label: "Оприбутковано закупівлю", category: "purchases", icon: "📥" },
  "purchase.deleted": { label: "Видалено закупівлю", category: "purchases", icon: "🗑️" },
  "warehouse_item.created": { label: "Створено позицію складу", category: "warehouse", icon: "📦" },
  "warehouse_item.updated": { label: "Оновлено позицію складу", category: "warehouse", icon: "✏️" },
  "warehouse_item.deleted": { label: "Видалено позицію складу", category: "warehouse", icon: "🗑️" },
  "equipment.maintenance_schedule_updated": { label: "Оновлено графік планового ТО", category: "equipment", icon: "🛠️" },
  "equipment.maintenance_rescheduled": { label: "Перенесено планове ТО", category: "equipment", icon: "📅" },
  "equipment.maintenance_completed": { label: "Виконано планове ТО", category: "equipment", icon: "🔧" },
} satisfies Record<string, ActivityEventDefinition>;

export type ActivityEventName = keyof typeof activityEventRegistry;

export const activityEventNames = Object.keys(
  activityEventRegistry
) as ActivityEventName[];

export const activityEventOptions = activityEventNames.map(
  (value) => ({
    value,
    label: activityEventRegistry[value].label,
  })
);

export const activityEntityTypes: ReadonlyArray<{
  value: ActivityEntityType;
  label: string;
}> = [
  { value: "object", label: "Об’єкт" },
  { value: "task", label: "Завдання" },
  { value: "material", label: "Матеріал" },
  { value: "work_log", label: "Запис про роботи" },
  { value: "object_expense", label: "Витрата" },
  { value: "object_payment", label: "Оплата клієнта" },
  { value: "object_payment_schedule", label: "Етап графіка оплат" },
  { value: "object_document", label: "Документ" },
  { value: "purchase", label: "Закупівля" },
  { value: "equipment", label: "Техніка" },
  { value: "employee", label: "Працівник" },
];

export function isActivityCategory(
  value: string
): value is ActivityCategory {
  return activityCategories.some(
    (category) => category.value === value
  );
}

export function isActivityEventName(
  value: string
): value is ActivityEventName {
  return value in activityEventRegistry;
}

export function getActivityCategoryLabel(
  category: ActivityCategory
) {
  return (
    activityCategories.find(
      (item) => item.value === category
    )?.label || "Інше"
  );
}

export function getActivityActionsForCategory(
  category: ActivityCategory
) {
  if (category === "other") {
    return [];
  }

  return activityEventNames.filter(
    (action) =>
      activityEventRegistry[action].category === category
  );
}

export function getActivityEntityTypeLabel(
  entityType: string
) {
  return (
    activityEntityTypes.find(
      (item) => item.value === entityType
    )?.label || "Запис"
  );
}

export function getActivityEventsMatchingLabel(
  search: string
) {
  const normalizedSearch = search
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .trim();

  if (!normalizedSearch) {
    return [];
  }

  return activityEventNames.filter(
    (action) =>
      activityEventRegistry[action].label
        .toLocaleLowerCase("uk-UA")
        .includes(normalizedSearch)
  );
}
