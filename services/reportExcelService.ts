import "server-only";

import ExcelJS, {
  type CellValue,
  type Workbook,
  type Worksheet,
} from "exceljs";

import {
  sanitizeSpreadsheetText,
} from "@/lib/exportSecurity";
import {
  objectPaymentScheduleStatusLabels,
} from "@/constants/objectPaymentSchedule";

import type {
  ReportsData,
} from "@/types/report";

const moneyFormat =
  '#,##0.00 "₴"';
const decimalFormat =
  "#,##0.00";
const integerFormat = "0";
const dateFormat =
  "dd.mm.yyyy";
const dateTimeFormat =
  "dd.mm.yyyy hh:mm";

const kyivDateTimeFormatter =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  );

type ReportColumn<T> = {
  header: string;
  width: number;
  value: (
    row: T
  ) => CellValue;
  numberFormat?: string;
};

type TableWorksheetOptions<T> = {
  name: string;
  columns: ReportColumn<T>[];
  rows: T[];
  note?: string;
};

function safeText(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return sanitizeSpreadsheetText(
    String(value)
  );
}

function safeNumber(
  value: number
) {
  return Number.isFinite(value)
    ? value
    : 0;
}

function optionalNumber(
  value: number | null
): CellValue {
  return value === null
    ? null
    : safeNumber(value);
}

function toDateOnly(
  value: string
): CellValue {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  if (!match) {
    return safeText(value);
  }

  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );
}

function toKyivDateTime(
  value: string | null
): CellValue {
  if (!value) {
    return "";
  }

  const sourceDate =
    new Date(value);

  if (
    Number.isNaN(
      sourceDate.getTime()
    )
  ) {
    return safeText(value);
  }

  const parts =
    Object.fromEntries(
      kyivDateTimeFormatter
        .formatToParts(
          sourceDate
        )
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map((part) => [
          part.type,
          part.value,
        ])
    );

  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    )
  );
}

function formatPeriodDate(
  value: string
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  return match
    ? `${match[3]}.${match[2]}.${match[1]}`
    : safeText(value);
}

function styleHeader(
  worksheet: Worksheet,
  rowNumber: number,
  columnCount: number
) {
  const row =
    worksheet.getRow(
      rowNumber
    );

  row.height = 30;

  for (
    let column = 1;
    column <= columnCount;
    column += 1
  ) {
    const cell =
      row.getCell(column);

    cell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF15803D",
      },
    };
    cell.alignment = {
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      bottom: {
        style: "thin",
        color: {
          argb: "FF166534",
        },
      },
    };
  }
}

function addTableWorksheet<T>(
  workbook: Workbook,
  options: TableWorksheetOptions<T>
) {
  const worksheet =
    workbook.addWorksheet(
      options.name,
      {
        properties: {
          defaultRowHeight: 20,
        },
        pageSetup: {
          orientation:
            "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      }
    );

  const headerRowNumber =
    options.note ? 3 : 1;

  if (options.note) {
    worksheet.mergeCells(
      1,
      1,
      1,
      options.columns.length
    );

    const noteCell =
      worksheet.getCell(1, 1);

    noteCell.value =
      safeText(options.note);
    noteCell.font = {
      bold: true,
      color: {
        argb: "FF166534",
      },
    };
    noteCell.alignment = {
      vertical: "middle",
    };
    worksheet.getRow(1).height =
      25;
  }

  const headerRow =
    worksheet.getRow(
      headerRowNumber
    );

  headerRow.values =
    options.columns.map(
      (column) =>
        safeText(
          column.header
        )
    );

  styleHeader(
    worksheet,
    headerRowNumber,
    options.columns.length
  );

  options.columns.forEach(
    (column, index) => {
      worksheet.getColumn(
        index + 1
      ).width = column.width;
    }
  );

  options.rows.forEach(
    (item, rowIndex) => {
      const rowNumber =
        headerRowNumber +
        rowIndex +
        1;
      const row =
        worksheet.getRow(
          rowNumber
        );

      row.values =
        options.columns.map(
          (column) =>
            column.value(
              item
            )
        );
      row.alignment = {
        vertical: "top",
        wrapText: true,
      };

      options.columns.forEach(
        (column, index) => {
          if (
            column.numberFormat
          ) {
            row.getCell(
              index + 1
            ).numFmt =
              column.numberFormat;
          }
        }
      );
    }
  );

  worksheet.views = [
    {
      state: "frozen",
      ySplit:
        headerRowNumber,
    },
  ];
  worksheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: headerRowNumber,
      column:
        options.columns.length,
    },
  };

  return worksheet;
}

