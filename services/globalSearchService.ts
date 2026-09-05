import "server-only";

import {
  EQUIPMENT_MAINTENANCE_TASK_SOURCE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import {
  canAccessSection,
  canManageObjects,
} from "@/lib/auth/permissions";
import {
  buildSafeOrIlikeFilter,
  getSafeSearchCandidateToken,
  isMeaningfulSearchQuery,
  normalizeGlobalSearchQuery,
  rankGlobalSearchCandidate,
} from "@/lib/globalSearch";
import {
  formatDateValue,
} from "@/lib/kyivDate";
import {
  createClient,
} from "@/lib/supabase/server";
import {
  getTaskTarget,
} from "@/lib/taskTarget";
import {
  formatWarehouseQuantity,
} from "@/lib/warehousePlanning";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  GlobalSearchCategory,
  GlobalSearchGroup,
  GlobalSearchResponse,
  GlobalSearchResult,
} from "@/types/globalSearch";
import type {
  TaskSource,
} from "@/types/objectTask";

const CANDIDATE_LIMIT = 15;
const RESULTS_PER_GROUP = 5;
const TOTAL_RESULTS_LIMIT = 30;

const OBJECT_SEARCH_COLUMNS = [
  "name",
  "customer",
  "phone",
  "address",
  "manager",
] as const;
const TASK_SEARCH_COLUMNS = [
  "title",
  "description",
  "assignee",
] as const;
const EQUIPMENT_SEARCH_COLUMNS = [
  "name",
  "inventory_number",
  "responsible",
  "category",
] as const;
const EMPLOYEE_SEARCH_COLUMNS = [
  "first_name",
  "last_name",
  "phone",
  "position",
] as const;
const WAREHOUSE_SEARCH_COLUMNS = [
  "name",
  "category",
  "supplier",
] as const;
const PURCHASE_SEARCH_COLUMNS = [
  "supplier",
  "note",
  "status",
] as const;
const PAYMENT_SCHEDULE_SEARCH_COLUMNS = [
  "title",
  "note",
] as const;

type ObjectSearchRow = {
  id: number;
  name: string;
  customer: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  manager: string | null;
};

type TaskSearchRow = {
  id: number;
  object_id: number | null;
  equipment_id: number | null;
  title: string;
  description: string | null;
  due_date: string | null;
  assignee: string | null;
  status: string;
  task_source: TaskSource;
  object: {
    id: number;
    name: string;
  } | null;
  equipment: {
    id: number;
    name: string;
    inventory_number: string | null;
  } | null;
};

type EquipmentSearchRow = {
  id: number;
  name: string;
  inventory_number: string | null;
  responsible: string | null;
  category: string | null;
  status: string;
};

type EmployeeSearchRow = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  position: string | null;
  status: string;
};

type WarehouseSearchRow = {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
};

type PurchaseSearchRow = {
  id: number;
  item_id: number;
  supplier: string | null;
  note: string | null;
  status: string;
  created_at: string;
  item: {
    id: number;
    name: string;
    unit: string;
  } | null;
};

type PaymentScheduleSearchRow = {
  id: number;
  object_id: number;
  title: string;
  due_date: string;
  note: string | null;
  object: {
    id: number;
    name: string;
  } | null;
};

type RankedRow<T> = {
  row: T;
  rank: number;
};

export class GlobalSearchAuthError extends Error {}

function createSearchError(
  entityLabel: string,
  message: string
) {
  return new Error(
    `Не вдалося виконати пошук у розділі «${entityLabel}»: ${message}`
  );
}

function uniquePositiveIds(
  values: number[]
) {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          Number.isInteger(
            value
          ) && value > 0
      )
    )
  );
}

function rankRows<T extends {
  id: number;
}>(
  rows: T[],
  getRank: (row: T) =>
    | number
    | null,
  getTitle: (row: T) => string
) {
  const uniqueRows =
    Array.from(
      new Map(
        rows.map((row) => [
          row.id,
          row,
        ])
      ).values()
    );

  return uniqueRows
    .flatMap(
      (row): RankedRow<T>[] => {
        const rank =
          getRank(row);

        return rank === null
          ? []
          : [{ row, rank }];
      }
    )
    .sort(
      (first, second) =>
        first.rank -
          second.rank ||
        getTitle(
          first.row
        ).localeCompare(
          getTitle(
            second.row
          ),
          "uk"
        )
    );
}

