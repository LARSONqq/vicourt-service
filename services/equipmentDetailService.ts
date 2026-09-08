import "server-only";

import {
  cache,
} from "react";

import {
  equipmentOperationalSelect,
} from "@/constants/equipment";
import {
  canViewActivityLog,
  canViewReports,
} from "@/lib/auth/permissions";
import {
  evaluateEquipmentMaintenance,
} from "@/lib/equipmentMaintenance";
import {
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  createClient,
} from "@/lib/supabase/server";
import {
  getEquipmentServiceRecordsPage,
} from "@/services/equipmentService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  ActivityLog,
} from "@/types/activityLog";
import type {
  Equipment,
} from "@/types/equipment";
import type {
  EquipmentActivityLog,
  EquipmentActivityPage,
  EquipmentMaintenanceOverview,
  EquipmentOverviewPreview,
  EquipmentProfileKpis,
  EquipmentScopedPage,
  EquipmentServiceCostKpis,
  EquipmentServiceHistoryPage,
} from "@/types/equipmentProfile";
import type {
  EquipmentServiceRecordOperational,
  EquipmentServiceRecordView,
} from "@/types/equipmentServiceRecord";
import type {
  EquipmentUsageLog,
} from "@/types/equipmentUsage";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";

export const EQUIPMENT_TAB_PAGE_SIZE =
  20;
export const EQUIPMENT_ACTIVITY_PAGE_SIZE =
  25;

const SERVICE_PREVIEW_LIMIT = 3;
const USAGE_PREVIEW_LIMIT = 3;
const TASK_PREVIEW_LIMIT = 5;

const TASK_SELECT = `
  id,
  object_id,
  equipment_id,
  title,
  description,
  due_date,
  assignee,
  assigned_employee_id,
  priority,
  status,
  task_source,
  task_template_id,
  recurrence_sequence,
  created_at,
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

const USAGE_LOG_SELECT = `
  id,
  equipment_id,
  equipment_name_snapshot,
  inventory_number_snapshot,
  usage_type,
  reading,
  previous_reading,
  delta,
  reading_date,
  entry_type,
  note,
  created_by,
  created_by_name,
  created_at
`;

const ACTIVITY_SELECT = `
  id,
  actor_id,
  actor_name,
  action,
  entity_type,
  entity_id,
  entity_name,
  object_id,
  object_name,
  description,
  metadata,
  created_at
`;

type EquipmentServiceCostKpiRpcRow = {
  equipment_id: number;
  total_service_cost: number;
  current_year_service_cost: number;
  year_start: string;
};

type EquipmentServicePageSnapshot =
  Awaited<
    ReturnType<
      typeof getEquipmentServiceRecordsPage
    >
  >;

function normalizeEquipmentId(
  equipmentId: number
) {
  if (
    !Number.isInteger(equipmentId) ||
    equipmentId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити техніку."
    );
  }

  return equipmentId;
}

function normalizePage(page: number) {
  return Number.isInteger(page) &&
    page > 0
    ? page
    : 1;
}

function createScopedPage<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): EquipmentScopedPage<T> {
  const from =
    (page - 1) * pageSize;

  return {
    items,
    total,
    page,
    pageSize,
    hasPreviousPage: page > 1,
    hasNextPage:
      from + items.length <
      total,
  };
}

function withoutServiceCost(
  record: EquipmentServiceRecordView
): EquipmentServiceRecordOperational {
  if (!("cost" in record)) {
    return record;
  }

  return {
    id: record.id,
    equipment_id:
      record.equipment_id,
    service_type:
      record.service_type,
    service_date:
      record.service_date,
    performed_by:
      record.performed_by,
    description:
      record.description,
    next_service_date:
      record.next_service_date,
    usage_reading:
      record.usage_reading,
    usage_type_snapshot:
      record.usage_type_snapshot,
    usage_log_id:
      record.usage_log_id,
    created_by_name:
      record.created_by_name,
    voided_at:
      record.voided_at,
    void_reason:
      record.void_reason,
    created_at:
      record.created_at,
    equipment:
      record.equipment,
  };
}

async function loadEquipmentProfile(
  equipmentId: number
): Promise<Equipment | null> {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from("equipment")
      .select(
        equipmentOperationalSelect
      )
      .eq(
        "id",
        normalizedEquipmentId
      )
      .maybeSingle()
      .overrideTypes<
        Equipment | null,
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити паспорт техніки: ${error.message}`
    );
  }

  return data;
}

export const getEquipmentProfile =
  cache(loadEquipmentProfile);

export async function getEquipmentMaintenanceOverview(
  equipmentId: number,
  knownEquipment?: Equipment
): Promise<EquipmentMaintenanceOverview | null> {
  const equipment =
    knownEquipment ??
    (await getEquipmentProfile(
      equipmentId
    ));

  if (!equipment) {
    return null;
  }

  const today =
    getKyivDateValue();
  const evaluation =
    evaluateEquipmentMaintenance(
      equipment,
      today
    );

  return {
    equipmentId:
      equipment.id,
    today,
    nextServiceDate:
      equipment.next_service_date,
    dateState:
      evaluation.dateState,
    evaluation,
  };
}

