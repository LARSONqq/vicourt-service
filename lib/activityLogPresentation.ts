import {
  OBJECT_DOCUMENT_ACCESS_LEVELS,
  OBJECT_DOCUMENT_CATEGORIES,
} from "@/constants/objectDocuments";
import {
  activityEventNames,
  activityEventRegistry,
  getActivityCategoryLabel,
  getActivityEntityTypeLabel,
  isActivityEventName,
  type ActivityEventName,
} from "@/constants/activityLog";
import {
  formatDateValue,
  formatKyivTimestamp,
} from "@/lib/kyivDate";

import type {
  ActivityDetail,
  ActivityLog,
  ActivityMetadata,
  ActivityMetadataValue,
  ActivityPresentation,
} from "@/types/activityLog";

type DetailFormat =
  | "text"
  | "date"
  | "money"
  | "number"
  | "days"
  | "documentCategory"
  | "documentAccess"
  | "boolean";

type ValueDetailDefinition = {
  kind: "value";
  label: string;
  key: string;
  format?: DetailFormat;
};

type ChangeDetailDefinition = {
  kind: "change";
  label: string;
  previousKey: string;
  newKey: string;
  format?: DetailFormat;
};

type DetailDefinition =
  | ValueDetailDefinition
  | ChangeDetailDefinition;

const detailRegistry: Partial<
  Record<
    ActivityEventName,
    readonly DetailDefinition[]
  >