function addSummaryWorksheet(
  workbook: Workbook,
  data: ReportsData
) {
  const worksheet =
    workbook.addWorksheet(
      "Підсумок",
      {
        properties: {
          defaultRowHeight: 22,
        },
      }
    );

  worksheet.columns = [
    { width: 38 },
    { width: 24 },
  ];
  worksheet.mergeCells(
    "A1:B1"
  );
  worksheet.getCell("A1").value =
    "ViCourt Service";
  worksheet.getCell("A1").font = {
    bold: true,
    size: 18,
    color: {
      argb: "FFFFFFFF",
    },
  };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF15803D",
    },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
  };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells(
    "A2:B2"
  );
  worksheet.getCell("A2").value =
    `Звіт за період: ${formatPeriodDate(
      data.filters.dateFrom
    )} – ${formatPeriodDate(
      data.filters.dateTo
    )}`;
  worksheet.getCell("A2").font = {
    color: {
      argb: "FF4B5563",
    },
  };
  worksheet.getCell("A3").value =
    "Метод обліку матеріалів";
  worksheet.getCell("B3").value =
    safeText(
      data.materialAccounting
        .periodMode === "exact"
        ? "Точний Ledger"
        : data.materialAccounting
              .periodMode === "mixed"
          ? "Mixed: legacy + exact Ledger"
          : "Legacy approximation"
    );

  const summaryRows = [
    {
      label:
        "Витрати на матеріали",
      value:
        data.kpis.materialsCost,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Матеріали — exact Ledger",
      value:
        data.materialAccounting
          .exactCost,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Матеріали — legacy approximation",
      value:
        data.materialAccounting
          .legacyApproximateCost,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Витрати на роботи",
      value:
        data.kpis.laborCost,
      numberFormat: moneyFormat,
    },
    {
      label: "Інші витрати",
      value:
        data.kpis.otherExpensesCost,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Загальні витрати об’єктів",
      value:
        data.kpis.totalObjectCost,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Відпрацьовані години",
      value:
        data.kpis.totalHours,
      numberFormat:
        decimalFormat,
    },
    {
      label:
        "Фактично закуплено на склад",
      value:
        data.kpis.purchasedCost,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Заплановано закупівель",
      value:
        data.purchases.plannedCount,
      numberFormat:
        integerFormat,
    },
    {
      label:
        "Планова сума закупівель",
      value:
        data.purchases.plannedAmount,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Отримано від клієнтів за період",
      value:
        data.kpis.paymentsReceived,
      numberFormat: moneyFormat,
    },
    {
      label:
        "До отримання по об’єктах",
      value:
        data.kpis.outstandingReceivables,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Прострочено за графіком (поточний стан)",
      value:
        data.kpis.overdueScheduleAmount,
      numberFormat: moneyFormat,
    },
    {
      label:
        "До сплати сьогодні за графіком",
      value:
        data.paymentScheduleSummary
          .dueTodayAmount,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Заплановано за графіком",
      value:
        data.paymentScheduleSummary
          .plannedAmount,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Покрито за графіком",
      value:
        data.paymentScheduleSummary
          .paidAmount,
      numberFormat: moneyFormat,
    },
    {
      label:
        "Об’єктів без встановленої ціни",
      value:
        data.kpis.objectsWithoutClientPrice,
      numberFormat:
        integerFormat,
    },
  ];

  const headerRowNumber = 4;
  const headerRow =
    worksheet.getRow(
      headerRowNumber
    );

  headerRow.values = [
    "Основні показники",
    "Значення",
  ];
  styleHeader(
    worksheet,
    headerRowNumber,
    2
  );

  summaryRows.forEach(
    (item, index) => {
      const row =
        worksheet.getRow(
          headerRowNumber +
            index +
            1
        );

      row.values = [
        safeText(item.label),
        item.value === null
          ? ""
          : safeNumber(item.value),
      ];
      row.getCell(2).numFmt =
        item.numberFormat;
    }
  );

  worksheet.views = [
    {
      state: "frozen",
      ySplit: headerRowNumber,
    },
  ];
}