function joinSubtitle(
  values: Array<
    string | null | undefined
  >
) {
  const subtitle = values
    .filter(
      (value): value is string =>
        Boolean(
          value?.trim()
        )
    )
    .join(" · ");

  return subtitle || null;
}

function getTaskBadge(
  source: TaskSource
) {
  if (
    source ===
    SUPERVISION_TASK_SOURCE
  ) {
    return "Автоматичний огляд";
  }

  if (
    source ===
    EQUIPMENT_MAINTENANCE_TASK_SOURCE
  ) {
    return "Автоматичне ТО";
  }

  return null;
}

async function searchObjects(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  candidateToken: string
) {
  const { data, error } =
    await supabase
      .from("objects")
      .select(`
        id,
        name,
        customer,
        phone,
        address,
        status,
        manager
      `)
      .or(
        buildSafeOrIlikeFilter(
          OBJECT_SEARCH_COLUMNS,
          candidateToken
        )
      )
      .order("name", {
        ascending: true,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        ObjectSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Об’єкти",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

const TASK_SELECT = `
  id,
  object_id,
  equipment_id,
  title,
  description,
  due_date,
  assignee,
  status,
  task_source,
  object:objects (
    id,
    name
  ),
  equipment:equipment (
    id,
    name,
    inventory_number
  )
`;

async function searchDirectTasks(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  candidateToken: string
) {
  const { data, error } =
    await supabase
      .from("object_tasks")
      .select(TASK_SELECT)
      .or(
        buildSafeOrIlikeFilter(
          TASK_SEARCH_COLUMNS,
          candidateToken
        )
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        TaskSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Завдання",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function searchTargetTasks(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  objectIds: number[],
  equipmentIds: number[]
) {
  const safeObjectIds =
    uniquePositiveIds(
      objectIds
    );
  const safeEquipmentIds =
    uniquePositiveIds(
      equipmentIds
    );

  if (
    safeObjectIds.length ===
      0 &&
    safeEquipmentIds.length ===
      0
  ) {
    return [];
  }

  let query = supabase
    .from("object_tasks")
    .select(TASK_SELECT);

  if (
    safeObjectIds.length > 0 &&
    safeEquipmentIds.length > 0
  ) {
    // IDs походять лише з уже дозволених DB rows і повторно
    // перевіряються як positive integers перед filter composition.
    query = query.or(
      `object_id.in.(${safeObjectIds.join(
        ","
      )}),equipment_id.in.(${safeEquipmentIds.join(
        ","
      )})`
    );
  } else if (
    safeObjectIds.length > 0
  ) {
    query = query.in(
      "object_id",
      safeObjectIds
    );
  } else {
    query = query.in(
      "equipment_id",
      safeEquipmentIds
    );
  }

  const { data, error } =
    await query
      .order("created_at", {
        ascending: false,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        TaskSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Завдання",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function searchEquipment(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  candidateToken: string
) {
  const { data, error } =
    await supabase
      .from("equipment")
      .select(`
        id,
        name,
        inventory_number,
        responsible,
        category,
        status
      `)
      .or(
        buildSafeOrIlikeFilter(
          EQUIPMENT_SEARCH_COLUMNS,
          candidateToken
        )
      )
      .order("name", {
        ascending: true,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        EquipmentSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Техніка",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function searchEmployees(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  candidateToken: string
) {
  const { data, error } =
    await supabase
      .rpc(
        "get_management_employees"
      )
      .or(
        buildSafeOrIlikeFilter(
          EMPLOYEE_SEARCH_COLUMNS,
          candidateToken
        )
      )
      .order("last_name", {
        ascending: true,
      })
      .order("first_name", {
        ascending: true,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        EmployeeSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Працівники",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function searchWarehouse(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  candidateToken: string
) {
  const { data, error } =
    await supabase
      .from("warehouse_items")
      .select(`
        id,
        name,
        category,
        quantity,
        unit,
        supplier
      `)
      .or(
        buildSafeOrIlikeFilter(
          WAREHOUSE_SEARCH_COLUMNS,
          candidateToken
        )
      )
      .order("name", {
        ascending: true,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        WarehouseSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Склад",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

const PURCHASE_SELECT = `
  id,
  item_id,
  supplier,
  note,
  status,
  created_at,
  item:warehouse_items (
    id,
    name,
    unit
  )
`;

async function searchDirectPurchases(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  candidateToken: string
) {
  const { data, error } =
    await supabase
      .from(
        "warehouse_purchases"
      )
      .select(PURCHASE_SELECT)
      .or(
        buildSafeOrIlikeFilter(
          PURCHASE_SEARCH_COLUMNS,
          candidateToken
        )
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        PurchaseSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Закупівлі",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function searchPurchasesByItems(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  itemIds: number[]
) {
  const safeIds =
    uniquePositiveIds(itemIds);

  if (safeIds.length === 0) {
    return [];
  }

  const { data, error } =
    await supabase
      .from(
        "warehouse_purchases"
      )
      .select(PURCHASE_SELECT)
      .in("item_id", safeIds)
      .order("created_at", {
        ascending: false,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        PurchaseSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Закупівлі",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

const PAYMENT_SCHEDULE_SELECT = `
  id,
  object_id,
  title,
  due_date,
  note,
  object:objects (
    id,
    name
  )
`;

async function searchDirectPaymentSchedules(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  candidateToken: string
) {
  const { data, error } =
    await supabase
      .from(
        "object_payment_schedule"
      )
      .select(
        PAYMENT_SCHEDULE_SELECT
      )
      .or(
        buildSafeOrIlikeFilter(
          PAYMENT_SCHEDULE_SEARCH_COLUMNS,
          candidateToken
        )
      )
      .order("due_date", {
        ascending: true,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        PaymentScheduleSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Фінанси",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function searchPaymentSchedulesByObjects(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  objectIds: number[]
) {
  const safeIds =
    uniquePositiveIds(
      objectIds
    );

  if (safeIds.length === 0) {
    return [];
  }

  const { data, error } =
    await supabase
      .from(
        "object_payment_schedule"
      )
      .select(
        PAYMENT_SCHEDULE_SELECT
      )
      .in("object_id", safeIds)
      .order("due_date", {
        ascending: true,
      })
      .limit(CANDIDATE_LIMIT)
      .overrideTypes<
        PaymentScheduleSearchRow[]
      >();

  if (error) {
    throw createSearchError(
      "Фінанси",
      error.message
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

function createGroup(
  category: GlobalSearchCategory,
  label: string,
  results: GlobalSearchResult[]
): GlobalSearchGroup | null {
  return results.length > 0
    ? {
        category,
        label,
        results,
      }
    : null;
}

function limitGroups(
  groups: Array<
    GlobalSearchGroup | null
  >
) {
  const limitedGroups:
    GlobalSearchGroup[] = [];
  let remaining =
    TOTAL_RESULTS_LIMIT;

  for (const group of groups) {
    if (
      !group ||
      remaining <= 0
    ) {
      continue;
    }

    const results =
      group.results.slice(
        0,
        Math.min(
          RESULTS_PER_GROUP,
          remaining
        )
      );

    if (results.length > 0) {
      limitedGroups.push({
        ...group,
        results,
      });
      remaining -=
        results.length;
    }
  }

  return limitedGroups;
}

function emptyResponse(
  query: string
): GlobalSearchResponse {
  return {
    query,
    groups: [],
    total: 0,
  };
}

export async function searchViCourt(
  rawQuery: string
): Promise<GlobalSearchResponse> {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new GlobalSearchAuthError(
      "Потрібно увійти в систему."
    );
  }

  const query =
    normalizeGlobalSearchQuery(
      rawQuery
    );

  if (
    !isMeaningfulSearchQuery(
      query
    )
  ) {
    return emptyResponse(query);
  }

  const candidateToken =
    getSafeSearchCandidateToken(
      query
    );

  if (!candidateToken) {
    return emptyResponse(query);
  }

  const canSearchObjects =
    canAccessSection(
      profile.role,
      "objects"
    );
  const canSearchTasks =
    canAccessSection(
      profile.role,
      "tasks"
    );
  const canSearchEquipment =
    canAccessSection(
      profile.role,
      "equipment"
    );
  const canSearchEmployees =
    canAccessSection(
      profile.role,
      "employees"
    );
  const canSearchWarehouse =
    canAccessSection(
      profile.role,
      "warehouse"
    );
  const canSearchPurchases =
    canAccessSection(
      profile.role,
      "purchases"
    );
  const canSearchFinance =
    canManageObjects(
      profile.role
    );
  const supabase =
    await createClient();

  const [
    objectRows,
    directTaskRows,
    equipmentRows,
    employeeRows,
    warehouseRows,
    directPurchaseRows,
    directScheduleRows,
  ] = await Promise.all([
    canSearchObjects
      ? searchObjects(
          supabase,
          candidateToken
        )
      : Promise.resolve<
          ObjectSearchRow[]
        >([]),
    canSearchTasks
      ? searchDirectTasks(
          supabase,
          candidateToken
        )
      : Promise.resolve<
          TaskSearchRow[]
        >([]),
    canSearchEquipment
      ? searchEquipment(
          supabase,
          candidateToken
        )
      : Promise.resolve<
          EquipmentSearchRow[]
        >([]),
    canSearchEmployees
      ? searchEmployees(
          supabase,
          candidateToken
        )
      : Promise.resolve<
          EmployeeSearchRow[]
        >([]),
    canSearchWarehouse
      ? searchWarehouse(
          supabase,
          candidateToken
        )
      : Promise.resolve<
          WarehouseSearchRow[]
        >([]),
    canSearchPurchases
      ? searchDirectPurchases(
          supabase,
          candidateToken
        )
      : Promise.resolve<
          PurchaseSearchRow[]
        >([]),
    canSearchFinance
      ? searchDirectPaymentSchedules(
          supabase,
          candidateToken
        )
      : Promise.resolve<
          PaymentScheduleSearchRow[]
        >([]),
  ]);

  const rankedObjects =
    rankRows(
      objectRows,
      (row) =>
        rankGlobalSearchCandidate(
          row.name,
          [
            row.customer,
            row.phone,
            row.address,
            row.manager,
            row.status,
          ],
          query
        ),
      (row) => row.name
    );
  const rankedEquipment =
    rankRows(
      equipmentRows,
      (row) =>
        rankGlobalSearchCandidate(
          row.name,
          [
            row.inventory_number,
            row.responsible,
            row.category,
          ],
          query
        ),
      (row) => row.name
    );
  const rankedWarehouse =
    rankRows(
      warehouseRows,
      (row) =>
        rankGlobalSearchCandidate(
          row.name,
          [
            row.category,
            row.supplier,
          ],
          query
        ),
      (row) => row.name
    );

  const [
    targetTaskRows,
    purchaseItemRows,
    scheduleObjectRows,
  ] = await Promise.all([
    canSearchTasks
      ? searchTargetTasks(
          supabase,
          rankedObjects.map(
            ({ row }) =>
              row.id
          ),
          rankedEquipment.map(
            ({ row }) =>
              row.id
          )
        )
      : Promise.resolve<
          TaskSearchRow[]
        >([]),
    canSearchPurchases
      ? searchPurchasesByItems(
          supabase,
          rankedWarehouse.map(
            ({ row }) =>
              row.id
          )
        )
      : Promise.resolve<
          PurchaseSearchRow[]
        >([]),
    canSearchFinance
      ? searchPaymentSchedulesByObjects(
          supabase,
          rankedObjects.map(
            ({ row }) =>
              row.id
          )
        )
      : Promise.resolve<
          PaymentScheduleSearchRow[]
        >([]),
  ]);

  const rankedTasks = rankRows(
    [
      ...directTaskRows,
      ...targetTaskRows,
    ],
    (row) => {
      const target =
        getTaskTarget(row);

      return rankGlobalSearchCandidate(
        row.title,
        [
          row.description,
          row.assignee,
          target?.name,
        ],
        query
      );
    },
    (row) => row.title
  );
  const rankedEmployees =
    rankRows(
      employeeRows,
      (row) => {
        const fullName =
          `${row.last_name} ${row.first_name}`.trim();
        const reverseFullName =
          `${row.first_name} ${row.last_name}`.trim();

        return rankGlobalSearchCandidate(
          fullName,
          [
            reverseFullName,
            row.phone,
            row.position,
          ],
          query
        );
      },
      (row) =>
        `${row.last_name} ${row.first_name}`.trim()
    );
  const rankedPurchases =
    rankRows(
      [
        ...directPurchaseRows,
        ...purchaseItemRows,
      ],
      (row) =>
        rankGlobalSearchCandidate(
          row.item?.name ||
            "Закупівля",
          [
            row.supplier,
            row.note,
            row.status,
          ],
          query
        ),
      (row) =>
        row.item?.name ||
        "Закупівля"
    );
  const rankedSchedules =
    rankRows(
      [
        ...directScheduleRows,
        ...scheduleObjectRows,
      ],
      (row) =>
        rankGlobalSearchCandidate(
          row.title,
          [
            row.object?.name,
            row.note,
          ],
          query
        ),
      (row) => row.title
    );

  const groups = limitGroups([
    createGroup(
      "objects",
      "Об’єкти",
      rankedObjects.map(
        ({ row }) => ({
          id: `object:${row.id}`,
          type: "object",
          title: row.name,
          subtitle:
            joinSubtitle([
              row.customer,
              row.address,
              row.status,
            ]),
          href: `/objects/${row.id}`,
          badge: null,
        })
      )
    ),
    createGroup(
      "tasks",
      "Завдання",
      rankedTasks.map(
        ({ row }) => {
          const target =
            getTaskTarget(row);

          return {
            id: `task:${row.id}`,
            type: "task",
            title: row.title,
            subtitle:
              joinSubtitle([
                target
                  ? `${target.label}: ${target.name}`
                  : null,
                formatDateValue(
                  row.due_date
                ),
                row.status,
              ]),
            href: "/task",
            badge:
              getTaskBadge(
                row.task_source
              ),
          } satisfies GlobalSearchResult;
        }
      )
    ),
    createGroup(
      "equipment",
      "Техніка",
      rankedEquipment.map(
        ({ row }) => ({
          id: `equipment:${row.id}`,
          type: "equipment",
          title: row.name,
          subtitle:
            joinSubtitle([
              row.inventory_number,
              row.category,
              row.responsible,
            ]),
          href: "/equipment",
          badge: null,
        })
      )
    ),
    createGroup(
      "employees",
      "Працівники",
      rankedEmployees.map(
        ({ row }) => ({
          id: `employee:${row.id}`,
          type: "employee",
          title:
            `${row.last_name} ${row.first_name}`.trim(),
          subtitle:
            joinSubtitle([
              row.position,
              row.phone,
              row.status,
            ]),
          href: `/employees/${row.id}`,
          badge: null,
        })
      )
    ),
    createGroup(
      "warehouse",
      "Склад",
      rankedWarehouse.map(
        ({ row }) => ({
          id: `warehouse_item:${row.id}`,
          type: "warehouse_item",
          title: row.name,
          subtitle:
            joinSubtitle([
              row.category,
              `${formatWarehouseQuantity(
                Number(
                  row.quantity
                )
              )} ${row.unit}`,
              row.supplier,
            ]),
          href: `/warehouse?item=${row.id}#warehouse-item-${row.id}`,
          badge: null,
        })
      )
    ),
    createGroup(
      "purchases",
      "Закупівлі",
      rankedPurchases.map(
        ({ row }) => ({
          id: `purchase:${row.id}`,
          type: "purchase",
          title:
            row.item?.name ||
            "Закупівля",
          subtitle:
            joinSubtitle([
              row.supplier,
              row.status,
            ]),
          href: "/purchases",
          badge: "Закупівля",
        })
      )
    ),
    createGroup(
      "finance",
      "Фінанси",
      rankedSchedules.map(
        ({ row }) => ({
          id: `payment_schedule:${row.id}`,
          type: "payment_schedule",
          title: row.title,
          subtitle:
            joinSubtitle([
              row.object?.name,
              formatDateValue(
                row.due_date
              )
                ? `До ${formatDateValue(
                    row.due_date
                  )}`
                : null,
            ]),
          href: `/objects/${row.object_id}#payment-schedule`,
          badge: "Графік оплат",
        })
      )
    ),
  ]);

  return {
    query,
    groups,
    total: groups.reduce(
      (total, group) =>
        total +
        group.results.length,
      0
    ),
  };
}
