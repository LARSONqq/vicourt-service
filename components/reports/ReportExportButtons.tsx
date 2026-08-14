"use client";

type Dataset = {
  title: string;
  filename: string;
  rows: unknown[];
};

type Props = {
  datasets: Dataset[];
};

const columnLabels: Record<string, string> = {
  id: "ID",
  name: "Назва",
  first_name: "Ім’я",
  last_name: "Прізвище",
  customer: "Замовник",
  client_name: "Замовник",
  phone: "Телефон",
  email: "Email",
  address: "Адреса",
  status: "Статус",
  responsible: "Відповідальний",
  position: "Посада",
  category: "Категорія",
  quantity: "Кількість",
  unit: "Одиниця виміру",
  min_quantity: "Мінімальний залишок",
  purchase_price: "Закупівельна ціна",
  supplier: "Постачальник",
  item_id: "ID товару",
  object_id: "ID об’єкта",
  movement_type: "Тип операції",
  note: "Примітка",
  item: "Товар",
  object: "Об’єкт",
  inventory_number: "Інвентарний номер",
  location: "Локація",
  purchase_date: "Дата придбання",
  next_service_date: "Наступний сервіс",
  notes: "Примітки",
  equipment_id: "ID техніки",
  equipment: "Техніка",
  service_type: "Тип обслуговування",
  service_date: "Дата обслуговування",
  cost: "Вартість",
  performed_by: "Хто виконав",
  description: "Опис",
  employment_type: "Тип роботи",
  hire_date: "Дата прийняття",
  created_at: "Дата створення",
};

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ");
  }

  if (isRecord(value)) {
    if (typeof value.name === "string") {
      return value.name;
    }

    if (
      typeof value.first_name === "string" ||
      typeof value.last_name === "string"
    ) {
      return [
        value.last_name,
        value.first_name,
      ]
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .join(" ");
    }

    return JSON.stringify(value);
  }

  return String(value);
}

function escapeCsvValue(value: string) {
  const escapedValue = value.replaceAll('"', '""');

  return `"${escapedValue}"`;
}

function createCsv(rows: unknown[]) {
  const validRows = rows.filter(isRecord);

  if (validRows.length === 0) {
    return "";
  }

  const columns: string[] = [];

  validRows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    });
  });

  const header = columns
    .map((column) =>
      escapeCsvValue(columnLabels[column] || column)
    )
    .join(";");

  const body = validRows.map((row) =>
    columns
      .map((column) =>
        escapeCsvValue(formatValue(row[column]))
      )
      .join(";")
  );

  return [header, ...body].join("\r\n");
}

function downloadCsv(dataset: Dataset) {
  const csv = createCsv(dataset.rows);

  if (!csv) {
    window.alert(
      `У звіті «${dataset.title}» поки немає даних.`
    );

    return;
  }

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = dataset.filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function ReportExportButtons({
  datasets,
}: Props) {
  return (
    <section className="rounded-xl border bg-white p-5">
      <div>
        <h2 className="text-xl font-semibold">
          Експорт даних
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Завантаження таблиць у форматі CSV
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {datasets.map((dataset) => {
          const hasData = dataset.rows.length > 0;

          return (
            <button
              key={dataset.filename}
              type="button"
              onClick={() => downloadCsv(dataset)}
              disabled={!hasData}
              className="rounded-lg border border-green-600 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
            >
              {dataset.title}
              {!hasData && " — немає даних"}
            </button>
          );
        })}
      </div>
    </section>
  );
}