> = {
  "object.created": [
    { kind: "value", label: "Статус", key: "status" },
    { kind: "value", label: "Плановий бюджет", key: "cost_budget", format: "money" },
    { kind: "value", label: "Ціна для клієнта", key: "client_price", format: "money" },
    { kind: "value", label: "Періодичність нагляду", key: "supervision_interval_days", format: "days" },
    { kind: "value", label: "Наступний огляд", key: "next_supervision_date", format: "date" },
  ],
  "object.updated": [
    { kind: "change", label: "Плановий бюджет", previousKey: "previous_cost_budget", newKey: "new_cost_budget", format: "money" },
    { kind: "change", label: "Ціна для клієнта", previousKey: "previous_client_price", newKey: "new_client_price", format: "money" },
    { kind: "change", label: "Періодичність нагляду", previousKey: "previous_supervision_interval_days", newKey: "new_supervision_interval_days", format: "days" },
    { kind: "change", label: "Наступний огляд", previousKey: "previous_next_supervision_date", newKey: "new_next_supervision_date", format: "date" },
  ],
  "object.status_changed": [
    { kind: "change", label: "Статус", previousKey: "previous_status", newKey: "new_status" },
    { kind: "change", label: "Плановий бюджет", previousKey: "previous_cost_budget", newKey: "new_cost_budget", format: "money" },
    { kind: "change", label: "Ціна для клієнта", previousKey: "previous_client_price", newKey: "new_client_price", format: "money" },
    { kind: "change", label: "Періодичність нагляду", previousKey: "previous_supervision_interval_days", newKey: "new_supervision_interval_days", format: "days" },
    { kind: "change", label: "Наступний огляд", previousKey: "previous_next_supervision_date", newKey: "new_next_supervision_date", format: "date" },
  ],
  "object.deleted": [
    { kind: "value", label: "Останній статус", key: "status" },
    { kind: "value", label: "Видалено документів", key: "documents_removed", format: "number" },
  ],
  "object.supervision_completed": [
    { kind: "change", label: "Останній огляд", previousKey: "previous_last_supervision_date", newKey: "new_last_supervision_date", format: "date" },
    { kind: "change", label: "Наступний огляд", previousKey: "previous_next_supervision_date", newKey: "new_next_supervision_date", format: "date" },
    { kind: "value", label: "Періодичність", key: "interval_days", format: "days" },
  ],
  "object.supervision_rescheduled": [
    { kind: "change", label: "Дата огляду", previousKey: "previous_next_supervision_date", newKey: "new_next_supervision_date", format: "date" },
  ],
  "task.created": [
    { kind: "value", label: "Статус", key: "status" },
    { kind: "value", label: "Пріоритет", key: "priority" },
    { kind: "value", label: "Дата виконання", key: "due_date", format: "date" },
  ],
  "task.updated": [
    { kind: "change", label: "Статус", previousKey: "previous_status", newKey: "new_status" },
    { kind: "change", label: "Дата виконання", previousKey: "previous_due_date", newKey: "new_due_date", format: "date" },
    { kind: "value", label: "Пріоритет", key: "priority" },
  ],
  "task.status_changed": [
    { kind: "change", label: "Статус", previousKey: "previous_status", newKey: "new_status" },
  ],
  "task.completed": [
    { kind: "change", label: "Статус", previousKey: "previous_status", newKey: "new_status" },
    { kind: "change", label: "Дата виконання", previousKey: "previous_due_date", newKey: "new_due_date", format: "date" },
  ],
  "task.rescheduled": [
    { kind: "change", label: "Дата виконання", previousKey: "previous_due_date", newKey: "new_due_date", format: "date" },
  ],
  "task.deleted": [
    { kind: "value", label: "Статус", key: "status" },
    { kind: "value", label: "Дата виконання", key: "due_date", format: "date" },
    { kind: "value", label: "Пріоритет", key: "priority" },
  ],
  "material.added_from_warehouse": [
    { kind: "value", label: "Кількість", key: "quantity", format: "number" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "material.added": [
    { kind: "value", label: "Кількість", key: "quantity", format: "number" },
    { kind: "value", label: "Одиниця", key: "unit" },
    { kind: "value", label: "Ціна", key: "price", format: "money" },
  ],
  "material.quantity_changed": [
    { kind: "change", label: "Кількість", previousKey: "previous_quantity", newKey: "new_quantity", format: "number" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "material.updated": [
    { kind: "change", label: "Кількість", previousKey: "previous_quantity", newKey: "new_quantity", format: "number" },
    { kind: "change", label: "Ціна", previousKey: "previous_price", newKey: "new_price", format: "money" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "material.deleted_stock_restored": [
    { kind: "value", label: "Повернено на склад", key: "restored_to_warehouse", format: "boolean" },
    { kind: "value", label: "Кількість", key: "quantity", format: "number" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "material.deleted": [
    { kind: "value", label: "Кількість", key: "quantity", format: "number" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "material.returned_to_warehouse": [
    { kind: "value", label: "Повернено", key: "quantity", format: "number" },
    { kind: "value", label: "Одиниця", key: "unit" },
    { kind: "change", label: "Залишок на об’єкті", previousKey: "previous_quantity", newKey: "new_quantity", format: "number" },
  ],
  "work_log.created": [
    { kind: "value", label: "Дата робіт", key: "work_date", format: "date" },
    { kind: "value", label: "Години", key: "hours", format: "number" },
    { kind: "value", label: "Працівники", key: "workers", format: "number" },
    { kind: "value", label: "Вкладення", key: "attachment_name" },
  ],
  "work_log.updated": [
    { kind: "change", label: "Дата робіт", previousKey: "previous_work_date", newKey: "new_work_date", format: "date" },
    { kind: "change", label: "Години", previousKey: "previous_hours", newKey: "new_hours", format: "number" },
    { kind: "change", label: "Вкладення", previousKey: "previous_attachment_name", newKey: "new_attachment_name" },
  ],
  "work_log.deleted": [
    { kind: "value", label: "Дата робіт", key: "work_date", format: "date" },
    { kind: "value", label: "Години", key: "hours", format: "number" },
    { kind: "value", label: "Працівники", key: "workers", format: "number" },
    { kind: "value", label: "Вкладення", key: "attachment_name" },
  ],
  "object_expense.created": [
    { kind: "value", label: "Дата", key: "expense_date", format: "date" },
    { kind: "value", label: "Категорія", key: "category" },
    { kind: "value", label: "Сума", key: "amount", format: "money" },
  ],
  "object_expense.updated": [
    { kind: "value", label: "Дата", key: "expense_date", format: "date" },
    { kind: "value", label: "Категорія", key: "category" },
    { kind: "value", label: "Сума", key: "amount", format: "money" },
  ],
  "object_expense.deleted": [
    { kind: "value", label: "Дата", key: "expense_date", format: "date" },
    { kind: "value", label: "Категорія", key: "category" },
    { kind: "value", label: "Сума", key: "amount", format: "money" },
  ],
  "object.payment.created": [
    { kind: "value", label: "Сума", key: "amount", format: "money" },
    { kind: "value", label: "Дата оплати", key: "payment_date", format: "date" },
    { kind: "value", label: "Спосіб оплати", key: "payment_method" },
  ],
  "object.payment.updated": [
    { kind: "change", label: "Сума", previousKey: "old_amount", newKey: "new_amount", format: "money" },
    { kind: "change", label: "Дата оплати", previousKey: "old_payment_date", newKey: "new_payment_date", format: "date" },
    { kind: "change", label: "Спосіб оплати", previousKey: "old_payment_method", newKey: "new_payment_method" },
  ],
  "object.payment.deleted": [
    { kind: "value", label: "Сума", key: "amount", format: "money" },
    { kind: "value", label: "Дата оплати", key: "payment_date", format: "date" },
    { kind: "value", label: "Спосіб оплати", key: "payment_method" },
  ],
  "object.payment_schedule.created": [
    { kind: "value", label: "Назва етапу", key: "title" },
    { kind: "value", label: "Сума", key: "amount", format: "money" },
    { kind: "value", label: "Термін", key: "due_date", format: "date" },
  ],
  "object.payment_schedule.updated": [
    { kind: "change", label: "Назва етапу", previousKey: "old_title", newKey: "new_title" },
    { kind: "change", label: "Сума", previousKey: "old_amount", newKey: "new_amount", format: "money" },
    { kind: "change", label: "Термін", previousKey: "old_due_date", newKey: "new_due_date", format: "date" },
  ],
  "object.payment_schedule.deleted": [
    { kind: "value", label: "Назва етапу", key: "title" },
    { kind: "value", label: "Сума", key: "amount", format: "money" },
    { kind: "value", label: "Термін", key: "due_date", format: "date" },
  ],
  "object.document.created": [
    { kind: "value", label: "Категорія", key: "category", format: "documentCategory" },
    { kind: "value", label: "Доступ", key: "access_level", format: "documentAccess" },
    { kind: "value", label: "Файл", key: "original_file_name" },
  ],
  "object.document.updated": [
    { kind: "change", label: "Назва", previousKey: "previous_title", newKey: "new_title" },
    { kind: "change", label: "Категорія", previousKey: "previous_category", newKey: "new_category", format: "documentCategory" },
    { kind: "change", label: "Доступ", previousKey: "previous_access_level", newKey: "new_access_level", format: "documentAccess" },
    { kind: "value", label: "Файл", key: "original_file_name" },
  ],
  "object.document.deleted": [
    { kind: "value", label: "Категорія", key: "category", format: "documentCategory" },
    { kind: "value", label: "Доступ", key: "access_level", format: "documentAccess" },
    { kind: "value", label: "Файл", key: "original_file_name" },
  ],
  "purchase.planned": [
    { kind: "value", label: "Додано", key: "added_quantity", format: "number" },
    { kind: "value", label: "Заплановано разом", key: "planned_quantity", format: "number" },
    { kind: "value", label: "Ціна", key: "purchase_price", format: "money" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "purchase.updated": [
    { kind: "change", label: "Кількість", previousKey: "old_quantity", newKey: "new_quantity", format: "number" },
    { kind: "change", label: "Ціна", previousKey: "old_purchase_price", newKey: "new_purchase_price", format: "money" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "purchase.completed": [
    { kind: "value", label: "Кількість", key: "quantity", format: "number" },
    { kind: "value", label: "Ціна", key: "purchase_price", format: "money" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "purchase.deleted": [
    { kind: "value", label: "Кількість", key: "quantity", format: "number" },
    { kind: "value", label: "Ціна", key: "purchase_price", format: "money" },
    { kind: "value", label: "Одиниця", key: "unit" },
  ],
  "warehouse_item.created": [
    { kind: "value", label: "Мінімальний залишок", key: "min_quantity", format: "number" },
    { kind: "value", label: "Цільовий залишок", key: "target_quantity", format: "number" },
    { kind: "value", label: "Постачальник", key: "supplier" },
  ],
  "warehouse_item.updated": [
    { kind: "change", label: "Мінімальний залишок", previousKey: "old_min_quantity", newKey: "new_min_quantity", format: "number" },
    { kind: "change", label: "Цільовий залишок", previousKey: "old_target_quantity", newKey: "new_target_quantity", format: "number" },
    { kind: "change", label: "Постачальник", previousKey: "old_supplier", newKey: "new_supplier" },
  ],
  "warehouse_item.stock_adjusted": [
    { kind: "change", label: "Залишок", previousKey: "previous_quantity", newKey: "new_quantity", format: "number" },
    { kind: "value", label: "Кількість руху", key: "quantity", format: "number" },
    { kind: "value", label: "Облікова ціна", key: "unit_price", format: "money" },
    { kind: "value", label: "Причина", key: "reason" },
  ],
  "warehouse_item.deleted": [
    { kind: "value", label: "Мінімальний залишок", key: "min_quantity", format: "number" },
    { kind: "value", label: "Цільовий залишок", key: "target_quantity", format: "number" },
    { kind: "value", label: "Постачальник", key: "supplier" },
  ],
  "equipment.maintenance_schedule_updated": [
    { kind: "change", label: "Періодичність ТО", previousKey: "previous_maintenance_interval_days", newKey: "new_maintenance_interval_days", format: "days" },
    { kind: "change", label: "Наступне ТО", previousKey: "previous_next_service_date", newKey: "new_next_service_date", format: "date" },
    { kind: "change", label: "Тип напрацювання", previousKey: "previous_usage_type", newKey: "new_usage_type" },
    { kind: "change", label: "Інтервал за напрацюванням", previousKey: "previous_maintenance_interval_usage", newKey: "new_maintenance_interval_usage", format: "number" },
    { kind: "change", label: "Наступний поріг ТО", previousKey: "previous_next_maintenance_usage", newKey: "new_next_maintenance_usage", format: "number" },
  ],
  "equipment.maintenance_rescheduled": [
    { kind: "change", label: "Дата ТО", previousKey: "previous_next_service_date", newKey: "new_next_service_date", format: "date" },
  ],
  "equipment.maintenance_completed": [
    { kind: "change", label: "Останнє ТО", previousKey: "previous_last_maintenance_date", newKey: "new_last_maintenance_date", format: "date" },
    { kind: "change", label: "Наступне ТО", previousKey: "previous_next_service_date", newKey: "new_next_service_date", format: "date" },
    { kind: "value", label: "Періодичність", key: "maintenance_interval_days", format: "days" },
    { kind: "value", label: "Тип напрацювання", key: "usage_type" },
    { kind: "change", label: "Показник", previousKey: "previous_current_usage", newKey: "new_current_usage", format: "number" },
    { kind: "change", label: "Напрацювання останнього ТО", previousKey: "previous_last_maintenance_usage", newKey: "new_last_maintenance_usage", format: "number" },
    { kind: "change", label: "Наступний поріг ТО", previousKey: "previous_next_maintenance_usage", newKey: "new_next_maintenance_usage", format: "number" },
    { kind: "value", label: "Інтервал за напрацюванням", key: "maintenance_interval_usage", format: "number" },
  ],
  "equipment.usage_recorded": [
    { kind: "value", label: "Дата показника", key: "reading_date", format: "date" },
    { kind: "value", label: "Тип напрацювання", key: "usage_type" },
    { kind: "change", label: "Показник", previousKey: "previous_current_usage", newKey: "new_current_usage", format: "number" },
  ],
  "equipment.usage_corrected": [
    { kind: "value", label: "Дата корекції", key: "reading_date", format: "date" },
    { kind: "value", label: "Тип напрацювання", key: "usage_type" },
    { kind: "change", label: "Показник", previousKey: "previous_current_usage", newKey: "new_current_usage", format: "number" },
  ],
  "equipment.service_record_created": [
    { kind: "value", label: "Тип сервісу", key: "service_type" },
    { kind: "value", label: "Дата", key: "service_date", format: "date" },
    { kind: "value", label: "Вартість", key: "cost", format: "money" },
    { kind: "value", label: "Хто виконав", key: "performed_by" },
    { kind: "value", label: "Тип напрацювання", key: "usage_type" },
    { kind: "value", label: "Показник", key: "usage_reading", format: "number" },
  ],
  "equipment.service_record_voided": [
    { kind: "value", label: "Тип сервісу", key: "service_type" },
    { kind: "value", label: "Дата", key: "service_date", format: "date" },
    { kind: "value", label: "Вартість", key: "cost", format: "money" },
    { kind: "value", label: "Причина анулювання", key: "void_reason" },
  ],
};

const moneyFormatter = new Intl.NumberFormat(
  "uk-UA",
  {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2,
  }
);

const numberFormatter = new Intl.NumberFormat(
  "uk-UA",
  {
    maximumFractionDigits: 3,
  }
);

function hasMetadataKey(
  metadata: ActivityMetadata,
  key: string
) {
  return Object.prototype.hasOwnProperty.call(
    metadata,
    key
  );
}

function formatMetadataValue(
  value: ActivityMetadataValue | undefined,
  format: DetailFormat = "text"
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Не встановлено";
  }

  if (format === "date") {
    return typeof value === "string"
      ? formatDateValue(value) || value
      : String(value);
  }

  if (
    format === "money" ||
    format === "number" ||
    format === "days"
  ) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return "Не встановлено";
    }

    if (format === "money") {
      return moneyFormatter.format(numberValue);
    }

    if (format === "days") {
      return `${numberFormatter.format(numberValue)} дн.`;
    }

    return numberFormatter.format(numberValue);
  }

  if (format === "boolean") {
    return value === true ? "Так" : "Ні";
  }

  if (
    format === "documentCategory" &&
    typeof value === "string"
  ) {
    return (
      OBJECT_DOCUMENT_CATEGORIES.find(
        (item) => item.value === value
      )?.label || value
    );
  }

  if (
    format === "documentAccess" &&
    typeof value === "string"
  ) {
    return (
      OBJECT_DOCUMENT_ACCESS_LEVELS.find(
        (item) => item.value === value
      )?.label || value
    );
  }

  return String(value);
}

function buildDetails(
  log: ActivityLog,
  action: ActivityEventName
) {
  const details: ActivityDetail[] = [];
  const definitions = detailRegistry[action] || [];

  if (
    action === "object.updated" &&
    typeof log.metadata.previous_name === "string" &&
    log.entity_name &&
    log.metadata.previous_name !== log.entity_name
  ) {
    details.push({
      label: "Назва",
      previousValue:
        log.metadata.previous_name,
      newValue: log.entity_name,
    });
  }

  for (const definition of definitions) {
    if (definition.kind === "value") {
      if (!hasMetadataKey(log.metadata, definition.key)) {
        continue;
      }

      const value = log.metadata[definition.key];

      if (value === null || value === "") {
        continue;
      }

      details.push({
        label: definition.label,
        value: formatMetadataValue(
          value,
          definition.format
        ),
      });
      continue;
    }

    if (
      !hasMetadataKey(log.metadata, definition.previousKey) &&
      !hasMetadataKey(log.metadata, definition.newKey)
    ) {
      continue;
    }

    const previousValue = formatMetadataValue(
      log.metadata[definition.previousKey],
      definition.format
    );
    const newValue = formatMetadataValue(
      log.metadata[definition.newKey],
      definition.format
    );

    if (previousValue === newValue) {
      continue;
    }

    details.push({
      label: definition.label,
      previousValue,
      newValue,
    });
  }

  if (
    action.startsWith("task.") &&
    typeof log.metadata.target_name === "string" &&
    log.metadata.target_name.trim()
  ) {
    const targetLabel =
      log.metadata.target_type === "equipment"
        ? "Техніка"
        : "Об’єкт";

    details.push({
      label: "Ціль завдання",
      value: `${targetLabel}: ${log.metadata.target_name}`,
    });
  }

  return details;
}

function humanizeUnknownAction(
  action: string
) {
  const verbLabels: Record<string, string> = {
    created: "Створено",
    added: "Додано",
    updated: "Оновлено",
    changed: "Змінено",
    completed: "Виконано",
    deleted: "Видалено",
    rescheduled: "Перенесено",
  };
  const parts = action
    .split(/[._-]+/u)
    .filter(Boolean);
  const actionPart = parts.at(-1) || "подія";
  const subject = parts
    .slice(0, -1)
    .join(" ")
    .trim();
  const verb = verbLabels[actionPart];

  if (verb && subject) {
    return `${verb}: ${subject}`;
  }

  const normalized = parts.join(" ") || "Подія журналу";
  return normalized.charAt(0).toLocaleUpperCase("uk-UA") + normalized.slice(1);
}

function getActorName(log: ActivityLog) {
  const actorName = log.actor_name?.trim();

  if (actorName) {
    return actorName;
  }

  return log.actor_id === null
    ? "Система"
    : "Невідомий користувач";
}

function getSectionHref(log: ActivityLog) {
  if (log.action.startsWith("task.")) return "/task";
  if (log.action.startsWith("equipment.")) return "/equipment";
  if (log.action.startsWith("purchase.")) return "/purchases";
  if (log.action.startsWith("warehouse_item.")) return "/warehouse";
  if (log.action.startsWith("employee.")) return "/employees";
  return null;
}

function resolveLinks(
  log: ActivityLog,
  existingObjectIds: ReadonlySet<number>
) {
  const objectId =
    Number.isInteger(log.object_id) &&
    Number(log.object_id) > 0
      ? Number(log.object_id)
      : null;
  const objectExists =
    objectId !== null &&
    existingObjectIds.has(objectId);
  const objectName = log.object_name?.trim();
  const objectHref = objectExists
    ? `/objects/${objectId}`
    : null;
  const entityName =
    log.entity_name?.trim() ||
    (log.entity_type === "object" ? objectName : null) ||
    getActivityEntityTypeLabel(log.entity_type);
  const entityLabel =
    log.action.startsWith(
      "warehouse_item."
    )
      ? "Позиція складу"
      : getActivityEntityTypeLabel(
          log.entity_type
        );
  let entityHref: string | null = null;
  const entityWasDeleted =
    log.action.endsWith(
      ".deleted"
    );

  if (
    objectHref &&
    !entityWasDeleted
  ) {
    if (log.entity_type === "object_payment_schedule") {
      entityHref = `${objectHref}#payment-schedule`;
    } else if (
      log.entity_type === "object" ||
      log.entity_type === "material" ||
      log.entity_type === "work_log" ||
      log.entity_type === "object_expense" ||
      log.entity_type === "object_payment" ||
      log.entity_type === "object_document"
    ) {
      entityHref = objectHref;
    }
  }

  return {
    entity: {
      label: entityLabel,
      name: entityName,
      href: entityHref,
    },
    object:
      objectName && log.entity_type !== "object"
        ? {
            label: "Об’єкт",
            name: objectName,
            href: objectHref,
          }
        : null,
  };
}

export function formatActivityTimestamp(
  value: string
) {
  return (
    formatKyivTimestamp(value) ||
    "Дата невідома"
  );
}

export function getActivityPresentation(
  log: ActivityLog,
  existingObjectIds: ReadonlySet<number>
): ActivityPresentation {
  const knownAction =
    isActivityEventName(log.action)
      ? log.action
      : null;
  const definition = knownAction
    ? activityEventRegistry[knownAction]
    : null;
  const category = definition?.category || "other";
  const links = resolveLinks(log, existingObjectIds);

  return {
    label: definition?.label || humanizeUnknownAction(log.action),
    category,
    categoryLabel: getActivityCategoryLabel(category),
    icon: definition?.icon || "🕘",
    actorName: getActorName(log),
    description:
      log.description?.trim() ||
      definition?.label ||
      "Подія журналу активності",
    details: knownAction
      ? buildDetails(log, knownAction)
      : [],
    entity: links.entity,
    object: links.object,
    sectionHref: getSectionHref(log),
    isKnownEvent:
      knownAction !== null,
  };
}

export const knownActivityEventNames: readonly string[] =
  activityEventNames;