async function getManagementServiceCostKpis(
  equipmentId: number
): Promise<EquipmentServiceCostKpis> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_equipment_service_cost_kpis",
        {
          p_equipment_id:
            equipmentId,
        }
      )
      .maybeSingle()
      .overrideTypes<
        EquipmentServiceCostKpiRpcRow | null,
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити витрати на техніку: ${error.message}`
    );
  }

  return {
    total:
      Number(
        data?.total_service_cost
      ) || 0,
    currentYear:
      Number(
        data?.current_year_service_cost
      ) || 0,
    yearStart:
      data?.year_start ||
      `${getKyivDateValue().slice(0, 4)}-01-01`,
  };
}

export async function getEquipmentServiceCostKpis(
  equipmentId: number
): Promise<EquipmentServiceCostKpis | null> {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для перегляду витрат на техніку потрібно увійти в систему."
    );
  }

  if (
    !canViewReports(
      profile.role
    )
  ) {
    return null;
  }

  return getManagementServiceCostKpis(
    normalizedEquipmentId
  );
}

export async function getEquipmentProfileKpis(
  equipmentId: number,
  knownEquipment?: Equipment,
  knownServicePage?: EquipmentServicePageSnapshot
): Promise<EquipmentProfileKpis | null> {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const equipment =
    knownEquipment ??
    (await getEquipmentProfile(
      normalizedEquipmentId
    ));

  if (!equipment) {
    return null;
  }

  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для перегляду показників техніки потрібно увійти в систему."
    );
  }

  const today =
    getKyivDateValue();
  const supabase =
    await createClient();
  const [
    openTasksResult,
    overdueTasksResult,
    maintenanceTaskResult,
    servicePage,
    serviceCosts,
  ] = await Promise.all([
    supabase
      .from("object_tasks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "equipment_id",
        normalizedEquipmentId
      )
      .neq(
        "status",
        "Виконано"
      ),
    supabase
      .from("object_tasks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "equipment_id",
        normalizedEquipmentId
      )
      .neq(
        "status",
        "Виконано"
      )
      .lt("due_date", today),
    supabase
      .from("object_tasks")
      .select(TASK_SELECT)
      .eq(
        "equipment_id",
        normalizedEquipmentId
      )
      .eq(
        "task_source",
        "equipment_maintenance"
      )
      .neq(
        "status",
        "Виконано"
      )
      .order("due_date", {
        ascending: true,
        nullsFirst: false,
      })
      .order("id", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle()
      .overrideTypes<
        TaskWithObject | null,
        { merge: false }
      >(),
    knownServicePage ??
      getEquipmentServiceRecordsPage({
        equipmentId:
          normalizedEquipmentId,
        includeVoided: false,
        from: 0,
        to: 0,
      }),
    canViewReports(profile.role)
      ? getManagementServiceCostKpis(
          normalizedEquipmentId
        )
      : Promise.resolve(null),
  ]);

  const firstError = [
    openTasksResult.error,
    overdueTasksResult.error,
    maintenanceTaskResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(
      `Не вдалося завантажити показники техніки: ${firstError.message}`
    );
  }

  const result: EquipmentProfileKpis = {
    equipmentId:
      normalizedEquipmentId,
    status:
      equipment.status,
    currentUsage:
      equipment.current_usage,
    nextServiceDate:
      equipment.next_service_date,
    nextMaintenanceUsage:
      equipment.next_maintenance_usage,
    activeMaintenanceTask:
      maintenanceTaskResult.data,
    openTasks:
      Number(
        openTasksResult.count
      ) || 0,
    overdueTasks:
      Number(
        overdueTasksResult.count
      ) || 0,
    serviceCount:
      servicePage.total,
    lastService:
      servicePage.records[0]
        ? withoutServiceCost(
            servicePage.records[0]
          )
        : null,
  };

  if (serviceCosts) {
    result.serviceCosts =
      serviceCosts;
  }

  return result;
}

export async function getEquipmentServiceHistoryPage(
  equipmentId: number,
  page = 1
): Promise<EquipmentServiceHistoryPage> {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    EQUIPMENT_TAB_PAGE_SIZE;
  const result =
    await getEquipmentServiceRecordsPage({
      equipmentId:
        normalizedEquipmentId,
      includeVoided: true,
      from,
      to:
        from +
        EQUIPMENT_TAB_PAGE_SIZE -
        1,
    });

  return {
    ...createScopedPage(
      result.records,
      result.total,
      normalizedPage,
      EQUIPMENT_TAB_PAGE_SIZE
    ),
    includesCost:
      result.includesCost,
  };
}

export async function getEquipmentRecentServicePreview(
  equipmentId: number
) {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const result =
    await getEquipmentServiceRecordsPage({
      equipmentId:
        normalizedEquipmentId,
      includeVoided: false,
      from: 0,
      to:
        SERVICE_PREVIEW_LIMIT - 1,
    });

  return result.records;
}

async function loadEquipmentUsagePage(
  equipmentId: number,
  page: number,
  pageSize: number
): Promise<
  EquipmentScopedPage<EquipmentUsageLog>
> {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    pageSize;
  const supabase =
    await createClient();
  const {
    data,
    error,
    count,
  } = await supabase
    .from("equipment_usage_logs")
    .select(USAGE_LOG_SELECT, {
      count: "exact",
    })
    .eq(
      "equipment_id",
      normalizedEquipmentId
    )
    .order("reading_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .range(
      from,
      from + pageSize - 1
    )
    .overrideTypes<
      EquipmentUsageLog[],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію напрацювання техніки: ${error.message}`
    );
  }

  return createScopedPage(
    data || [],
    Number(count) || 0,
    normalizedPage,
    pageSize
  );
}