export async function createReportsWorkbook(
  data: ReportsData
) {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "ViCourt Service";
  workbook.company =
    "ViCourt Service";

  addSummaryWorksheet(
    workbook,
    data
  );

  addTableWorksheet(
    workbook,
    {
      name: "Об’єкти",
      rows: data.objectCosts,
      columns: [
        {
          header: "Об’єкт",
          width: 32,
          value: (row) =>
            safeText(
              row.objectName
            ),
        },
        {
          header:
            "Матеріали за період",
          width: 18,
          value: (row) =>
            safeNumber(
              row.materialsCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Роботи за період",
          width: 18,
          value: (row) =>
            safeNumber(
              row.laborCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Інші витрати за період",
          width: 18,
          value: (row) =>
            safeNumber(
              row.otherExpensesCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Витрати за період",
          width: 20,
          value: (row) =>
            safeNumber(
              row.totalCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Отримано за період",
          width: 20,
          value: (row) =>
            safeNumber(
              row.periodPaymentsReceived
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Матеріали за весь час",
          width: 22,
          value: (row) =>
            safeNumber(
              row.lifetimeMaterialsCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Роботи за весь час",
          width: 20,
          value: (row) =>
            safeNumber(
              row.lifetimeLaborCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Інші витрати за весь час",
          width: 22,
          value: (row) =>
            safeNumber(
              row.lifetimeOtherExpensesCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Фактичні витрати за весь час",
          width: 25,
          value: (row) =>
            safeNumber(
              row.lifetimeActualCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Плановий бюджет",
          width: 20,
          value: (row) =>
            optionalNumber(
              row.costBudget
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Залишок бюджету",
          width: 20,
          value: (row) =>
            optionalNumber(
              row.budgetRemaining
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Перевитрата",
          width: 18,
          value: (row) =>
            optionalNumber(
              row.budgetOverrun
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Вартість для клієнта",
          width: 22,
          value: (row) =>
            optionalNumber(
              row.clientPrice
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Отримано від клієнта",
          width: 22,
          value: (row) =>
            safeNumber(
              row.lifetimePaid
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Залишилось до оплати",
          width: 22,
          value: (row) =>
            optionalNumber(
              row.remainingToPay
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Переплата",
          width: 18,
          value: (row) =>
            optionalNumber(
              row.overpayment
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Поточний прибуток",
          width: 20,
          value: (row) =>
            optionalNumber(
              row.financialResult
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Маржинальність",
          width: 18,
          value: (row) =>
            row.marginPercent ===
            null
              ? null
              : safeNumber(
                  row.marginPercent /
                    100
                ),
          numberFormat: "0.0%",
        },
        {
          header:
            "Відпрацьовані години за період",
          width: 22,
          value: (row) =>
            safeNumber(
              row.hours
            ),
          numberFormat:
            decimalFormat,
        },
      ],
    }
  );

  addTableWorksheet(
    workbook,
    {
      name:
        "Робота працівників",
      rows: data.employeeWork,
      columns: [
        {
          header: "Працівник",
          width: 30,
          value: (row) =>
            safeText(
              row.employeeName
            ),
        },
        {
          header:
            "Записів журналу",
          width: 20,
          value: (row) =>
            safeNumber(
              row.recordsCount
            ),
          numberFormat:
            integerFormat,
        },
        {
          header:
            "Відпрацьовано годин",
          width: 22,
          value: (row) =>
            safeNumber(
              row.hours
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Вартість робіт",
          width: 20,
          value: (row) =>
            safeNumber(
              row.laborCost
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Кількість об’єктів",
          width: 22,
          value: (row) =>
            safeNumber(
              row.objectsCount
            ),
          numberFormat:
            integerFormat,
        },
      ],
    }
  );

  addTableWorksheet(
    workbook,
    {
      name: "Інші витрати",
      rows: data.expenseDetails,
      columns: [
        {
          header: "Дата",
          width: 14,
          value: (row) =>
            toDateOnly(
              row.expenseDate
            ),
          numberFormat:
            dateFormat,
        },
        {
          header: "Об’єкт",
          width: 30,
          value: (row) =>
            safeText(
              row.objectName
            ),
        },
        {
          header: "Категорія",
          width: 22,
          value: (row) =>
            safeText(
              row.category
            ),
        },
        {
          header: "Опис",
          width: 38,
          value: (row) =>
            safeText(
              row.description
            ),
        },
        {
          header: "Сума",
          width: 18,
          value: (row) =>
            safeNumber(
              row.amount
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Примітка",
          width: 34,
          value: (row) =>
            safeText(row.note),
        },
        {
          header: "Хто додав",
          width: 24,
          value: (row) =>
            safeText(
              row.createdBy
            ),
        },
      ],
    }
  );

  addTableWorksheet(
    workbook,
    {
      name:
        "Платежі клієнтів",
      rows: data.paymentDetails,
      columns: [
        {
          header: "Дата",
          width: 14,
          value: (row) =>
            toDateOnly(
              row.paymentDate
            ),
          numberFormat:
            dateFormat,
        },
        {
          header: "Об’єкт",
          width: 32,
          value: (row) =>
            safeText(
              row.objectName
            ),
        },
        {
          header: "Сума",
          width: 18,
          value: (row) =>
            safeNumber(
              row.amount
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Спосіб оплати",
          width: 24,
          value: (row) =>
            safeText(
              row.paymentMethod
            ),
        },
        {
          header: "Примітка",
          width: 38,
          value: (row) =>
            safeText(row.note),
        },
      ],
    }
  );

  addTableWorksheet(
    workbook,
    {
      name: "Графік оплат",
      rows:
        data.paymentScheduleDetails,
      note:
        "Планові етапи за датою у вибраному періоді; фактичні платежі наведені на окремій вкладці.",
      columns: [
        {
          header: "Дата",
          width: 14,
          value: (row) =>
            toDateOnly(
              row.dueDate
            ),
          numberFormat:
            dateFormat,
        },
        {
          header: "Об’єкт",
          width: 32,
          value: (row) =>
            safeText(
              row.objectName
            ),
        },
        {
          header: "Етап",
          width: 30,
          value: (row) =>
            safeText(row.title),
        },
        {
          header:
            "Планова сума",
          width: 18,
          value: (row) =>
            safeNumber(
              row.plannedAmount
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Покрито",
          width: 18,
          value: (row) =>
            safeNumber(
              row.paidAmount
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Залишок",
          width: 18,
          value: (row) =>
            safeNumber(
              row.remainingAmount
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Статус",
          width: 22,
          value: (row) =>
            safeText(
              objectPaymentScheduleStatusLabels[
                row.status
              ]
            ),
        },
        {
          header: "Примітка",
          width: 38,
          value: (row) =>
            safeText(row.note),
        },
      ],
    }
  );

  addTableWorksheet(
    workbook,
    {
      name: "Закупівлі",
      rows:
        data.purchaseExportRows,
      columns: [
        {
          header: "Матеріал",
          width: 30,
          value: (row) =>
            safeText(
              row.material
            ),
        },
        {
          header: "Статус",
          width: 18,
          value: (row) =>
            safeText(
              row.status
            ),
        },
        {
          header: "Кількість",
          width: 16,
          value: (row) =>
            safeNumber(
              row.quantity
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Ціна за одиницю",
          width: 20,
          value: (row) =>
            safeNumber(
              row.unitPrice
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Загальна сума",
          width: 20,
          value: (row) =>
            safeNumber(
              row.totalAmount
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Постачальник",
          width: 28,
          value: (row) =>
            safeText(
              row.supplier
            ),
        },
        {
          header:
            "Дата створення",
          width: 20,
          value: (row) =>
            toKyivDateTime(
              row.createdAt
            ),
          numberFormat:
            dateTimeFormat,
        },
        {
          header:
            "Дата оприбуткування",
          width: 24,
          value: (row) =>
            toKyivDateTime(
              row.purchasedAt
            ),
          numberFormat:
            dateTimeFormat,
        },
        {
          header: "Примітка",
          width: 34,
          value: (row) =>
            safeText(row.note),
        },
      ],
    }
  );

  addTableWorksheet(
    workbook,
    {
      name: "Рух матеріалів",
      note:
        data.materialAccounting.limitation ||
        "Матеріальні витрати після cutover розраховані за точними історичними рухами Ledger.",
      rows:
        data.warehouseMovementExportRows,
      columns: [
        {
          header:
            "Дата і час",
          width: 20,
          value: (row) =>
            toKyivDateTime(
              row.createdAt
            ),
          numberFormat:
            dateTimeFormat,
        },
        {
          header: "Матеріал",
          width: 30,
          value: (row) =>
            safeText(
              row.itemName
            ),
        },
        {
          header: "Об’єкт",
          width: 28,
          value: (row) =>
            safeText(
              row.objectName
            ),
        },
        {
          header: "Тип руху",
          width: 28,
          value: (row) =>
            safeText(
              row.movementLabel
            ),
        },
        {
          header: "Кількість",
          width: 16,
          value: (row) =>
            safeNumber(
              row.quantity
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Одиниця виміру",
          width: 18,
          value: (row) =>
            safeText(row.unit),
        },
        {
          header:
            "Ціна за одиницю",
          width: 20,
          value: (row) =>
            safeNumber(
              row.unitPrice
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Загальна вартість",
          width: 22,
          value: (row) =>
            safeNumber(
              row.totalValue
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Вплив на собівартість об’єкта",
          width: 26,
          value: (row) =>
            optionalNumber(
              row.objectCostImpact
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header: "Виконав",
          width: 24,
          value: (row) =>
            safeText(
              row.performedBy
            ),
        },
        {
          header: "Джерело",
          width: 24,
          value: (row) =>
            safeText(row.source),
        },
        {
          header: "Метод обліку",
          width: 24,
          value: (row) =>
            safeText(
              row.accountingMethod
            ),
        },
        {
          header: "Примітка",
          width: 34,
          value: (row) =>
            safeText(row.note),
        },
      ],
    }
  );

  addTableWorksheet(
    workbook,
    {
      name: "Склад",
      note:
        "Поточний стан складу",
      rows:
        data.warehouseSnapshotRows,
      columns: [
        {
          header: "Матеріал",
          width: 30,
          value: (row) =>
            safeText(
              row.material
            ),
        },
        {
          header: "Категорія",
          width: 22,
          value: (row) =>
            safeText(
              row.category
            ),
        },
        {
          header: "Залишок",
          width: 16,
          value: (row) =>
            safeNumber(
              row.stockQuantity
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Одиниця виміру",
          width: 18,
          value: (row) =>
            safeText(row.unit),
        },
        {
          header:
            "Мінімальний залишок",
          width: 22,
          value: (row) =>
            safeNumber(
              row.minimumQuantity
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Цільовий запас",
          width: 20,
          value: (row) =>
            optionalNumber(
              row.targetQuantity
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Нестача до цілі",
          width: 20,
          value: (row) =>
            optionalNumber(
              row.targetShortage
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Вже заплановано",
          width: 20,
          value: (row) =>
            safeNumber(
              row.plannedIncoming
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Ще рекомендується",
          width: 22,
          value: (row) =>
            optionalNumber(
              row.remainingRecommended
            ),
          numberFormat:
            decimalFormat,
        },
        {
          header:
            "Середня ціна",
          width: 18,
          value: (row) =>
            safeNumber(
              row.averagePrice
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Остання закупівельна ціна",
          width: 26,
          value: (row) =>
            optionalNumber(
              row.lastPurchasePrice
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Вартість залишку",
          width: 22,
          value: (row) =>
            safeNumber(
              row.stockValue
            ),
          numberFormat:
            moneyFormat,
        },
        {
          header:
            "Основний постачальник",
          width: 28,
          value: (row) =>
            safeText(
              row.supplier
            ),
        },
      ],
    }
  );

  const buffer =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(buffer);
}
