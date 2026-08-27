import {
  sanitizeSpreadsheetText,
} from "@/lib/exportSecurity";

const columnLabels: Record<
  string,
  string
> = {
  id: "ID",
  name: "Назва",
  firstName: "Ім’я",
  lastName: "Прізвище",
  customer: "Замовник",
  phone: "Телефон",
  email: "Email",
  address: "Адреса",
  status: "Статус",
  manager: "Відповідальний",
  responsibleEmployeeId:
    "ID відповідального працівника",
  createdAt: "Дата створення",
  material: "Матеріал",
  category: "Категорія",
  stockQuantity: "Залишок",
  quantity: "Кількість",
  unit: "Одиниця виміру",
  minimumQuantity:
    "Мінімальний залишок",
  averagePrice:
    "Поточна середньозважена ціна",
  stockValue:
    "Поточна вартість залишку",
  supplier: "Постачальник",
  inventoryNumber:
    "Інвентарний номер",
  responsible: "Відповідальний",
  location: "Локація",
  purchaseDate:
    "Дата придбання",
  maintenanceIntervalDays:
    "Періодичність ТО, днів",
  lastMaintenanceDate:
    "Останнє планове ТО",
  nextMaintenanceDate:
    "Наступне ТО",
  nextServiceDate:
    "Наступне обслуговування",
  notes: "Примітки",
  equipment: "Техніка",
  serviceType:
    "Тип обслуговування",
  serviceDate:
    "Дата обслуговування",
  cost: "Вартість",
  performedBy: "Виконав",
  description: "Опис",
  position: "Посада",
  employmentType:
    "Тип роботи",
  hireDate:
    "Дата прийняття",
  hourlyRate:
    "Погодинна ставка",
  objectId: "ID об’єкта",
  objectName: "Об’єкт",
  materialsCost:
    "Витрати на матеріали",
  laborCost:
    "Витрати на роботи",
  otherExpensesCost:
    "Інші витрати",
  totalCost:
    "Загальні витрати",
  periodActualCost:
    "Витрати за вибраний період",
  actualCost:
    "Фактичні витрати за весь час",
  costBudget:
    "Плановий бюджет",
  clientPrice:
    "Вартість для клієнта",
  budgetRemaining:
    "Залишок бюджету",
  budgetOverrun:
    "Перевитрата",
  financialResult:
    "Поточний прибуток",
  marginPercent:
    "Маржинальність, %",
  hours: "Години",
  employeeId:
    "ID працівника",
  employeeName: "Працівник",
  recordsCount:
    "Кількість записів",
  objectsCount:
    "Кількість об’єктів",
  amount: "Сума",
  share: "Частка",
  sharePercent: "Частка, %",
  unitPrice:
    "Ціна за одиницю",
  totalAmount:
    "Загальна сума",
  purchasedAt:
    "Дата оприбуткування",
  dateTime: "Дата і час",
  movementType: "Тип руху",
  totalValue:
    "Загальна вартість",
  note: "Примітка",
};

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function formatValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map(formatValue)
      .join(", ");
  }

  if (isRecord(value)) {
    if (
      typeof value.name ===
      "string"
    ) {
      return value.name;
    }

    return JSON.stringify(
      value
    );
  }

  return String(value);
}

function escapeCsvValue(
  value: string,
  sanitizeText = true
) {
  const safeValue =
    sanitizeText
      ? sanitizeSpreadsheetText(
          value
        )
      : value;

  return `"${safeValue.replaceAll(
    '"',
    '""'
  )}"`;
}

export function createCsv(
  rows: unknown[]
) {
  const validRows =
    rows.filter(isRecord);

  if (
    validRows.length === 0
  ) {
    return "";
  }

  const columns: string[] =
    [];

  validRows.forEach(
    (row) => {
      Object.keys(row).forEach(
        (key) => {
          if (
            !columns.includes(
              key
            )
          ) {
            columns.push(key);
          }
        }
      );
    }
  );

  const header = columns
    .map((column) =>
      escapeCsvValue(
        columnLabels[column] ||
          column,
        false
      )
    )
    .join(";");

  const body = validRows.map(
    (row) =>
      columns
        .map((column) => {
          const value =
            row[column];

          return escapeCsvValue(
            formatValue(value),
            typeof value !==
              "number"
          );
        })
        .join(";")
  );

  return [
    header,
    ...body,
  ].join("\r\n");
}