export async function getEquipmentUsageHistoryPage(
  equipmentId: number,
  page = 1
) {
  return loadEquipmentUsagePage(
    equipmentId,
    page,
    EQUIPMENT_TAB_PAGE_SIZE
  );
}

export async function getEquipmentRecentUsagePreview(
  equipmentId: number
) {
  const page =
    await loadEquipmentUsagePage(
      equipmentId,
      1,
      USAGE_PREVIEW_LIMIT
    );

  return page.items;
}

async function loadEquipmentTasksPage(
  equipmentId: number,
  page: number,
  pageSize: number,
  activeOnly: boolean
): Promise<
  EquipmentScopedPage<TaskWithObject>
> {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    pageSize;
  const supabase =
    await createClient();
  let query = supabase
    .from("object_tasks")
    .select(TASK_SELECT, {
      count: "exact",
    })
    .eq(
      "equipment_id",
      normalizedEquipmentId
    );

  if (activeOnly) {
    query = query.neq(
      "status",
      "Виконано"
    );
  }

  const {
    data,
    error,
    count,
  } = await query
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .range(
      from,
      from + pageSize - 1
    )
    .overrideTypes<
      TaskWithObject[],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити завдання техніки: ${error.message}`
    );
  }

  return createScopedPage(
    data || [],
    Number(count) || 0,
    normalizedPage,
    pageSize
  );
}

export async function getEquipmentTasksPage(
  equipmentId: number,
  page = 1
) {
  return loadEquipmentTasksPage(
    equipmentId,
    page,
    EQUIPMENT_TAB_PAGE_SIZE,
    false
  );
}

export async function getEquipmentRecentTasksPreview(
  equipmentId: number
) {
  const page =
    await loadEquipmentTasksPage(
      equipmentId,
      1,
      TASK_PREVIEW_LIMIT,
      true
    );

  return page.items;
}

export async function getEquipmentActivityHistoryPage(
  equipmentId: number,
  page = 1
): Promise<EquipmentActivityPage> {
  const normalizedEquipmentId =
    normalizeEquipmentId(
      equipmentId
    );
  const profile =
    await getCurrentUserProfile();

  if (
    !profile ||
    !canViewActivityLog(
      profile.role
    )
  ) {
    throw new Error(
      "Недостатньо прав для перегляду історії техніки."
    );
  }

  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    EQUIPMENT_ACTIVITY_PAGE_SIZE;
  const supabase =
    await createClient();
  const { data, error, count } =
    await supabase
      .from("activity_logs")
      .select(ACTIVITY_SELECT, {
        count: "exact",
      })
      .or(
        `and(entity_type.eq.equipment,entity_id.eq.${normalizedEquipmentId}),and(entity_type.eq.task,metadata->>target_type.eq.equipment,metadata->>target_id.eq.${normalizedEquipmentId})`
      )
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(
        from,
        from +
          EQUIPMENT_ACTIVITY_PAGE_SIZE -
          1
      )
      .overrideTypes<
        ActivityLog[],
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію техніки: ${error.message}`
    );
  }

  const items: EquipmentActivityLog[] =
    (data || []).map(
      (log) => ({
        ...log,
        equipmentAssociation:
          log.entity_type ===
          "equipment"
            ? "equipment_entity"
            : "equipment_task_target",
      })
    );

  return createScopedPage(
    items,
    Number(count) || 0,
    normalizedPage,
    EQUIPMENT_ACTIVITY_PAGE_SIZE
  );
}

export async function getEquipmentOverviewPreview(
  equipmentId: number
): Promise<EquipmentOverviewPreview | null> {
  const equipment =
    await getEquipmentProfile(
      equipmentId
    );

  if (!equipment) {
    return null;
  }

  const [maintenance, kpis] =
    await Promise.all([
      getEquipmentMaintenanceOverview(
        equipment.id,
        equipment
      ),
      getEquipmentProfileKpis(
        equipment.id,
        equipment
      ),
    ]);

  if (!maintenance || !kpis) {
    return null;
  }

  return {
    equipment,
    maintenance,
    kpis,
  };
}
