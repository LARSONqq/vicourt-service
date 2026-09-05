import "server-only";

import {
  getKyivDateValue,
} from "@/lib/kyivDate";
import {
  createClient,
} from "@/lib/supabase/server";

import type {
  ManagementEmployee,
} from "@/types/employee";
import type {
  EmployeeActor,
  EmployeeActivityPage,
  EmployeeDirectoryWorkload,
  EmployeeEquipmentPage,
  EmployeeObjectPage,
  EmployeeProfileKpis,
  EmployeeScopedPage,
  EmployeeSupervisionPreview,
  EmployeeTaskFilter,
  EmployeeTaskPage,
  EmployeeWorkLogPage,
} from "@/types/employeeProfile";
import type {
  Equipment,
} from "@/types/equipment";
import type {
  ObjectItem,
} from "@/types/object";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";

const EMPLOYEE_TAB_PAGE_SIZE =
  20;
const TASK_PREVIEW_LIMIT = 5;
const WORK_LOG_PREVIEW_LIMIT = 3;
const SUPERVISION_PREVIEW_LIMIT =
  5;

const OBJECT_OPERATIONAL_SELECT = `
  id,
  name,
  customer,
  phone,
  address,
  status,
  manager,
  responsible_employee_id,
  supervision_interval_days,
  last_supervision_date,
  next_supervision_date,
  created_at
`;

const EQUIPMENT_SELECT = `
  id,
  name,
  category,
  inventory_number,
  status,
  responsible,
  responsible_employee_id,
  location,
  purchase_date,
  maintenance_interval_days,
  last_maintenance_date,
  next_service_date,
  usage_type,
  current_usage,
  maintenance_interval_usage,
  last_maintenance_usage,
  next_maintenance_usage,
  notes,
  created_at
`;

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

const WORK_LOG_SELECT = `
  id,
  object_id,
  employee_id,
  work_date,
  description,
  workers,
  hours,
  attachment_path,
  attachment_name,
  attachment_type,
  attachment_size,
  created_at,
  object:objects (
    id,
    name
  )
`;

type EmployeeKpiRpcRow = {
  employee_id: number;
  active_task_count: number;
  overdue_task_count: number;
  completed_task_count: number;
  monthly_hours: number;
  lifetime_hours: number;
  work_log_count: number;
  object_count: number;
  equipment_count: number;
  month_start: string;
};

type EmployeeDirectoryWorkloadRpcRow = {
  employee_id: number;
  active_task_count: number;
  object_count: number;
  equipment_count: number;
};

type EmployeeActorRpcRow = {
  actor_id: string;
  actor_name: string;
};

function normalizeEmployeeId(
  employeeId: number
) {
  if (
    !Number.isInteger(employeeId) ||
    employeeId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити працівника."
    );
  }

  return employeeId;
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
): EmployeeScopedPage<T> {
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

export async function getEmployeeProfile(
  employeeId: number
): Promise<ManagementEmployee | null> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_employees"
      )
      .eq(
        "id",
        normalizedEmployeeId
      )
      .maybeSingle()
      .overrideTypes<
        ManagementEmployee | null,
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити профіль працівника: ${error.message}`
    );
  }

  return data;
}

export async function getEmployeeProfileKpis(
  employeeId: number
): Promise<EmployeeProfileKpis | null> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_employee_profile_kpis",
        {
          p_employee_id:
            normalizedEmployeeId,
        }
      )
      .maybeSingle()
      .overrideTypes<
        EmployeeKpiRpcRow | null,
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити показники працівника: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return {
    employeeId: Number(
      data.employee_id
    ),
    activeTasks: Number(
      data.active_task_count
    ),
    overdueTasks: Number(
      data.overdue_task_count
    ),
    completedTasks: Number(
      data.completed_task_count
    ),
    monthlyHours: Number(
      data.monthly_hours
    ),
    lifetimeHours: Number(
      data.lifetime_hours
    ),
    workLogs: Number(
      data.work_log_count
    ),
    objects: Number(
      data.object_count
    ),
    equipment: Number(
      data.equipment_count
    ),
    monthStart:
      data.month_start,
  };
}

export async function getEmployeeDirectoryWorkloads(): Promise<
  EmployeeDirectoryWorkload[]
> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_employee_directory_workloads"
      )
      .overrideTypes<
        EmployeeDirectoryWorkloadRpcRow[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити навантаження працівників: ${error.message}`
    );
  }

  const rows = Array.isArray(data)
    ? (data as EmployeeDirectoryWorkloadRpcRow[])
    : [];

  return rows.map(
    (row: EmployeeDirectoryWorkloadRpcRow) => ({
      employeeId: Number(
        row.employee_id
      ),
      activeTasks: Number(
        row.active_task_count
      ),
      objects: Number(
        row.object_count
      ),
      equipment: Number(
        row.equipment_count
      ),
    })
  );
}

