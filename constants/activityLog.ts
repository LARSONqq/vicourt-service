import type {
  ActivityEntityType,
} from "@/types/activityLog";

export const activityEntityTypes: Array<{
  value: ActivityEntityType;
  label: string;
}> = [
  {
    value: "object",
    label: "Об’єкти",
  },
  {
    value: "task",
    label: "Завдання",
  },
  {
    value: "material",
    label: "Матеріали",
  },
  {
    value: "work_log",
    label: "Журнал робіт",
  },
  {
    value: "object_expense",
    label: "Витрати",
  },
  {
    value: "purchase",
    label: "Закупівлі",
  },
];

export function getActivityEntityTypeLabel(
  entityType: string
) {
  return (
    activityEntityTypes.find(
      (item) =>
        item.value ===
        entityType
    )?.label || entityType
  );
}
