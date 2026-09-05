import { createClient } from "@/lib/supabase/server";

import type {
  Employee,
  ManagementEmployee,
} from "@/types/employee";

const EMPLOYEE_OPERATIONAL_SELECT = `
  id,
  first_name,
  last_name,
  position,
  status
`;

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
