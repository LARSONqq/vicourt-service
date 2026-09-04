import { createClient } from "@/lib/supabase/server";

import {
  objectExpenseCategories,
} from "@/constants/objectExpenses";
import {
  calculateObjectFinancials,
} from "@/lib/objectFinancials";
import {
  calculateObjectPaymentSummary,
  fromMoneyInCents,
  toMoneyInCents,
} from "@/lib/objectPayments";
import {
  calculateObjectPaymentSchedule,
} from "@/lib/objectPaymentSchedule";
import {
  addDaysToDateValue,
  getKyivDateStartUtc,
  getKyivDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";
import {
  buildWarehousePurchaseInsights,
  getWarehousePurchaseInsight,
  getWarehouseStockPlan,
} from "@/lib/warehousePlanning";
import {
  getMaterialLedgerCutover,
  getMaterialLedgerReport,
  getReportMaterialPeriodMode,
} from "@/services/reportMaterialLedgerService";

import type { WorkLog } from "@/types/workLog";

import type {
  ReportEmployeeOption,
  ReportEmployeeWork,
  ReportEquipmentCost,
  ReportEquipmentServiceDetail,
  ReportExpenseCategory,
  ReportExpenseDetail,
  ReportExpenseHighlight,
  ReportObjectCost,
  ReportObjectOption,
  ReportPaymentDetail,
  ReportPaymentScheduleDetail,
  ReportPurchaseExportRow,
  ReportWarehouseSnapshotRow,
  ReportsData,
  ReportsFilterInput,
  ReportsFilters,
} from "@/types/report";

export type ReportWorkLog = WorkLog & {
  object: {
    id: number;
    name: string;
  } | null;
};

export type ReportMaterial = {
  id: number;
  object_id: number;
  warehouse_item_id: number | null;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  created_at: string;

  object: {
    id: number;
    name: string;
  } | null;
};

export type ObjectReportSummary = {
  objectId: number;
  objectName: string;
  totalHours: number;
  materialItemsCount: number;
  totalMaterialCost: number;
};

export async function getReportWorkLogs(): Promise<
  ReportWorkLog[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("work_logs")
    .select(`
      id,
      object_id,
      employee_id,
      work_date,
      description,
      workers,
      hours,
      created_at,
      object:objects (
        id,
        name
      )
    `)
    .order("work_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити звіт по працівниках: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as unknown as ReportWorkLog[];
}

export async function getReportMaterials(): Promise<
  ReportMaterial[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("materials")
    .select(`
      id,
      object_id,
      warehouse_item_id,
      name,
      quantity,
      unit,
      price,
      created_at,
      object:objects (
        id,
        name
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити звіт по матеріалах: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as unknown as ReportMaterial[];
}

export async function getObjectReportSummaries(): Promise<
  ObjectReportSummary[]
> {
  const [
    workLogs,
    materials,
  ] = await Promise.all([
    getReportWorkLogs(),
    getReportMaterials(),
  ]);

  const summaries = new Map<
    number,
    ObjectReportSummary
  >();

  for (const workLog of workLogs) {
    const objectId =
      Number(
        workLog.object_id
      );

    if (
      !Number.isInteger(
        objectId
      ) ||
      objectId <= 0
    ) {
      continue;
    }

    const current =
      summaries.get(
        objectId
      ) ?? {
        objectId,
        objectName:
          workLog.object?.name ||
          `Об’єкт #${objectId}`,
        totalHours: 0,
        materialItemsCount: 0,
        totalMaterialCost: 0,
      };

    current.totalHours +=
      Number(
        workLog.hours
      ) || 0;

    summaries.set(
      objectId,
      current
    );
  }

  for (
    const material of materials
  ) {
    const objectId =
      Number(
        material.object_id
      );

    if (
      !Number.isInteger(
        objectId
      ) ||
      objectId <= 0
    ) {
      continue;
    }

    const current =
      summaries.get(
        objectId
      ) ?? {
        objectId,
        objectName:
          material.object?.name ||
          `Об’єкт #${objectId}`,
        totalHours: 0,
        materialItemsCount: 0,
        totalMaterialCost: 0,
      };

    const quantity =
      Number(
        material.quantity
      ) || 0;

    const price =
      Number(
        material.price
      ) || 0;

    current.materialItemsCount +=
      1;

    current.totalMaterialCost +=
      quantity * price;

    summaries.set(
      objectId,
      current
    );
  }

  return Array.from(
    summaries.values()
  ).sort(
    (
      first,
      second
    ) =>
      first.objectName.localeCompare(
        second.objectName,
        "uk"
      )
  );
}

const REPORT_QUERY_PAGE_SIZE =
  1000;

type ReportQueryError = {
  message: string;
};

type ReportQueryPage<T> = {
  data: T[] | null;
  error:
    | ReportQueryError
    | null;
};

type ReportObjectRow = {
  id: number;
  name: string;
  cost_budget: number | null;
  client_price: number | null;
};

type ReportEmployeeRow = {
  id: number;
  first_name: string;
  last_name: string;
};

type ReportWarehouseItemRow = {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  min_quantity: number;
  target_quantity: number | null;
  purchase_price: number;
  supplier: string | null;
};

type ReportWorkLogRow = {
  id: number;
  object_id: number;
  employee_id: number | null;
  work_date: string;
  workers: string | null;
  hours: number;
  hourly_rate: number;
};

type ReportMaterialRow = {
  id: number;
  object_id: number;
  quantity: number;
  price: number;
  created_at: string;
};

type ReportExpenseRow = {
  id: number;
  object_id: number;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
};

type ReportPaymentRow = {
  id: number;
  object_id: number;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
  created_at: string;
};

type ReportPaymentScheduleRow = {
  id: number;
  object_id: number;
  title: string;
  due_date: string;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type ReportPurchaseRow = {
  id: number;
  item_id: number;
  quantity: number;
  purchase_price: number;
  supplier: string | null;
  note: string | null;
  status:
    | "Заплановано"
    | "Закуплено";
  created_at: string;
  purchased_at: string | null;
};

type ReportLifetimeWorkLogRow = {
  id: number;
  object_id: number;
  hours: number;
  hourly_rate: number;
};

type ReportLifetimeMaterialRow = {
  id: number;
  object_id: number;
  quantity: number;
  price: number;
};

type ReportLifetimeExpenseRow = {
  id: number;
  object_id: number;
  amount: number;
};

type ReportLifetimePaymentRow = {
  id: number;
  object_id: number;
  amount: number;
};

type ReportEquipmentServiceRow = {
  id: number;
  equipment_id: number;
  service_type:
    ReportEquipmentServiceDetail["serviceType"];
  service_date: string;
  cost: number;
  performed_by: string | null;
  description: string | null;
  usage_reading: number | null;
  usage_type_snapshot:
    ReportEquipmentServiceDetail["usageType"];
  voided_at: string | null;
  void_reason: string | null;
  equipment: {
    id: number;
    name: string;
    inventory_number: string | null;
  } | null;
};

type InternalEquipmentCost = {
  equipmentId: number;
  equipmentName: string;
  inventoryNumber: string | null;
  periodPlannedInCents: number;
  periodOtherInCents: number;
  lifetimePlannedInCents: number;
  lifetimeOtherInCents: number;
};

type LifetimeObjectCost = {
  materialsCost: number;
  laborCost: number;
  otherExpensesCost: number;
};

type InternalObjectCost =
  ReportObjectCost & {
    hasData: boolean;
  };

type InternalEmployeeWork =
  Omit<
    ReportEmployeeWork,
    "objectsCount"
  > & {
    objectIds: Set<number>;
  };

function getPositiveInteger(
  value: string | undefined
) {
  const parsed =
    Number(value);

  return Number.isInteger(
    parsed
  ) && parsed > 0
    ? parsed
    : null;
}

function toSafeNumber(
  value: unknown
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

async function fetchAllReportRows<
  T
>(
  context: string,
  loadPage: (
    from: number,
    to: number
  ) => Promise<
    ReportQueryPage<T>
  >
) {
  const rows: T[] = [];

  for (
    let from = 0;
    ;
    from +=
      REPORT_QUERY_PAGE_SIZE
  ) {
    const {
      data,
      error,
    } = await loadPage(
      from,
      from +
        REPORT_QUERY_PAGE_SIZE -
        1
    );

    if (error) {
      throw new Error(
        `${context}: ${error.message}`
      );
    }

    const pageRows =
      Array.isArray(data)
        ? data
        : [];

    rows.push(...pageRows);

    if (
      pageRows.length <
      REPORT_QUERY_PAGE_SIZE
    ) {
      break;
    }
  }

  return rows;
}

export function normalizeReportsFilters(
  input: ReportsFilterInput,
  now = new Date()
): ReportsFilters {
  const today =
    getKyivDateValue(now);

  const defaultFrom =
    `${today.slice(0, 7)}-01`;

  const dateFrom =
    input.from &&
    isValidDateValue(
      input.from
    )
      ? input.from
      : defaultFrom;

  const dateTo =
    input.to &&
    isValidDateValue(
      input.to
    )
      ? input.to
      : today;

  const expenseCategory =
    input.expenseCategory &&
    objectExpenseCategories.includes(
      input.expenseCategory as (typeof objectExpenseCategories)[number]
    )
      ? (input.expenseCategory as (typeof objectExpenseCategories)[number])
      : null;

  const movementType =
    input.movementType ===
      "Прихід" ||
    input.movementType ===
      "Списання"
      ? input.movementType
      : null;

  return {
    dateFrom,
    dateTo,
    objectId:
      getPositiveInteger(
        input.object
      ),
    employeeId:
      getPositiveInteger(
        input.employee
      ),
    expenseCategory,
    movementType,
  };
}

export async function getReportsData(
  filters: ReportsFilters
): Promise<ReportsData> {
  const supabase =
    await createClient();

  const invalidPeriod =
    filters.dateFrom >
    filters.dateTo;

  const timestampFrom =
    getKyivDateStartUtc(
      filters.dateFrom
    );

  const timestampToExclusive =
    getKyivDateStartUtc(
      addDaysToDateValue(
        filters.dateTo,
        1
      )
    );

  if (
    !timestampFrom ||
    !timestampToExclusive
  ) {
    throw new Error(
      "Не вдалося визначити межі звітного періоду."
    );
  }

  const materialLedgerCutover =
    await getMaterialLedgerCutover(
      supabase
    );
  const materialPeriodMode =
    getReportMaterialPeriodMode(
      timestampFrom,
      timestampToExclusive,
      materialLedgerCutover
    );
  const legacyTimestampToExclusive =
    materialLedgerCutover &&
    Date.parse(
      materialLedgerCutover.cutoverAt
    ) <
      Date.parse(
        timestampToExclusive
      )
      ? materialLedgerCutover.cutoverAt
      : timestampToExclusive;
  const hasLegacyPeriodSegment =
    !invalidPeriod &&
    materialPeriodMode === "legacy" &&
    Date.parse(timestampFrom) <
      Date.parse(
        legacyTimestampToExclusive
      );

  const loadObjects = () =>
    fetchAllReportRows<
      ReportObjectRow
    >(
      "Не вдалося завантажити об’єкти для звіту",
      async (
        from,
        to
      ) =>
        await supabase
          .from("objects")
          .select(`
            id,
            name,
            cost_budget,
            client_price
          `)
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportObjectRow[]
          >()
    );

  const loadEmployees = () =>
    fetchAllReportRows<
      ReportEmployeeRow
    >(
      "Не вдалося завантажити працівників для звіту",
      async (
        from,
        to
      ) =>
        await supabase
          .from("employees")
          .select(`
            id,
            first_name,
            last_name
          `)
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportEmployeeRow[]
          >()
    );

  const loadWarehouseItems = () =>
    fetchAllReportRows<
      ReportWarehouseItemRow
    >(
      "Не вдалося завантажити залишки складу для звіту",
      async (
        from,
        to
      ) =>
        await supabase
          .from(
            "warehouse_items"
          )
          .select(`
            id,
            name,
            category,
            quantity,
            unit,
            min_quantity,
            target_quantity,
            purchase_price,
            supplier
          `)
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportWarehouseItemRow[]
          >()
    );

  const loadWorkLogs = () =>
    fetchAllReportRows<
      ReportWorkLogRow
    >(
      "Не вдалося завантажити роботи для звіту",
      async (
        from,
        to
      ) => {
        let query =
          supabase
            .from("work_logs")
            .select(`
              id,
              object_id,
              employee_id,
              work_date,
              workers,
              hours,
              hourly_rate
            `)
            .gte(
              "work_date",
              filters.dateFrom
            )
            .lte(
              "work_date",
              filters.dateTo
            );

        if (filters.objectId) {
          query = query.eq(
            "object_id",
            filters.objectId
          );
        }

        if (filters.employeeId) {
          query = query.eq(
            "employee_id",
            filters.employeeId
          );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportWorkLogRow[]
          >();
      }
    );

  const loadMaterials = () =>
    fetchAllReportRows<
      ReportMaterialRow
    >(
      "Не вдалося завантажити матеріали для звіту",
      async (
        from,
        to
      ) => {
        let query =
          supabase
            .from("materials")
            .select(`
              id,
              object_id,
              quantity,
              price,
              created_at
            `)
            .gte(
              "created_at",
              timestampFrom
            )
            .lt(
              "created_at",
              legacyTimestampToExclusive
            );

        if (filters.objectId) {
          query = query.eq(
            "object_id",
            filters.objectId
          );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportMaterialRow[]
          >();
      }
    );

  const loadExpenses = () =>
    fetchAllReportRows<
      ReportExpenseRow
    >(
      "Не вдалося завантажити інші витрати для звіту",
      async (
        from,
        to
      ) => {
        let query =
          supabase
            .from(
              "object_expenses"
            )
            .select(`
              id,
              object_id,
              expense_date,
              category,
              description,
              amount,
              note,
              created_by,
              created_by_name
            `)
            .gte(
              "expense_date",
              filters.dateFrom
            )
            .lte(
              "expense_date",
              filters.dateTo
            );

        if (filters.objectId) {
          query = query.eq(
            "object_id",
            filters.objectId
          );
        }

        if (
          filters.expenseCategory
        ) {
          query = query.eq(
            "category",
            filters.expenseCategory
          );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportExpenseRow[]
          >();
      }
    );

  const loadPayments = () =>
    fetchAllReportRows<
      ReportPaymentRow
    >(
      "Не вдалося завантажити платежі клієнтів для звіту",
      async (
        from,
        to
      ) => {
        let query =
          supabase
            .from(
              "object_payments"
            )
            .select(`
              id,
              object_id,
              payment_date,
              amount,
              payment_method,
              note,
              created_at
            `)
            .gte(
              "payment_date",
              filters.dateFrom
            )
            .lte(
              "payment_date",
              filters.dateTo
            );

        if (filters.objectId) {
          query = query.eq(
            "object_id",
            filters.objectId
          );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportPaymentRow[]
          >();
      }
    );

  const loadLifetimePayments = () =>
    fetchAllReportRows<
      ReportLifetimePaymentRow
    >(
      "Не вдалося завантажити повну історію платежів клієнтів",
      async (
        from,
        to
      ) => {
        let query =
          supabase
            .from(
              "object_payments"
            )
            .select(`
              id,
              object_id,
              amount
            `);

        if (filters.objectId) {
          query = query.eq(
            "object_id",
            filters.objectId
          );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportLifetimePaymentRow[]
          >();
      }
    );

  const loadPaymentSchedule = () =>
    fetchAllReportRows<
      ReportPaymentScheduleRow
    >(
      "Не вдалося завантажити графік оплат для звіту",
      async (from, to) => {
        let query =
          supabase
            .from(
              "object_payment_schedule"
            )
            .select(`
              id,
              object_id,
              title,
              due_date,
              amount,
              note,
              created_at,
              updated_at
            `);

        if (filters.objectId) {
          query = query.eq(
            "object_id",
            filters.objectId
          );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportPaymentScheduleRow[]
          >();
      }
    );

  const loadPurchases = (
    status:
      | "Заплановано"
      | "Закуплено"
  ) =>
    fetchAllReportRows<
      ReportPurchaseRow
    >(
      "Не вдалося завантажити закупівлі для звіту",
      async (
        from,
        to
      ) => {
        let query =
          supabase
            .from(
              "warehouse_purchases"
            )
            .select(`
              id,
              item_id,
              quantity,
              purchase_price,
              supplier,
              note,
              status,
              created_at,
              purchased_at
            `)
            .eq("status", status);

        if (
          status === "Закуплено"
        ) {
          query = query
            .gte(
              "purchased_at",
              timestampFrom
            )
            .lt(
              "purchased_at",
              timestampToExclusive
            );
        } else {
          query = query
            .gte(
              "created_at",
              timestampFrom
            )
            .lt(
              "created_at",
              timestampToExclusive
            );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportPurchaseRow[]
          >();
      }
    );

  const loadWarehousePlanningPurchases = () =>
    fetchAllReportRows<
      ReportPurchaseRow
    >(
      "Не вдалося завантажити актуальні дані закупівель для залишків складу",
      async (
        from,
        to
      ) =>
        await supabase
          .from(
            "warehouse_purchases"
          )
          .select(`
            id,
            item_id,
            quantity,
            purchase_price,
            supplier,
            note,
            status,
            created_at,
            purchased_at
          `)
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportPurchaseRow[]
          >()
    );

  const loadEquipmentServiceRecords = () =>
    fetchAllReportRows<
      ReportEquipmentServiceRow
    >(
      "Не вдалося завантажити витрати на техніку для звіту",
      async (from, to) =>
        await supabase
          .from(
            "equipment_service_records"
          )
          .select(`
            id,
            equipment_id,
            service_type,
            service_date,
            cost,
            performed_by,
            description,
            usage_reading,
            usage_type_snapshot,
            voided_at,
            void_reason,
            equipment:equipment (
              id,
              name,
              inventory_number
            )
          `)
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportEquipmentServiceRow[]
          >()
    );

  const loadLifetimeWorkLogs = (
    objectIds: number[]
  ) =>
    fetchAllReportRows<
      ReportLifetimeWorkLogRow
    >(
      "Не вдалося завантажити повну історію робіт для фінансів об’єктів",
      async (
        from,
        to
      ) =>
        await supabase
          .from("work_logs")
          .select(`
            id,
            object_id,
            hours,
            hourly_rate
          `)
          .in(
            "object_id",
            objectIds
          )
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportLifetimeWorkLogRow[]
          >()
    );

  const loadLifetimeMaterials = (
    objectIds: number[]
  ) =>
    fetchAllReportRows<
      ReportLifetimeMaterialRow
    >(
      "Не вдалося завантажити повну історію матеріалів для фінансів об’єктів",
      async (
        from,
        to
      ) =>
        await supabase
          .from("materials")
          .select(`
            id,
            object_id,
            quantity,
            price
          `)
          .in(
            "object_id",
            objectIds
          )
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportLifetimeMaterialRow[]
          >()
    );

  const loadLifetimeExpenses = (
    objectIds: number[]
  ) =>
    fetchAllReportRows<
      ReportLifetimeExpenseRow
    >(
      "Не вдалося завантажити повну історію інших витрат для фінансів об’єктів",
      async (
        from,
        to
      ) =>
        await supabase
          .from(
            "object_expenses"
          )
          .select(`
            id,
            object_id,
            amount
          `)
          .in(
            "object_id",
            objectIds
          )
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportLifetimeExpenseRow[]
          >()
    );

  const emptyRows =
    <T,>() =>
      Promise.resolve(
        [] as T[]
      );

  const [
    objects,
    employees,
    warehouseItems,
    workLogs,
    materials,
    expenses,
    payments,
    lifetimePayments,
    paymentSchedule,
    plannedPurchases,
    purchasedPurchases,
    materialLedger,
    warehousePlanningPurchases,
    equipmentServiceRows,
  ] = await Promise.all([
    loadObjects(),
    loadEmployees(),
    loadWarehouseItems(),
    invalidPeriod
      ? emptyRows<
          ReportWorkLogRow
        >()
      : loadWorkLogs(),
    !hasLegacyPeriodSegment
      ? emptyRows<
          ReportMaterialRow
        >()
      : loadMaterials(),
    invalidPeriod
      ? emptyRows<
          ReportExpenseRow
        >()
      : loadExpenses(),
    invalidPeriod
      ? emptyRows<
          ReportPaymentRow
        >()
      : loadPayments(),
    loadLifetimePayments(),
    loadPaymentSchedule(),
    invalidPeriod
      ? emptyRows<
          ReportPurchaseRow
        >()
      : loadPurchases(
          "Заплановано"
        ),
    invalidPeriod
      ? emptyRows<
          ReportPurchaseRow
        >()
      : loadPurchases(
          "Закуплено"
        ),
    invalidPeriod
      ? Promise.resolve({
          cutover:
            materialLedgerCutover,
          periodMode:
            materialPeriodMode,
          costs: [],
          movements: [],
        })
      : getMaterialLedgerReport(
          {
            timestampFrom,
            timestampToExclusive,
            objectId:
              filters.objectId,
            movementType:
              filters.movementType,
          },
          materialLedgerCutover
        ),
    loadWarehousePlanningPurchases(),
    loadEquipmentServiceRecords(),
  ]);

  const objectNames =
    new Map(
      objects.map(
        (object) => [
          Number(object.id),
          object.name,
        ]
      )
    );

  const objectFinancialParameters =
    new Map(
      objects.map(
        (object) => [
          Number(object.id),
          {
            costBudget:
              object.cost_budget,
            clientPrice:
              object.client_price,
          },
        ]
      )
    );

  const lifetimePaymentTotalsInCents =
    new Map<number, number>();

  lifetimePayments.forEach(
    (payment) => {
      const objectId =
        Number(
          payment.object_id
        );

      if (
        !Number.isInteger(
          objectId
        ) || objectId <= 0
      ) {
        return;
      }

      lifetimePaymentTotalsInCents.set(
        objectId,
        (lifetimePaymentTotalsInCents.get(
          objectId
        ) || 0) +
          Math.max(
            toMoneyInCents(
              toSafeNumber(
                payment.amount
              )
            ),
            0
          )
      );
    }
  );

  const lifetimePaymentTotals =
    new Map(
      Array.from(
        lifetimePaymentTotalsInCents.entries()
      ).map(
        ([objectId, total]) => [
          objectId,
          fromMoneyInCents(
            total
          ),
        ]
      )
    );

  const objectPaymentSummaries =
    new Map<
      number,
      ReturnType<
        typeof calculateObjectPaymentSummary
      >
    >();

  objects.forEach(
    (object) => {
      const objectId =
        Number(object.id);

      objectPaymentSummaries.set(
        objectId,
        calculateObjectPaymentSummary(
          object.client_price,
          [
            lifetimePaymentTotals.get(
              objectId
            ) || 0,
          ]
        )
      );
    }
  );
  const reportToday =
    getKyivDateValue();
  const scheduleByObject =
    new Map<
      number,
      ReportPaymentScheduleRow[]
    >();

  for (const item of paymentSchedule) {
    const objectId = Number(
      item.object_id
    );

    if (
      !Number.isInteger(objectId) ||
      objectId <= 0
    ) {
      continue;
    }

    const current =
      scheduleByObject.get(
        objectId
      ) || [];
    current.push(item);
    scheduleByObject.set(
      objectId,
      current
    );
  }

  const allocatedPaymentSchedule =
    Array.from(
      scheduleByObject.entries()
    ).flatMap(
      ([objectId, items]) =>
        calculateObjectPaymentSchedule(
          items,
          lifetimePaymentTotals.get(
            objectId
          ) || 0,
          objectFinancialParameters.get(
            objectId
          )?.clientPrice ?? null,
          reportToday
        ).items
    );
  const overdueScheduleAmount =
    fromMoneyInCents(
      allocatedPaymentSchedule.reduce(
        (total, item) =>
          total +
          toMoneyInCents(
            item.overdueAmount
          ),
        0
      )
    );
  const financeObjectsForKpi =
    filters.objectId
      ? objects.filter(
          (object) =>
            Number(
              object.id
            ) ===
            filters.objectId
        )
      : objects;
  const outstandingReceivables =
    financeObjectsForKpi.reduce(
      (total, object) => {
        if (
          object.client_price ===
          null
        ) {
          return total;
        }

        return (
          total +
          (objectPaymentSummaries.get(
            Number(object.id)
          )?.remainingToPay ||
            0)
        );
      },
      0
    );
  const objectsWithoutClientPrice =
    financeObjectsForKpi.filter(
      (object) =>
        object.client_price ===
        null
    ).length;

  const employeeNames =
    new Map(
      employees.map(
        (employee) => [
          Number(employee.id),
          [
            employee.last_name,
            employee.first_name,
          ]
            .filter(Boolean)
            .join(" ") ||
            `Працівник #${employee.id}`,
        ]
      )
    );

  const warehouseItemDetails =
    new Map(
      warehouseItems.map(
        (item) => [
          Number(item.id),
          {
            name:
              item.name,
            unit:
              item.unit,
          },
        ]
      )
    );

  const objectOptions:
    ReportObjectOption[] =
    objects
      .map((object) => ({
        id:
          Number(object.id),
        name:
          object.name,
      }))
      .sort((first, second) =>
        first.name.localeCompare(
          second.name,
          "uk"
        )
      );

  const employeeOptions:
    ReportEmployeeOption[] =
    employees
      .map((employee) => ({
        id:
          Number(employee.id),
        name:
          employeeNames.get(
            Number(employee.id)
          ) ||
          `Працівник #${employee.id}`,
      }))
      .sort((first, second) =>
        first.name.localeCompare(
          second.name,
          "uk"
        )
      );

  const objectCostMap =
    new Map<
      number,
      InternalObjectCost
    >();

  const getObjectCost = (
    objectId: number
  ) => {
    const existing =
      objectCostMap.get(
        objectId
      );

    if (existing) {
      return existing;
    }

    const created:
      InternalObjectCost = {
      objectId,
      objectName:
        objectNames.get(
          objectId
        ) ||
        `Об’єкт #${objectId}`,
      materialsCost: 0,
      laborCost: 0,
      otherExpensesCost: 0,
      totalCost: 0,
      hours: 0,
      periodPaymentsReceived: 0,
      costBudget:
        objectFinancialParameters.get(
          objectId
        )?.costBudget ?? null,
      clientPrice:
        objectFinancialParameters.get(
          objectId
          )?.clientPrice ?? null,
      lifetimeMaterialsCost: 0,
      lifetimeLaborCost: 0,
      lifetimeOtherExpensesCost: 0,
      lifetimeActualCost: 0,
      budgetRemaining: null,
      budgetOverrun: null,
      financialResult: null,
      marginPercent: null,
      lifetimePaid: 0,
      remainingToPay: null,
      overpayment: null,
      paymentStatus:
        "price_missing",
      hasData: false,
    };

    objectCostMap.set(
      objectId,
      created
    );

    return created;
  };

  let totalHours = 0;
  let laborCost = 0;

  const employeeWorkMap =
    new Map<
      string,
      InternalEmployeeWork
    >();

  workLogs.forEach(
    (workLog) => {
      const objectId =
        Number(
          workLog.object_id
        );

      if (
        !Number.isInteger(
          objectId
        ) || objectId <= 0
      ) {
        return;
      }

      const hours =
        toSafeNumber(
          workLog.hours
        );

      const hourlyRate =
        toSafeNumber(
          workLog.hourly_rate
        );

      const cost =
        hours * hourlyRate;

      totalHours += hours;
      laborCost += cost;

      const objectCost =
        getObjectCost(objectId);

      objectCost.hours +=
        hours;
      objectCost.laborCost +=
        cost;
      objectCost.hasData =
        true;

      const employeeId =
        workLog.employee_id
          ? Number(
              workLog.employee_id
            )
          : null;

      const employeeKey =
        employeeId
          ? String(employeeId)
          : "unassigned";

      const currentEmployee =
        employeeWorkMap.get(
          employeeKey
        ) || {
          employeeId,
          employeeName:
            employeeId
              ? employeeNames.get(
                  employeeId
                ) ||
                workLog.workers
                  ?.trim() ||
                `Працівник #${employeeId}`
              : "Без прив’язаного працівника",
          recordsCount: 0,
          hours: 0,
          laborCost: 0,
          objectIds:
            new Set<number>(),
        };

      currentEmployee.recordsCount +=
        1;
      currentEmployee.hours +=
        hours;
      currentEmployee.laborCost +=
        cost;
      currentEmployee.objectIds.add(
        objectId
      );

      employeeWorkMap.set(
        employeeKey,
        currentEmployee
      );
    }
  );

  let exactMaterialsCostInCents = 0;

  materialLedger.costs.forEach(
    (ledgerCost) => {
      const objectId =
        Number(
          ledgerCost.objectId
        );

      if (
        !Number.isInteger(
          objectId
        ) || objectId <= 0
      ) {
        return;
      }

      const costInCents =
        toMoneyInCents(
          ledgerCost.periodExactCost
        );

      exactMaterialsCostInCents +=
        costInCents;

      if (
        costInCents !== 0 ||
        ledgerCost.periodMovementCount >
          0
      ) {
        const objectCost =
          getObjectCost(objectId);

        objectCost.materialsCost =
          fromMoneyInCents(
            toMoneyInCents(
              objectCost.materialsCost
            ) + costInCents
          );
        objectCost.hasData = true;
      }
    }
  );

  let legacyMaterialsCostInCents = 0;

  materials.forEach(
    (material) => {
      const objectId =
        Number(
          material.object_id
        );

      if (
        !Number.isInteger(
          objectId
        ) || objectId <= 0
      ) {
        return;
      }

      const costInCents =
        toMoneyInCents(
          toSafeNumber(
            material.quantity
          ) *
            toSafeNumber(
              material.price
            )
        );

      legacyMaterialsCostInCents +=
        costInCents;

      const objectCost =
        getObjectCost(objectId);

      objectCost.materialsCost =
        fromMoneyInCents(
          toMoneyInCents(
            objectCost.materialsCost
          ) + costInCents
        );
      objectCost.hasData =
        true;
    }
  );

  const exactMaterialsCost =
    fromMoneyInCents(
      exactMaterialsCostInCents
    );
  const legacyMaterialsCost =
    fromMoneyInCents(
      legacyMaterialsCostInCents
    );
  const materialsCost =
    fromMoneyInCents(
      exactMaterialsCostInCents +
        legacyMaterialsCostInCents
    );

  let otherExpensesCost = 0;

  expenses.forEach(
    (expense) => {
      const objectId =
        Number(
          expense.object_id
        );

      if (
        !Number.isInteger(
          objectId
        ) || objectId <= 0
      ) {
        return;
      }

      const amount =
        toSafeNumber(
          expense.amount
        );

      otherExpensesCost +=
        amount;

      const objectCost =
        getObjectCost(objectId);

      objectCost.otherExpensesCost +=
        amount;
      objectCost.hasData =
        true;
    }
  );

  payments.forEach((payment) => {
    const objectId = Number(
      payment.object_id
    );

    if (
      !Number.isInteger(objectId) ||
      objectId <= 0
    ) {
      return;
    }

    const objectCost =
      getObjectCost(objectId);
    objectCost.periodPaymentsReceived =
      fromMoneyInCents(
        toMoneyInCents(
          objectCost.periodPaymentsReceived
        ) +
          toMoneyInCents(
            toSafeNumber(
              payment.amount
            )
          )
      );
    objectCost.hasData = true;
  });

  const periodObjectCosts =
    Array.from(
      objectCostMap.values()
    ).filter(
      (objectCost) =>
        objectCost.hasData
    );
  const reportObjectIds =
    periodObjectCosts.map(
      (objectCost) =>
        objectCost.objectId
    );
  const reportObjectIdSet =
    new Set(reportObjectIds);
  const [
    lifetimeWorkLogs,
    lifetimeMaterials,
    lifetimeExpenses,
  ] =
    reportObjectIds.length > 0
      ? await Promise.all([
          loadLifetimeWorkLogs(
            reportObjectIds
          ),
          materialLedgerCutover
            ? emptyRows<
                ReportLifetimeMaterialRow
              >()
            : loadLifetimeMaterials(
                reportObjectIds
              ),
          loadLifetimeExpenses(
            reportObjectIds
          ),
        ])
      : [[], [], []];
  const lifetimeCostMap =
    new Map<
      number,
      LifetimeObjectCost
    >();
  const getLifetimeCost = (
    objectId: number
  ) => {
    const existing =
      lifetimeCostMap.get(
        objectId
      );

    if (existing) {
      return existing;
    }

    const created:
      LifetimeObjectCost = {
      materialsCost: 0,
      laborCost: 0,
      otherExpensesCost: 0,
    };

    lifetimeCostMap.set(
      objectId,
      created
    );

    return created;
  };

  if (materialLedgerCutover) {
    materialLedger.costs.forEach(
      (ledgerCost) => {
        const objectId = Number(
          ledgerCost.objectId
        );

        if (
          reportObjectIdSet.has(
            objectId
          )
        ) {
          getLifetimeCost(
            objectId
          ).materialsCost =
            ledgerCost.lifetimeExactCost;
        }
      }
    );
  }

  lifetimeMaterials.forEach(
    (material) => {
      const cost =
        getLifetimeCost(
          Number(
            material.object_id
          )
        );

      cost.materialsCost +=
        toSafeNumber(
          material.quantity
        ) *
        toSafeNumber(
          material.price
        );
    }
  );

  lifetimeWorkLogs.forEach(
    (workLog) => {
      const cost =
        getLifetimeCost(
          Number(
            workLog.object_id
          )
        );

      cost.laborCost +=
        toSafeNumber(
          workLog.hours
        ) *
        toSafeNumber(
          workLog.hourly_rate
        );
    }
  );

  lifetimeExpenses.forEach(
    (expense) => {
      const cost =
        getLifetimeCost(
          Number(
            expense.object_id
          )
        );

      cost.otherExpensesCost +=
        toSafeNumber(
          expense.amount
        );
    }
  );

  const objectCosts:
    ReportObjectCost[] =
    periodObjectCosts
      .map((objectCost) => {
        const lifetimeCost =
          lifetimeCostMap.get(
            objectCost.objectId
          ) || {
            materialsCost: 0,
            laborCost: 0,
            otherExpensesCost: 0,
          };
        const financials =
          calculateObjectFinancials({
            ...lifetimeCost,
            costBudget:
              objectCost.costBudget,
            clientPrice:
              objectCost.clientPrice,
          });
        const paymentSummary =
          objectPaymentSummaries.get(
            objectCost.objectId
          ) ||
          calculateObjectPaymentSummary(
            objectCost.clientPrice,
            []
          );

        return {
          objectId:
            objectCost.objectId,
          objectName:
            objectCost.objectName,
          materialsCost:
            objectCost.materialsCost,
          laborCost:
            objectCost.laborCost,
          otherExpensesCost:
            objectCost.otherExpensesCost,
          totalCost:
            objectCost.materialsCost +
            objectCost.laborCost +
            objectCost.otherExpensesCost,
          hours:
            objectCost.hours,
          periodPaymentsReceived:
            objectCost.periodPaymentsReceived,
          costBudget:
            financials.costBudget,
          clientPrice:
            financials.clientPrice,
          lifetimeMaterialsCost:
            lifetimeCost.materialsCost,
          lifetimeLaborCost:
            lifetimeCost.laborCost,
          lifetimeOtherExpensesCost:
            lifetimeCost.otherExpensesCost,
          lifetimeActualCost:
            financials.actualCost,
          budgetRemaining:
            financials.budgetRemaining,
          budgetOverrun:
            financials.budgetOverrun,
          financialResult:
            financials.financialResult,
          marginPercent:
            financials.marginPercent,
          lifetimePaid:
            paymentSummary.totalPaid,
          remainingToPay:
            paymentSummary.remainingToPay,
          overpayment:
            paymentSummary.overpayment,
          paymentStatus:
            paymentSummary.status,
        };
      })
      .sort(
        (first, second) =>
          second.totalCost -
            first.totalCost ||
          first.objectName.localeCompare(
            second.objectName,
            "uk"
          )
      );

  const employeeWork:
    ReportEmployeeWork[] =
    Array.from(
      employeeWorkMap.values()
    )
      .map((employee) => ({
        employeeId:
          employee.employeeId,
        employeeName:
          employee.employeeName,
        recordsCount:
          employee.recordsCount,
        hours:
          employee.hours,
        laborCost:
          employee.laborCost,
        objectsCount:
          employee.objectIds.size,
      }))
      .sort(
        (first, second) =>
          second.laborCost -
            first.laborCost ||
          second.hours -
            first.hours ||
          first.employeeName.localeCompare(
            second.employeeName,
            "uk"
          )
      );

  const expenseCategoryMap =
    new Map<
      string,
      {
        recordsCount: number;
        amount: number;
      }
    >();

  expenses.forEach(
    (expense) => {
      const current =
        expenseCategoryMap.get(
          expense.category
        ) || {
          recordsCount: 0,
          amount: 0,
        };

      current.recordsCount +=
        1;
      current.amount +=
        toSafeNumber(
          expense.amount
        );

      expenseCategoryMap.set(
        expense.category,
        current
      );
    }
  );

  const selectedCategories =
    filters.expenseCategory
      ? [
          filters.expenseCategory,
        ]
      : [
          ...objectExpenseCategories,
        ];

  const expenseCategories:
    ReportExpenseCategory[] =
    selectedCategories
      .map((category) => {
        const current =
          expenseCategoryMap.get(
            category
          ) || {
            recordsCount: 0,
            amount: 0,
          };

        return {
          category,
          recordsCount:
            current.recordsCount,
          amount:
            current.amount,
          share:
            otherExpensesCost > 0
              ? current.amount /
                otherExpensesCost
              : 0,
        };
      })
      .sort(
        (first, second) =>
          second.amount -
            first.amount ||
          first.category.localeCompare(
            second.category,
            "uk"
          )
      );

  const expenseHighlights:
    ReportExpenseHighlight[] =
    expenses
      .map((expense) => ({
        id:
          Number(expense.id),
        objectId:
          Number(
            expense.object_id
          ),
        objectName:
          objectNames.get(
            Number(
              expense.object_id
            )
          ) ||
          `Об’єкт #${expense.object_id}`,
        expenseDate:
          expense.expense_date,
        category:
          expense.category,
        description:
          expense.description,
        amount:
          toSafeNumber(
            expense.amount
          ),
      }))
      .sort(
        (first, second) =>
          second.amount -
            first.amount ||
          second.expenseDate.localeCompare(
            first.expenseDate
          )
      )
      .slice(0, 5);

  const expenseDetails:
    ReportExpenseDetail[] =
    expenses
      .map((expense) => ({
        id:
          Number(expense.id),
        expenseDate:
          expense.expense_date,
        objectName:
          objectNames.get(
            Number(
              expense.object_id
            )
          ) ||
          `Об’єкт #${expense.object_id}`,
        category:
          expense.category,
        description:
          expense.description,
        amount:
          toSafeNumber(
            expense.amount
          ),
        note:
          expense.note,
        createdBy:
          expense.created_by_name ||
          (expense.created_by
            ? "Користувач"
            : null),
      }))
      .sort(
        (first, second) =>
          second.expenseDate.localeCompare(
            first.expenseDate
          ) ||
          second.id - first.id
      );

  const paymentDetails:
    ReportPaymentDetail[] =
    payments
      .slice()
      .sort(
        (first, second) =>
          second.payment_date.localeCompare(
            first.payment_date
          ) ||
          second.created_at.localeCompare(
            first.created_at
          ) ||
          Number(second.id) -
            Number(first.id)
      )
      .map((payment) => ({
        id: Number(
          payment.id
        ),
        objectId: Number(
          payment.object_id
        ),
        objectName:
          objectNames.get(
            Number(
              payment.object_id
            )
          ) ||
          `Об’єкт #${payment.object_id}`,
        paymentDate:
          payment.payment_date,
        amount:
          toSafeNumber(
            payment.amount
          ),
        paymentMethod:
          payment.payment_method,
        note: payment.note,
      }));
  const paymentsReceived =
    calculateObjectPaymentSummary(
      null,
      paymentDetails.map(
        (payment) =>
          payment.amount
      )
    ).totalPaid;
  const paymentScheduleDetails:
    ReportPaymentScheduleDetail[] =
    invalidPeriod
      ? []
      : allocatedPaymentSchedule
          .filter(
            (item) =>
              item.due_date >=
                filters.dateFrom &&
              item.due_date <=
                filters.dateTo
          )
          .sort(
            (first, second) =>
              first.due_date.localeCompare(
                second.due_date
              ) ||
              first.created_at.localeCompare(
                second.created_at
              ) ||
              first.id - second.id
          )
          .map((item) => ({
            id: item.id,
            objectId:
              item.object_id,
            objectName:
              objectNames.get(
                item.object_id
              ) ||
              `Об’єкт #${item.object_id}`,
            title: item.title,
            dueDate:
              item.due_date,
            plannedAmount:
              item.amount,
            paidAmount:
              item.paidAmount,
            remainingAmount:
              item.remainingAmount,
            status: item.status,
            note: item.note,
          }));

  const plannedAmount =
    fromMoneyInCents(
      plannedPurchases.reduce(
        (total, purchase) =>
          total +
          toMoneyInCents(
            toSafeNumber(
              purchase.quantity
            ) *
              toSafeNumber(
                purchase.purchase_price
              )
          ),
        0
      )
    );

  const purchasedAmount =
    fromMoneyInCents(
      purchasedPurchases.reduce(
        (total, purchase) =>
          total +
          toMoneyInCents(
            toSafeNumber(
              purchase.quantity
            ) *
              toSafeNumber(
                purchase.purchase_price
              )
          ),
        0
      )
    );

  const purchaseExportRows:
    ReportPurchaseExportRow[] =
    [
      ...plannedPurchases,
      ...purchasedPurchases,
    ]
      .map((purchase) => {
        const item =
          warehouseItemDetails.get(
            Number(
              purchase.item_id
            )
          );

        const quantity =
          toSafeNumber(
            purchase.quantity
          );

        const unitPrice =
          toSafeNumber(
            purchase.purchase_price
          );

        return {
          material:
            item?.name ||
            `Матеріал #${purchase.item_id}`,
          status:
            purchase.status,
          quantity,
          unit:
            item?.unit || "",
          unitPrice,
          totalAmount:
            fromMoneyInCents(
              toMoneyInCents(
                quantity * unitPrice
              )
            ),
          supplier:
            purchase.supplier,
          createdAt:
            purchase.created_at,
          purchasedAt:
            purchase.purchased_at,
          note:
            purchase.note,
        };
      })
      .sort((first, second) =>
        (
          second.purchasedAt ||
          second.createdAt
        ).localeCompare(
          first.purchasedAt ||
          first.createdAt
        )
      );

  let incomeCount = 0;
  let writeOffCount = 0;
  let incomeValue = 0;
  let writeOffValue = 0;

  const normalizedMovements =
    materialLedger.movements;
  const warehouseIncomeCodes =
    new Set([
      "legacy_receipt",
      "purchase_receipt",
      "return_from_object",
      "adjustment_in",
    ]);
  const warehouseWriteOffCodes =
    new Set([
      "legacy_write_off",
      "issue_to_object",
      "adjustment_out",
    ]);

  normalizedMovements.forEach(
    (movement) => {
      if (
        warehouseIncomeCodes.has(
          movement.movementCode
        )
      ) {
        incomeCount += 1;
        incomeValue +=
          movement.totalValue;
      } else if (
        warehouseWriteOffCodes.has(
          movement.movementCode
        )
      ) {
        writeOffCount += 1;
        writeOffValue +=
          movement.totalValue;
      }
    }
  );

  const warehousePurchaseInsights =
    buildWarehousePurchaseInsights(
      warehousePlanningPurchases
    );

  const warehouseSnapshotRows:
    ReportWarehouseSnapshotRow[] =
    warehouseItems
      .map((item) => {
        const stockQuantity =
          toSafeNumber(
            item.quantity
          );

        const averagePrice =
          toSafeNumber(
            item.purchase_price
          );
        const purchaseInsight =
          getWarehousePurchaseInsight(
            warehousePurchaseInsights,
            Number(item.id)
          );
        const stockPlan =
          getWarehouseStockPlan(
            item,
            purchaseInsight.plannedQuantity
          );

        return {
          material:
            item.name,
          category:
            item.category,
          stockQuantity,
          unit:
            item.unit,
          minimumQuantity:
            toSafeNumber(
              item.min_quantity
            ),
          targetQuantity:
            stockPlan.targetQuantity,
          targetShortage:
            stockPlan.rawShortage,
          plannedIncoming:
            stockPlan.plannedIncoming,
          remainingRecommended:
            stockPlan.remainingRecommended,
          averagePrice,
          lastPurchasePrice:
            purchaseInsight.lastPurchasePrice,
          stockValue:
            stockQuantity *
            averagePrice,
          supplier:
            item.supplier,
        };
      })
      .sort((first, second) =>
        first.material.localeCompare(
          second.material,
          "uk"
        )
      );

  const currentStockValue =
    warehouseSnapshotRows.reduce(
      (total, item) =>
        total +
        item.stockValue,
      0
    );

  const currentLowStockCount =
    warehouseSnapshotRows.filter(
      (item) =>
        item.stockQuantity <=
        item.minimumQuantity
    ).length;

  const sumScheduleMoney = (
    select: (
      item: (typeof allocatedPaymentSchedule)[number]
    ) => number
  ) =>
    fromMoneyInCents(
      allocatedPaymentSchedule.reduce(
        (total, item) =>
          total +
          toMoneyInCents(
            select(item)
          ),
        0
      )
    );

  const paymentScheduleSummary = {
    plannedAmount:
      sumScheduleMoney((item) =>
        item.status === "planned" ||
        item.status ===
          "partially_paid"
          ? item.remainingAmount
          : 0
      ),
    paidAmount:
      sumScheduleMoney(
        (item) => item.paidAmount
      ),
    dueTodayAmount:
      sumScheduleMoney((item) =>
        item.status === "due_today"
          ? item.remainingAmount
          : 0
      ),
    overdueAmount:
      overdueScheduleAmount,
  };

  const equipmentServiceHistory:
    ReportEquipmentServiceDetail[] =
    equipmentServiceRows.map(
      (record) => ({
        id: Number(record.id),
        equipmentId: Number(
          record.equipment_id
        ),
        equipmentName:
          record.equipment?.name ||
          `Техніка #${record.equipment_id}`,
        inventoryNumber:
          record.equipment
            ?.inventory_number || null,
        serviceDate:
          record.service_date,
        serviceType:
          record.service_type,
        cost: toSafeNumber(
          record.cost
        ),
        usageReading:
          record.usage_reading === null
            ? null
            : toSafeNumber(
                record.usage_reading
              ),
        usageType:
          record.usage_type_snapshot,
        performedBy:
          record.performed_by,
        description:
          record.description,
        status: record.voided_at
          ? "voided"
          : "active",
        voidReason:
          record.void_reason,
      })
    );
  const equipmentServiceDetails =
    equipmentServiceHistory.filter(
      (record) =>
        record.serviceDate >=
          filters.dateFrom &&
        record.serviceDate <=
          filters.dateTo
    );
  const equipmentCostMap =
    new Map<
      number,
      InternalEquipmentCost
    >();

  for (const record of equipmentServiceHistory) {
    if (record.status === "voided") {
      continue;
    }

    const current =
      equipmentCostMap.get(
        record.equipmentId
      ) || {
        equipmentId:
          record.equipmentId,
        equipmentName:
          record.equipmentName,
        inventoryNumber:
          record.inventoryNumber,
        periodPlannedInCents: 0,
        periodOtherInCents: 0,
        lifetimePlannedInCents: 0,
        lifetimeOtherInCents: 0,
      };
    const costInCents =
      Math.max(
        toMoneyInCents(
          record.cost
        ),
        0
      );
    const planned =
      record.serviceType ===
      "Планове обслуговування";

    if (planned) {
      current.lifetimePlannedInCents +=
        costInCents;
    } else {
      current.lifetimeOtherInCents +=
        costInCents;
    }

    if (
      record.serviceDate >=
        filters.dateFrom &&
      record.serviceDate <=
        filters.dateTo
    ) {
      if (planned) {
        current.periodPlannedInCents +=
          costInCents;
      } else {
        current.periodOtherInCents +=
          costInCents;
      }
    }

    equipmentCostMap.set(
      record.equipmentId,
      current
    );
  }

  const equipmentCosts:
    ReportEquipmentCost[] =
    Array.from(
      equipmentCostMap.values()
    )
      .map((cost) => ({
        equipmentId:
          cost.equipmentId,
        equipmentName:
          cost.equipmentName,
        inventoryNumber:
          cost.inventoryNumber,
        periodPlannedMaintenanceCost:
          fromMoneyInCents(
            cost.periodPlannedInCents
          ),
        periodOtherServiceCost:
          fromMoneyInCents(
            cost.periodOtherInCents
          ),
        periodTotalCost:
          fromMoneyInCents(
            cost.periodPlannedInCents +
              cost.periodOtherInCents
          ),
        lifetimePlannedMaintenanceCost:
          fromMoneyInCents(
            cost.lifetimePlannedInCents
          ),
        lifetimeOtherServiceCost:
          fromMoneyInCents(
            cost.lifetimeOtherInCents
          ),
        lifetimeTotalCost:
          fromMoneyInCents(
            cost.lifetimePlannedInCents +
              cost.lifetimeOtherInCents
          ),
      }))
      .sort((first, second) =>
        second.periodTotalCost -
          first.periodTotalCost ||
        first.equipmentName.localeCompare(
          second.equipmentName,
          "uk"
        )
      );
  const equipmentCostSummary =
    equipmentCosts.reduce(
      (summary, cost) => ({
        periodPlannedMaintenanceCost:
          fromMoneyInCents(
            toMoneyInCents(
              summary.periodPlannedMaintenanceCost
            ) +
              toMoneyInCents(
                cost.periodPlannedMaintenanceCost
              )
          ),
        periodOtherServiceCost:
          fromMoneyInCents(
            toMoneyInCents(
              summary.periodOtherServiceCost
            ) +
              toMoneyInCents(
                cost.periodOtherServiceCost
              )
          ),
        periodTotalCost:
          fromMoneyInCents(
            toMoneyInCents(
              summary.periodTotalCost
            ) +
              toMoneyInCents(
                cost.periodTotalCost
              )
          ),
        lifetimePlannedMaintenanceCost:
          fromMoneyInCents(
            toMoneyInCents(
              summary.lifetimePlannedMaintenanceCost
            ) +
              toMoneyInCents(
                cost.lifetimePlannedMaintenanceCost
              )
          ),
        lifetimeOtherServiceCost:
          fromMoneyInCents(
            toMoneyInCents(
              summary.lifetimeOtherServiceCost
            ) +
              toMoneyInCents(
                cost.lifetimeOtherServiceCost
              )
          ),
        lifetimeTotalCost:
          fromMoneyInCents(
            toMoneyInCents(
              summary.lifetimeTotalCost
            ) +
              toMoneyInCents(
                cost.lifetimeTotalCost
              )
          ),
      }),
      {
        periodPlannedMaintenanceCost: 0,
        periodOtherServiceCost: 0,
        periodTotalCost: 0,
        lifetimePlannedMaintenanceCost: 0,
        lifetimeOtherServiceCost: 0,
        lifetimeTotalCost: 0,
      }
    );

  const exactFromDate =
    materialLedgerCutover
      ? getKyivDateValue(
          new Date(
            materialLedgerCutover.cutoverAt
          )
        )
      : null;
  const materialLimitation =
    materialPeriodMode === "exact"
      ? null
      : materialPeriodMode === "mixed"
        ? "Показано лише підтверджену exact-частину після переходу на Ledger. Legacy-частина цього змішаного періоду не включена, щоб не змішувати несумісні методи й не допустити подвійного обліку."
        : "Історичні матеріальні витрати до переходу на Ledger розраховані за поточними legacy-рядками й можуть відрізнятися від фактичного руху в минулому.";

  return {
    filters,
    invalidPeriod,
    objectOptions,
    employeeOptions,
    kpis: {
      materialsCost,
      laborCost,
      otherExpensesCost,
      totalObjectCost:
        materialsCost +
        laborCost +
        otherExpensesCost,
      totalHours,
      purchasedCost:
        purchasedAmount,
      paymentsReceived,
      outstandingReceivables,
      objectsWithoutClientPrice,
      overdueScheduleAmount,
    },
    materialAccounting: {
      periodMode:
        materialPeriodMode,
      periodTotal:
        materialsCost,
      exactCost:
        exactMaterialsCost,
      legacyApproximateCost:
        materialPeriodMode ===
        "mixed"
          ? null
          : legacyMaterialsCost,
      cutoverAt:
        materialLedgerCutover?.cutoverAt ??
        null,
      exactFromDate,
      lifetimeMethod:
        materialLedgerCutover
          ? "exact_ledger"
          : "legacy_current_balance",
      limitation:
        materialLimitation,
    },
    objectCosts,
    employeeWork,
    expenseCategories,
    expenseHighlights,
    expenseDetails,
    paymentDetails,
    paymentScheduleDetails,
    paymentScheduleSummary,
    purchases: {
      plannedCount:
        plannedPurchases.length,
      plannedAmount,
      purchasedCount:
        purchasedPurchases.length,
      purchasedAmount,
    },
    purchaseExportRows,
    warehouseMovementExportRows:
      normalizedMovements
        .slice()
        .sort((first, second) =>
          second.createdAt.localeCompare(
            first.createdAt
          )
        ),
    warehouseSnapshotRows,
    warehouse: {
      incomeCount,
      writeOffCount,
      incomeValue,
      writeOffValue,
      currentItemsCount:
        warehouseSnapshotRows.length,
      currentLowStockCount,
      currentStockValue,
      recentMovements:
        normalizedMovements
          .sort((first, second) =>
            second.createdAt.localeCompare(
              first.createdAt
            )
          )
          .slice(0, 5),
    },
    equipmentCosts,
    equipmentServiceDetails,
    equipmentServiceHistory,
    equipmentCostSummary,
  };
}
