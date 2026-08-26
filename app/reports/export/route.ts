import type {
  NextRequest,
} from "next/server";

import {
  canViewReports,
} from "@/lib/auth/permissions";
import {
  createCsv,
} from "@/lib/csvExport";
import {
  getReportFilterInput,
} from "@/lib/reportExportParams";

import {
  getEmployees,
} from "@/services/employeeService";
import {
  getEquipment,
  getEquipmentServiceRecords,
} from "@/services/equipmentService";
import {
  getObjects,
} from "@/services/objectService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  getReportsData,
  normalizeReportsFilters,
} from "@/services/reportService";
import {
  getWarehouseItems,
} from "@/services/warehouseService";

type ExportType =
  | "object-costs"
  | "employee-work"
  | "expense-categories"
  | "purchases"
  | "warehouse-movements"
  | "objects"
  | "warehouse-current"
  | "equipment"
  | "equipment-service"
  | "employees";

type CsvResult = {
  filename: string;
  rows: unknown[];
};

const exportTypes =
  new Set<ExportType>([
    "object-costs",
    "employee-work",
    "expense-categories",
    "purchases",
    "warehouse-movements",
    "objects",
    "warehouse-current",
    "equipment",
    "equipment-service",
    "employees",
  ]);

const kyivDateFormatter =
  new Intl.DateTimeFormat(
    "uk-UA",
    {
      timeZone:
        "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

const kyivDateTimeFormatter =
  new Intl.DateTimeFormat(
    "uk-UA",
    {
      timeZone:
        "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

function isExportType(
  value: string
): value is ExportType {
  return exportTypes.has(
    value as ExportType
  );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "";
  }

  const dateOnlyMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  if (dateOnlyMatch) {
    return `${dateOnlyMatch[3]}.${dateOnlyMatch[2]}.${dateOnlyMatch[1]}`;
  }

  const date = new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? value
    : kyivDateFormatter.format(
        date
      );
}

function formatDateTime(
  value: string
) {
  const date = new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? value
    : kyivDateTimeFormatter.format(
        date
      );
}

function getCurrentKyivDate() {
  const parts =
    Object.fromEntries(
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "Europe/Kyiv",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      )
        .formatToParts(
          new Date()
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

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function createPeriodFilename(
  name: string,
  dateFrom: string,
  dateTo: string
) {
  return `vicourt-${name}-${dateFrom}-${dateTo}.csv`;
}

async function getPeriodCsv(
  type: ExportType,
  request: NextRequest
): Promise<CsvResult> {
  const searchParams =
    request.nextUrl
      .searchParams;

  const filters =
    normalizeReportsFilters(
      getReportFilterInput(
        searchParams
      )
    );

  const data =
    await getReportsData(
      filters
    );

  switch (type) {
    case "object-costs":
      return {
        filename:
          createPeriodFilename(
            "object-costs",
            filters.dateFrom,
            filters.dateTo
          ),
        rows:
          data.objectCosts.map(
            (object) => ({
              objectName:
                object.objectName,
              materialsCost:
                object.materialsCost,
              laborCost:
                object.laborCost,
              otherExpensesCost:
                object.otherExpensesCost,
              periodActualCost:
                object.totalCost,
              hours:
                object.hours,
              costBudget:
                object.costBudget,
              clientPrice:
                object.clientPrice,
              actualCost:
                object.lifetimeActualCost,
              budgetRemaining:
                object.budgetRemaining,
              budgetOverrun:
                object.budgetOverrun,
              financialResult:
                object.financialResult,
              marginPercent:
                object.marginPercent,
            })
          ),
      };

    case "employee-work":
      return {
        filename:
          createPeriodFilename(
            "employee-work",
            filters.dateFrom,
            filters.dateTo
          ),
        rows: data.employeeWork,
      };

    case "expense-categories":
      return {
        filename:
          createPeriodFilename(
            "expense-categories",
            filters.dateFrom,
            filters.dateTo
          ),
        rows:
          data.expenseCategories,
      };

    case "purchases":
      return {
        filename:
          createPeriodFilename(
            "purchases",
            filters.dateFrom,
            filters.dateTo
          ),
        rows:
          data.purchaseExportRows.map(
            (purchase) => ({
              material:
                purchase.material,
              status:
                purchase.status,
              quantity:
                purchase.quantity,
              unit:
                purchase.unit,
              unitPrice:
                purchase.unitPrice,
              totalAmount:
                purchase.totalAmount,
              supplier:
                purchase.supplier,
              createdAt:
                formatDateTime(
                  purchase.createdAt
                ),
              purchasedAt:
                purchase.purchasedAt
                  ? formatDateTime(
                      purchase.purchasedAt
                    )
                  : "",
              note:
                purchase.note,
            })
          ),
      };

    case "warehouse-movements":
      return {
        filename:
          createPeriodFilename(
            "warehouse-movements",
            filters.dateFrom,
            filters.dateTo
          ),
        rows:
          data.warehouseMovementExportRows.map(
            (movement) => ({
              dateTime:
                formatDateTime(
                  movement.createdAt
                ),
              material:
                movement.itemName,
              objectName:
                movement.objectName,
              movementType:
                movement.movementType,
              quantity:
                movement.quantity,
              unit:
                movement.unit,
              unitPrice:
                movement.unitPrice,
              totalValue:
                movement.totalValue,
              performedBy:
                movement.performedBy,
              note:
                movement.note,
            })
          ),
      };

    default:
      throw new Error(
        "Невідомий періодний звіт."
      );
  }
}

async function getSnapshotCsv(
  type: ExportType
): Promise<CsvResult> {
  const currentDate =
    getCurrentKyivDate();

  switch (type) {
    case "objects": {
      const objects =
        await getObjects();

      return {
        filename: `vicourt-objects-${currentDate}.csv`,
        rows: objects.map(
          (object) => ({
            id: object.id,
            name: object.name,
            customer:
              object.customer,
            phone: object.phone,
            address:
              object.address,
            status:
              object.status,
            manager:
              object.manager,
            responsibleEmployeeId:
              object.responsible_employee_id,
            costBudget:
              object.cost_budget,
            clientPrice:
              object.client_price,
            createdAt:
              formatDateTime(
                object.created_at
              ),
          })
        ),
      };
    }

    case "warehouse-current": {
      const items =
        await getWarehouseItems();

      return {
        filename: `vicourt-warehouse-current-${currentDate}.csv`,
        rows: items.map(
          (item) => ({
            material:
              item.name,
            category:
              item.category,
            stockQuantity:
              item.quantity,
            unit: item.unit,
            minimumQuantity:
              item.min_quantity,
            averagePrice:
              item.purchase_price,
            stockValue:
              Number(
                item.quantity
              ) *
              Number(
                item.purchase_price
              ),
            supplier:
              item.supplier,
          })
        ),
      };
    }

    case "equipment": {
      const equipment =
        await getEquipment();

      return {
        filename: `vicourt-equipment-${currentDate}.csv`,
        rows: equipment.map(
          (item) => ({
            id: item.id,
            name: item.name,
            category:
              item.category,
            inventoryNumber:
              item.inventory_number,
            status:
              item.status,
            responsible:
              item.responsible,
            responsibleEmployeeId:
              item.responsible_employee_id,
            location:
              item.location,
            purchaseDate:
              formatDate(
                item.purchase_date
              ),
            nextServiceDate:
              formatDate(
                item.next_service_date
              ),
            notes: item.notes,
            createdAt:
              formatDateTime(
                item.created_at
              ),
          })
        ),
      };
    }

    case "equipment-service": {
      const records =
        await getEquipmentServiceRecords();

      return {
        filename: `vicourt-equipment-service-${currentDate}.csv`,
        rows: records.map(
          (record) => ({
            id: record.id,
            equipment:
              record.equipment
                ?.name ||
              `Техніка #${record.equipment_id}`,
            inventoryNumber:
              record.equipment
                ?.inventory_number ||
              "",
            serviceType:
              record.service_type,
            serviceDate:
              formatDate(
                record.service_date
              ),
            cost: record.cost,
            performedBy:
              record.performed_by,
            description:
              record.description,
            nextServiceDate:
              formatDate(
                record.next_service_date
              ),
            createdAt:
              formatDateTime(
                record.created_at
              ),
          })
        ),
      };
    }

    case "employees": {
      const employees =
        await getEmployees();

      return {
        filename: `vicourt-employees-${currentDate}.csv`,
        rows: employees.map(
          (employee) => ({
            id: employee.id,
            lastName:
              employee.last_name,
            firstName:
              employee.first_name,
            phone:
              employee.phone,
            email:
              employee.email,
            position:
              employee.position,
            employmentType:
              employee.employment_type,
            status:
              employee.status,
            hireDate:
              formatDate(
                employee.hire_date
              ),
            hourlyRate:
              employee.hourly_rate,
            notes:
              employee.notes,
            createdAt:
              formatDateTime(
                employee.created_at
              ),
          })
        ),
      };
    }

    default:
      throw new Error(
        "Невідомий операційний звіт."
      );
  }
}

export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest
) {
  try {
    const profile =
      await getCurrentUserProfile();

    if (!profile) {
      return new Response(
        "Потрібна авторизація.",
        { status: 401 }
      );
    }

    if (
      !canViewReports(
        profile.role
      )
    ) {
      return new Response(
        "Недостатньо прав.",
        { status: 403 }
      );
    }

    const type =
      request.nextUrl.searchParams.get(
        "type"
      ) || "";

    if (!isExportType(type)) {
      return new Response(
        "Невідомий тип експорту.",
        { status: 400 }
      );
    }

    const result = [
      "object-costs",
      "employee-work",
      "expense-categories",
      "purchases",
      "warehouse-movements",
    ].includes(type)
      ? await getPeriodCsv(
          type,
          request
        )
      : await getSnapshotCsv(
          type
        );

    const csv = createCsv(
      result.rows
    );

    return new Response(
      `\uFEFF${csv}`,
      {
        headers: {
          "Cache-Control":
            "no-store",
          "Content-Disposition":
            `attachment; filename="${result.filename}"`,
          "Content-Type":
            "text/csv; charset=utf-8",
          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(
      "Не вдалося сформувати CSV-звіт:",
      error instanceof Error
        ? error.message
        : error
    );

    return new Response(
      "Не вдалося сформувати CSV-звіт.",
      { status: 500 }
    );
  }
}