async function loadEmployeeTasks(
  employeeId: number,
  page: number,
  pageSize: number,
  filter: EmployeeTaskFilter
): Promise<EmployeeTaskPage> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    pageSize;
  const to =
    from + pageSize - 1;
  const today =
    getKyivDateValue();
  const supabase =
    await createClient();
  let query = supabase
    .from("object_tasks")
    .select(TASK_SELECT, {
      count: "exact",
    })
    .eq(
      "assigned_employee_id",
      normalizedEmployeeId
    );

  if (filter === "active") {
    query = query.neq(
      "status",
      "Виконано"
    );
  } else if (
    filter === "overdue"
  ) {
    query = query
      .neq(
        "status",
        "Виконано"
      )
      .lt(
        "due_date",
        today
      );
  } else if (
    filter === "completed"
  ) {
    query = query.eq(
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
    .range(from, to)
    .overrideTypes<
      TaskWithObject[],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити завдання працівника: ${error.message}`
    );
  }

  return createScopedPage(
    data || [],
    Number(count) || 0,
    normalizedPage,
    pageSize
  );
}

export async function getEmployeeTasksPage(
  employeeId: number,
  page = 1,
  filter: EmployeeTaskFilter =
    "all"
) {
  return loadEmployeeTasks(
    employeeId,
    page,
    EMPLOYEE_TAB_PAGE_SIZE,
    filter
  );
}

export async function getEmployeeRecentTasksPreview(
  employeeId: number
) {
  const page =
    await loadEmployeeTasks(
      employeeId,
      1,
      TASK_PREVIEW_LIMIT,
      "active"
    );

  return page.items;
}

async function loadEmployeeWorkLogs(
  employeeId: number,
  page: number,
  pageSize: number
): Promise<EmployeeWorkLogPage> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    pageSize;
  const to =
    from + pageSize - 1;
  const supabase =
    await createClient();
  const {
    data,
    error,
    count,
  } = await supabase
    .from("work_logs")
    .select(WORK_LOG_SELECT, {
      count: "exact",
    })
    .eq(
      "employee_id",
      normalizedEmployeeId
    )
    .order("work_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .range(from, to)
    .overrideTypes<
      EmployeeWorkLogPage["items"],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити роботи працівника: ${error.message}`
    );
  }

  return createScopedPage(
    data || [],
    Number(count) || 0,
    normalizedPage,
    pageSize
  );
}

export async function getEmployeeWorkLogsPage(
  employeeId: number,
  page = 1
) {
  return loadEmployeeWorkLogs(
    employeeId,
    page,
    EMPLOYEE_TAB_PAGE_SIZE
  );
}

export async function getEmployeeRecentWorkLogsPreview(
  employeeId: number
) {
  const page =
    await loadEmployeeWorkLogs(
      employeeId,
      1,
      WORK_LOG_PREVIEW_LIMIT
    );

  return page.items;
}

export async function getEmployeeObjectsPage(
  employeeId: number,
  page = 1
): Promise<EmployeeObjectPage> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    EMPLOYEE_TAB_PAGE_SIZE;
  const to =
    from +
    EMPLOYEE_TAB_PAGE_SIZE -
    1;
  const supabase =
    await createClient();
  const {
    data,
    error,
    count,
  } = await supabase
    .from("objects")
    .select(
      OBJECT_OPERATIONAL_SELECT,
      { count: "exact" }
    )
    .eq(
      "responsible_employee_id",
      normalizedEmployeeId
    )
    .order("name", {
      ascending: true,
    })
    .order("id", {
      ascending: true,
    })
    .range(from, to)
    .overrideTypes<
      ObjectItem[],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити об’єкти працівника: ${error.message}`
    );
  }

  return createScopedPage(
    data || [],
    Number(count) || 0,
    normalizedPage,
    EMPLOYEE_TAB_PAGE_SIZE
  );
}

export async function getEmployeeEquipmentPage(
  employeeId: number,
  page = 1
): Promise<EmployeeEquipmentPage> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    EMPLOYEE_TAB_PAGE_SIZE;
  const to =
    from +
    EMPLOYEE_TAB_PAGE_SIZE -
    1;
  const supabase =
    await createClient();
  const {
    data,
    error,
    count,
  } = await supabase
    .from("equipment")
    .select(
      EQUIPMENT_SELECT,
      { count: "exact" }
    )
    .eq(
      "responsible_employee_id",
      normalizedEmployeeId
    )
    .order("name", {
      ascending: true,
    })
    .order("id", {
      ascending: true,
    })
    .range(from, to)
    .overrideTypes<
      Equipment[],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити техніку працівника: ${error.message}`
    );
  }

  return createScopedPage(
    data || [],
    Number(count) || 0,
    normalizedPage,
    EMPLOYEE_TAB_PAGE_SIZE
  );
}

