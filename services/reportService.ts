import { createClient } from "@/lib/supabase/server";

import {
  objectExpenseCategories,
} from "@/constants/objectExpenses";
import {
  calculateObjectFinancials,
} from "@/lib/objectFinancials";

import type { WorkLog } from "@/types/workLog";

import type {
  ReportEmployeeOption,
  ReportEmployeeWork,
  ReportExpenseCategory,
  ReportExpenseDetail,
  ReportExpenseHighlight,
  ReportMovementType,
  ReportObjectCost,
  ReportObjectOption,
  ReportPurchaseExportRow,
  ReportWarehouseMovement,
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

const KYIV_TIME_ZONE =
  "Europe/Kyiv";

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

type ReportPurchaseRow = {
  id: number;
  item_id: number;
  quantity: number;
  purchase_price: number;
  supplier: string | null;
  note: string | null;
  status: string;
  created_at: string;
  purchased_at: string | null;
};

type ReportWarehouseMovementRow = {
  id: number;
  item_id: number;
  object_id: number | null;
  movement_type: ReportMovementType;
  quantity: number;
  note: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  unit_price: number;
  created_at: string;
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

const kyivDateFormatter =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        KYIV_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

const kyivDateTimeFormatter =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        KYIV_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );

function getDateParts(
  formatter: Intl.DateTimeFormat,
  date: Date
) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
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
}

function formatKyivDate(
  date: Date
) {
  const parts =
    getDateParts(
      kyivDateFormatter,
      date
    );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isValidDateValue(
  value: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`
    );

  return (
    !Number.isNaN(
      parsed.getTime()
    ) &&
    parsed
      .toISOString()
      .slice(0, 10) ===
      value
  );
}

function getNextDateValue(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00.000Z`
    );

  date.setUTCDate(
    date.getUTCDate() + 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function getKyivDateStartIso(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  const targetUtc =
    Date.UTC(
      year,
      month - 1,
      day
    );

  let instant = targetUtc;

  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    const parts =
      getDateParts(
        kyivDateTimeFormatter,
        new Date(instant)
      );

    const representedAsUtc =
      Date.UTC(
        Number(parts.year),
        Number(parts.month) -
          1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      );

    const offset =
      representedAsUtc -
      instant;

    instant =
      targetUtc - offset;
  }

  return new Date(
    instant
  ).toISOString();
}

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
    formatKyivDate(now);

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
    getKyivDateStartIso(
      filters.dateFrom
    );

  const timestampToExclusive =
    getKyivDateStartIso(
      getNextDateValue(
        filters.dateTo
      )
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
              timestampToExclusive
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

  const loadMovements = () =>
    fetchAllReportRows<
      ReportWarehouseMovementRow
    >(
      "Не вдалося завантажити рухи складу для звіту",
      async (
        from,
        to
      ) => {
        let query =
          supabase
            .from(
              "warehouse_movements"
            )
            .select(`
              id,
              item_id,
              object_id,
              movement_type,
              quantity,
              note,
              performed_by,
              performed_by_name,
              unit_price,
              created_at
            `)
            .gte(
              "created_at",
              timestampFrom
            )
            .lt(
              "created_at",
              timestampToExclusive
            );

        if (filters.objectId) {
          query = query.eq(
            "object_id",
            filters.objectId
          );
        }

        if (filters.movementType) {
          query = query.eq(
            "movement_type",
            filters.movementType
          );
        }

        return await query
          .order("id", {
            ascending: true,
          })
          .range(from, to)
          .overrideTypes<
            ReportWarehouseMovementRow[]
          >();
      }
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
    plannedPurchases,
    purchasedPurchases,
    movements,
  ] = await Promise.all([
    loadObjects(),
    loadEmployees(),
    loadWarehouseItems(),
    invalidPeriod
      ? emptyRows<
          ReportWorkLogRow
        >()
      : loadWorkLogs(),
    invalidPeriod
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
      ? emptyRows<
          ReportWarehouseMovementRow
        >()
      : loadMovements(),
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
      costBudget:
        objectFinancialParameters.get(
          objectId
        )?.costBudget ?? null,
      clientPrice:
        objectFinancialParameters.get(
          objectId
        )?.clientPrice ?? null,
      lifetimeActualCost: 0,
      budgetRemaining: null,
      budgetOverrun: null,
      financialResult: null,
      marginPercent: null,
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

  let materialsCost = 0;

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

      const cost =
        toSafeNumber(
          material.quantity
        ) *
        toSafeNumber(
          material.price
        );

      materialsCost += cost;

      const objectCost =
        getObjectCost(objectId);

      objectCost.materialsCost +=
        cost;
      objectCost.hasData =
        true;
    }
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
          loadLifetimeMaterials(
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
          costBudget:
            financials.costBudget,
          clientPrice:
            financials.clientPrice,
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

  const plannedAmount =
    plannedPurchases.reduce(
      (total, purchase) =>
        total +
        toSafeNumber(
          purchase.quantity
        ) *
          toSafeNumber(
            purchase.purchase_price
          ),
      0
    );

  const purchasedAmount =
    purchasedPurchases.reduce(
      (total, purchase) =>
        total +
        toSafeNumber(
          purchase.quantity
        ) *
          toSafeNumber(
            purchase.purchase_price
          ),
      0
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
            quantity * unitPrice,
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

  const normalizedMovements:
    ReportWarehouseMovement[] =
    movements.map(
      (movement) => {
        const quantity =
          toSafeNumber(
            movement.quantity
          );

        const unitPrice =
          toSafeNumber(
            movement.unit_price
          );

        const totalValue =
          quantity * unitPrice;

        if (
          movement.movement_type ===
          "Прихід"
        ) {
          incomeCount += 1;
          incomeValue +=
            totalValue;
        } else {
          writeOffCount += 1;
          writeOffValue +=
            totalValue;
        }

        const item =
          warehouseItemDetails.get(
            Number(
              movement.item_id
            )
          );

        return {
          id:
            Number(movement.id),
          itemName:
            item?.name ||
            `Матеріал #${movement.item_id}`,
          objectName:
            movement.object_id
              ? objectNames.get(
                  Number(
                    movement.object_id
                  )
                ) ||
                `Об’єкт #${movement.object_id}`
              : null,
          movementType:
            movement.movement_type,
          quantity,
          unit:
            item?.unit || "",
          unitPrice,
          totalValue,
          createdAt:
            movement.created_at,
          performedBy:
            movement.performed_by_name ||
            (movement.performed_by
              ? "Користувач"
              : null),
          note:
            movement.note,
        };
      }
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
          averagePrice,
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
    },
    objectCosts,
    employeeWork,
    expenseCategories,
    expenseHighlights,
    expenseDetails,
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
  };
}
