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
  getManagementEmployees,
} from "@/services/employeeService";
import {
  getEquipment,
  getEquipmentServiceHistoryRecords,
} from "@/services/equipmentService";
import {
  getManagementObjects,
} from "@/services/objectService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  getReportsData,
  normalizeReportsFilters,
} from "@/services/reportService";
import {
  getManagementWarehouseItems,
} from "@/services/warehouseService";
import {
  getWarehousePurchaseInsights,
} from "@/services/purchaseService";
import {
  getWarehousePurchaseInsight,
  getWarehouseStockPlan,
} from "@/lib/warehousePlanning";
import {
  objectPaymentScheduleStatusLabels,
} from "@/constants/objectPaymentSchedule";

type ExportType =
  | "summary"
  | "object-costs"
  | "employee-work"
  | "expense-categories"
  | "client-payments"
  | "payment-schedule"
  | "purchases"
  | "warehouse-movements"
  | "equipment-costs"
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
    "summary",
    "object-costs",
    "employee-work",
    "expense-categories",
    "client-payments",
    "payment-schedule",
    "purchases",
    "warehouse-movements",
    "equipment-costs",
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
    case "summary":
      return {
        filename:
          createPeriodFilename(
            "summary",
            filters.dateFrom,
            filters.dateTo
          ),
        rows: [
          {
            dateFrom:
              formatDate(
                filters.dateFrom
              ),
            dateTo:
              formatDate(filters.dateTo),
            materialAccountingMethod:
              data.materialAccounting
                .periodMode,
            exactMaterialsCost:
              data.materialAccounting
                .exactCost,
            legacyApproximateMaterialsCost:
              data.materialAccounting
                .legacyApproximateCost,
            materialsCost:
              data.kpis.materialsCost,
            laborCost:
              data.kpis.laborCost,
            otherExpensesCost:
              data.kpis
                .otherExpensesCost,
            totalObjectCost:
              data.kpis.totalObjectCost,
            totalHours:
              data.kpis.totalHours,
            paymentsReceived:
              data.kpis.paymentsReceived,
            purchasedCost:
              data.kpis.purchasedCost,
            overdueScheduleAmount:
              data.kpis
                .overdueScheduleAmount,
            equipmentPlannedMaintenanceCost:
              data.equipmentCostSummary
                .periodPlannedMaintenanceCost,
            equipmentRepairAndOtherCost:
              data.equipmentCostSummary
                .periodOtherServiceCost,
            equipmentTotalCost:
              data.equipmentCostSummary
                .periodTotalCost,
            materialAccountingLimitation:
              data.materialAccounting
                .limitation,
          },
        ],
      };

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
              paymentsReceivedInPeriod:
                object.periodPaymentsReceived,
              materialAccountingMethod:
                data.materialAccounting
                  .periodMode,
              costBudget:
                object.costBudget,
              clientPrice:
                object.clientPrice,
              actualCost:
                object.lifetimeActualCost,
              lifetimeMaterialsCost:
                object.lifetimeMaterialsCost,
              lifetimeLaborCost:
                object.lifetimeLaborCost,
              lifetimeOtherExpensesCost:
                object.lifetimeOtherExpensesCost,
              budgetRemaining:
                object.budgetRemaining,
              budgetOverrun:
                object.budgetOverrun,
              financialResult:
                object.financialResult,
              marginPercent:
                object.marginPercent,
              lifetimePaid:
                object.lifetimePaid,
              remainingToPay:
                object.remainingToPay,
              overpayment:
                object.overpayment,
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

    case "client-payments":
      return {
        filename:
          createPeriodFilename(
            "client-payments",
            filters.dateFrom,
            filters.dateTo
          ),
        rows:
          data.paymentDetails.map(
            (payment) => ({
              paymentDate:
                formatDate(
                  payment.paymentDate
                ),
              objectName:
                payment.objectName,
              amount:
                payment.amount,
              paymentMethod:
                payment.paymentMethod,
              note:
                payment.note,
            })
          ),
      };

    case "payment-schedule":
      return {
        filename:
          createPeriodFilename(
            "payment-schedule",
            filters.dateFrom,
            filters.dateTo
          ),
        rows:
          data.paymentScheduleDetails.map(
            (item) => ({
              dueDate:
                formatDate(
                  item.dueDate
                ),
              objectName:
                item.objectName,
              scheduleTitle:
                item.title,
              plannedAmount:
                item.plannedAmount,
              paidAmount:
                item.paidAmount,
              remainingAmount:
                item.remainingAmount,
              status:
                objectPaymentScheduleStatusLabels[
                  item.status
                ],
              note: item.note,
            })
          ),
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
              movementCode:
                movement.movementCode,
              movementLabel:
                movement.movementLabel,
              quantity:
                movement.quantity,
              unit:
                movement.unit,
              unitPrice:
                movement.unitPrice,
              totalValue:
                movement.totalValue,
              objectCostImpact:
                movement.objectCostImpact,
              performedBy:
                movement.performedBy,
              source:
                movement.source,
              accountingMethod:
                movement.accountingMethod,
              note:
                movement.note,
            })
          ),
      };

    case "equipment-costs":
      return {
        filename:
          createPeriodFilename(
            "equipment-costs",
            filters.dateFrom,
            filters.dateTo
          ),
        rows:
          data.equipmentCosts.map(
            (item) => ({
              equipment:
                item.equipmentName,
              inventoryNumber:
                item.inventoryNumber,
              plannedMaintenanceCost:
                item.periodPlannedMaintenanceCost,
              repairAndOtherCost:
                item.periodOtherServiceCost,
              totalCost:
                item.periodTotalCost,
              lifetimePlannedMaintenanceCost:
                item.lifetimePlannedMaintenanceCost,
              lifetimeRepairAndOtherCost:
                item.lifetimeOtherServiceCost,
              lifetimeTotalCost:
                item.lifetimeTotalCost,
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
        await getManagementObjects();

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
      const [
        items,
        purchaseInsights,
      ] = await Promise.all([
        getManagementWarehouseItems(),
        getWarehousePurchaseInsights(),
      ]);

      return {
        filename: `vicourt-warehouse-current-${currentDate}.csv`,
        rows: items.map(
          (item) => {
            const insight =
              getWarehousePurchaseInsight(
                purchaseInsights,
                item.id
              );
            const plan =
              getWarehouseStockPlan(
                item,
                insight.plannedQuantity
              );

            return {
            material:
              item.name,
            category:
              item.category,
            stockQuantity:
              item.quantity,
            unit: item.unit,
            minimumQuantity:
              item.min_quantity,
            targetQuantity:
              plan.targetQuantity,
            targetShortage:
              plan.rawShortage,
            plannedIncoming:
              plan.plannedIncoming,
            remainingRecommended:
              plan.remainingRecommended,
            averagePrice:
              item.purchase_price,
            lastPurchasePrice:
              insight.lastPurchasePrice,
            stockValue:
              Number(
                item.quantity
              ) *
              Number(
                item.purchase_price
              ),
            preferredSupplier:
              item.supplier,
            };
          }
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
            maintenanceIntervalDays:
              item.maintenance_interval_days,
            lastMaintenanceDate:
              formatDate(
                item.last_maintenance_date
              ),
            nextMaintenanceDate:
              formatDate(
                item.next_service_date
              ),
            usageType:
              item.usage_type,
            currentUsage:
              item.current_usage,
            maintenanceIntervalUsage:
              item.maintenance_interval_usage,
            lastMaintenanceUsage:
              item.last_maintenance_usage,
            nextMaintenanceUsage:
              item.next_maintenance_usage,
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
        await getEquipmentServiceHistoryRecords();

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
            usageReading:
              record.usage_reading,
            usageType:
              record.usage_type_snapshot,
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
            status:
              record.voided_at
                ? "Анульовано"
                : "Активний",
            voidReason:
              record.void_reason,
          })
        ),
      };
    }

    case "employees": {
      const employees =
        await getManagementEmployees();

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
      "client-payments",
      "payment-schedule",
      "purchases",
      "warehouse-movements",
      "equipment-costs",
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
