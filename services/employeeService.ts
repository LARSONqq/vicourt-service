import { createClient } from "@/lib/supabase/server";

import type {
  Employee,
  ManagementEmployee,
} from "@/types/employee";
import type {
  EmployeeDirectoryFilters,
  EmployeeDirectoryPage,
  EmployeeDirectoryStats,
} from "@/types/employeeProfile";

const EMPLOYEE_OPERATIONAL_SELECT = `
  id,
  first_name,
  last_name,
  position,
  status
`;

const EMPLOYEE_DIRECTORY_PAGE_SIZE =
  20;

const EMPLOYEE_DIRECTORY_SELECT = `
  id,
  first_name,
  last_name,
  phone,
  email,
  position,
  employment_type,
  status,
  hire_date,
  notes,
  created_at
`;

const EMPLOYEE_ADMIN_DIRECTORY_SELECT = `
  ${EMPLOYEE_DIRECTORY_SELECT},
  hourly_rate
`;

function normalizeDirectoryPage(
  page: number
) {
  return Number.isSafeInteger(page) &&
    page > 0
    ? page
    : 1;
}

function quotePostgrestValue(
  value: string
) {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')}"`;
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("employees")
    .select(
      EMPLOYEE_OPERATIONAL_SELECT
    )
    .order(
      "last_name",
      {
        ascending: true,
      }
    )
    .order(
      "first_name",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося завантажити працівників: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as Employee[];
}

export async function getManagementEmployees(): Promise<
  ManagementEmployee[]
> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_employees"
      )
      .order("last_name", {
        ascending: true,
      })
      .order("first_name", {
        ascending: true,
      })
      .overrideTypes<
        ManagementEmployee[],
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити ставки працівників: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getManagementEmployeesPage(
  filters: EmployeeDirectoryFilters = {},
  page = 1,
  includeHourlyRate = false
): Promise<EmployeeDirectoryPage> {
  const normalizedPage =
    normalizeDirectoryPage(page);
  const from =
    (normalizedPage - 1) *
    EMPLOYEE_DIRECTORY_PAGE_SIZE;
  const to =
    from +
    EMPLOYEE_DIRECTORY_PAGE_SIZE -
    1;
  const supabase =
    await createClient();
  let query = supabase
    .rpc(
      "get_management_employees",
      undefined,
      {
        count: "exact",
      }
    )
    .select(
      includeHourlyRate
        ? EMPLOYEE_ADMIN_DIRECTORY_SELECT
        : EMPLOYEE_DIRECTORY_SELECT
    );

  if (filters.search) {
    const pattern =
      quotePostgrestValue(
        `%${filters.search}%`
      );

    query = query.or(
      [
        "first_name",
        "last_name",
        "phone",
        "email",
        "position",
      ]
        .map(
          (column) =>
            `${column}.ilike.${pattern}`
        )
        .join(",")
    );
  }

  if (filters.status) {
    query = query.eq(
      "status",
      filters.status
    );
  }

  if (filters.employmentType) {
    query = query.eq(
      "employment_type",
      filters.employmentType
    );
  }

  const {
    data,
    error,
    count,
  } = await query
    .order("last_name", {
      ascending: true,
    })
    .order("first_name", {
      ascending: true,
    })
    .order("id", {
      ascending: true,
    })
    .range(from, to)
    .overrideTypes<
      EmployeeDirectoryPage["items"],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити працівників: ${error.message}`
    );
  }

  const items = Array.isArray(data)
    ? data
    : [];
  const total = Number(count) || 0;

  return {
    items,
    total,
    page: normalizedPage,
    pageSize:
      EMPLOYEE_DIRECTORY_PAGE_SIZE,
    hasPreviousPage:
      normalizedPage > 1,
    hasNextPage:
      from + items.length < total,
  };
}

export async function getManagementEmployeeDirectoryStats(): Promise<EmployeeDirectoryStats> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_employees"
      )
      .select(
        "status, employment_type"
      )
      .overrideTypes<
        Array<{
          status: string;
          employment_type: string;
        }>,
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити статистику працівників: ${error.message}`
    );
  }

  const rows = Array.isArray(data)
    ? data
    : [];

  return rows.reduce<EmployeeDirectoryStats>(
    (stats, employee) => ({
      total: stats.total + 1,
      active:
        stats.active +
        (employee.status ===
        "Активний"
          ? 1
          : 0),
      unavailable:
        stats.unavailable +
        (employee.status ===
          "У відпустці" ||
        employee.status ===
          "На лікарняному"
          ? 1
          : 0),
      contractors:
        stats.contractors +
        (employee.employment_type ===
        "Підрядник"
          ? 1
          : 0),
    }),
    {
      total: 0,
      active: 0,
      unavailable: 0,
      contractors: 0,
    }
  );
}