export async function getEmployeeSupervisionPreview(
  employeeId: number
): Promise<
  EmployeeSupervisionPreview[]
> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from("objects")
      .select(`
        id,
        name,
        status,
        supervision_interval_days,
        last_supervision_date,
        next_supervision_date
      `)
      .eq(
        "responsible_employee_id",
        normalizedEmployeeId
      )
      .not(
        "supervision_interval_days",
        "is",
        null
      )
      .order(
        "next_supervision_date",
        {
          ascending: true,
          nullsFirst: false,
        }
      )
      .order("id", {
        ascending: true,
      })
      .limit(
        SUPERVISION_PREVIEW_LIMIT
      )
      .overrideTypes<
        EmployeeSupervisionPreview[],
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити огляди працівника: ${error.message}`
    );
  }

  return data || [];
}

export async function getEmployeeActors(
  employeeId: number
): Promise<EmployeeActor[]> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_employee_actors",
        {
          p_employee_id:
            normalizedEmployeeId,
        }
      )
      .overrideTypes<
        EmployeeActorRpcRow[]
      >();

  if (error) {
    throw new Error(
      `Не вдалося визначити пов’язані акаунти працівника: ${error.message}`
    );
  }

  const rows = Array.isArray(data)
    ? (data as EmployeeActorRpcRow[])
    : [];

  return rows.map(
    (row: EmployeeActorRpcRow) => ({
      actorId: row.actor_id,
      actorName:
        row.actor_name,
    })
  );
}

async function loadEmployeeActivityPage(
  employeeId: number,
  page: number,
  mode: "changes" | "actor"
): Promise<EmployeeActivityPage> {
  const normalizedEmployeeId =
    normalizeEmployeeId(employeeId);
  const normalizedPage =
    normalizePage(page);
  const from =
    (normalizedPage - 1) *
    EMPLOYEE_TAB_PAGE_SIZE;
  const to =
    from +
    EMPLOYEE_TAB_PAGE_SIZE -
    1;
  const supabase =
    await createClient();
  let query = supabase
    .from("activity_logs")
    .select("*", {
      count: "exact",
    });

  if (mode === "changes") {
    query = query
      .eq(
        "entity_type",
        "employee"
      )
      .eq(
        "entity_id",
        String(
          normalizedEmployeeId
        )
      );
  } else {
    const actors =
      await getEmployeeActors(
        normalizedEmployeeId
      );
    const actorIds =
      actors.map(
        (actor) =>
          actor.actorId
      );

    if (actorIds.length === 0) {
      return createScopedPage(
        [],
        0,
        normalizedPage,
        EMPLOYEE_TAB_PAGE_SIZE
      );
    }

    query = query.in(
      "actor_id",
      actorIds
    );
  }

  const {
    data,
    error,
    count,
  } = await query
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .range(from, to)
    .overrideTypes<
      EmployeeActivityPage["items"],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      mode === "changes"
        ? `Не вдалося завантажити зміни працівника: ${error.message}`
        : `Не вдалося завантажити дії працівника: ${error.message}`
    );
  }

  return createScopedPage(
    data || [],
    Number(count) || 0,
    normalizedPage,
    EMPLOYEE_TAB_PAGE_SIZE
  );
}

export async function getEmployeeChangesPage(
  employeeId: number,
  page = 1
) {
  return loadEmployeeActivityPage(
    employeeId,
    page,
    "changes"
  );
}

export async function getEmployeeActorHistoryPage(
  employeeId: number,
  page = 1
) {
  return loadEmployeeActivityPage(
    employeeId,
    page,
    "actor"
  );
}
