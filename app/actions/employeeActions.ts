"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  canManageEmployees,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";
import {
  getEmployeeProfile,
} from "@/services/employeeDetailService";
import {
  recordActivity,
} from "@/services/activityLogService";

import {
  employmentTypes,
  employeeStatuses,
  employeePositions,
} from "@/constants/employees";

import type {
  ActivityMetadata,
} from "@/types/activityLog";
import type {
  ManagementEmployee,
} from "@/types/employee";

type EmployeeActivitySnapshot = Pick<
  ManagementEmployee,
  | "id"
  | "first_name"
  | "last_name"
  | "phone"
  | "email"
  | "position"
  | "employment_type"
  | "status"
  | "hire_date"
  | "notes"
  | "hourly_rate"
>;

async function requireEmployeeManagement() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для виконання цієї дії потрібно увійти в систему."
    );
  }

  if (
    !canManageEmployees(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування працівниками."
    );
  }

  return profile;
}

function getEmployeeFullName(
  employee: Pick<
    EmployeeActivitySnapshot,
    "first_name" | "last_name"
  >
) {
  return [
    employee.last_name,
    employee.first_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getEmployeeActivityValues(
  employee: EmployeeActivitySnapshot
): ActivityMetadata {
  return {
    position:
      employee.position,
    employment_type:
      employee.employment_type,
    status: employee.status,
    hire_date:
      employee.hire_date,
    hourly_rate:
      employee.hourly_rate,
  };
}

function buildEmployeeUpdateMetadata(
  previous: EmployeeActivitySnapshot,
  next: EmployeeActivitySnapshot
) {
  const metadata: ActivityMetadata =
    {};

  function addChange(
    key: string,
    previousValue:
      | string
      | number
      | null,
    nextValue:
      | string
      | number
      | null
  ) {
    if (
      previousValue ===
      nextValue
    ) {
      return;
    }

    metadata[
      `previous_${key}`
    ] = previousValue;
    metadata[
      `new_${key}`
    ] = nextValue;
  }

  addChange(
    "name",
    getEmployeeFullName(
      previous
    ),
    getEmployeeFullName(next)
  );
  addChange(
    "position",
    previous.position,
    next.position
  );
  addChange(
    "employment_type",
    previous.employment_type,
    next.employment_type
  );
  addChange(
    "status",
    previous.status,
    next.status
  );
  addChange(
    "hire_date",
    previous.hire_date,
    next.hire_date
  );
  addChange(
    "hourly_rate",
    previous.hourly_rate,
    next.hourly_rate
  );

  if (
    previous.phone !== next.phone
  ) {
    metadata.phone_changed =
      true;
  }
  if (
    previous.email !== next.email
  ) {
    metadata.email_changed =
      true;
  }
  if (
    previous.notes !== next.notes
  ) {
    metadata.notes_changed =
      true;
  }

  return metadata;
}

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function getNonNegativeNumber(
  formData: FormData,
  field: string
) {
  const rawValue =
    String(
      formData.get(field) ?? ""
    ).trim();

  if (!rawValue) {
    return 0;
  }

  const value =
    Number(rawValue);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      "Погодинна ставка має бути правильним невід’ємним числом."
    );
  }

  return value;
}

function validateEmployee(
  firstName: string,
  lastName: string,
  email: string,
  position: string,
  employmentType: string,
  status: string,
  hourlyRate: number
) {
  if (!firstName) {
    throw new Error(
      "Вкажи ім’я працівника."
    );
  }

  if (!lastName) {
    throw new Error(
      "Вкажи прізвище працівника."
    );
  }

  if (
    !employmentTypes.includes(
      employmentType as (typeof employmentTypes)[number]
    )
  ) {
    throw new Error(
      "Обери тип роботи."
    );
  }

  if (
    !employeeStatuses.includes(
      status as (typeof employeeStatuses)[number]
    )
  ) {
    throw new Error(
      "Обери статус працівника."
    );
  }

  if (
    position &&
    !employeePositions.includes(
      position as (typeof employeePositions)[number]
    )
  ) {
    throw new Error(
      "Обери правильну посаду."
    );
  }

  if (
    email &&
    !email.includes("@")
  ) {
    throw new Error(
      "Вкажи правильну електронну адресу."
    );
  }

  if (
    !Number.isFinite(
      hourlyRate
    ) ||
    hourlyRate < 0
  ) {
    throw new Error(
      "Погодинна ставка має бути правильним невід’ємним числом."
    );
  }
}

export async function createEmployee(
  formData: FormData
) {
  await requireEmployeeManagement();

  const supabase =
    await createClient();

  const firstName =
    getText(
      formData,
      "first_name"
    );

  const lastName =
    getText(
      formData,
      "last_name"
    );

  const phone =
    getText(
      formData,
      "phone"
    );

  const email =
    getText(
      formData,
      "email"
    );

  const position =
    getText(
      formData,
      "position"
    );

  const employmentType =
    getText(
      formData,
      "employment_type"
    );

  const status =
    getText(
      formData,
      "status"
    );

  const hireDate =
    getText(
      formData,
      "hire_date"
    );

  const notes =
    getText(
      formData,
      "notes"
    );

  const hourlyRate =
    getNonNegativeNumber(
      formData,
      "hourly_rate"
    );

  validateEmployee(
    firstName,
    lastName,
    email,
    position,
    employmentType,
    status,
    hourlyRate
  );

  const {
    data: createdEmployee,
    error,
  } =
    await supabase
      .from("employees")
      .insert({
        first_name:
          firstName,

        last_name:
          lastName,

        phone:
          phone || null,

        email:
          email || null,

        position:
          position || null,

        employment_type:
          employmentType,

        status,

        hire_date:
          hireDate || null,

        notes:
          notes || null,

        hourly_rate:
          hourlyRate,
      })
      .select("id")
      .single();

  if (error) {
    throw new Error(
      `Не вдалося додати працівника: ${error.message}`
    );
  }

  const employeeSnapshot: EmployeeActivitySnapshot = {
    id: Number(
      createdEmployee.id
    ),
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    email: email || null,
    position:
      position || null,
    employment_type:
      employmentType as EmployeeActivitySnapshot["employment_type"],
    status:
      status as EmployeeActivitySnapshot["status"],
    hire_date:
      hireDate || null,
    notes: notes || null,
    hourly_rate:
      hourlyRate,
  };
  const employeeName =
    getEmployeeFullName(
      employeeSnapshot
    );

  await recordActivity({
    action: "employee.created",
    entityType: "employee",
    entityId:
      employeeSnapshot.id,
    entityName: employeeName,
    description: `Створено працівника «${employeeName}».`,
    metadata:
      getEmployeeActivityValues(
        employeeSnapshot
      ),
  });

  revalidatePath("/");
  revalidatePath(
    "/employees"
  );
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/objects"
  );
  revalidatePath(
    "/task"
  );
  revalidatePath(
    "/reports"
  );
  revalidatePath(
    "/users"
  );
}

export async function updateEmployee(
  formData: FormData
) {
  await requireEmployeeManagement();

  const supabase =
    await createClient();

  const employeeId =
    Number(
      formData.get(
        "employee_id"
      )
    );

  const firstName =
    getText(
      formData,
      "first_name"
    );

  const lastName =
    getText(
      formData,
      "last_name"
    );

  const phone =
    getText(
      formData,
      "phone"
    );

  const email =
    getText(
      formData,
      "email"
    );

  const position =
    getText(
      formData,
      "position"
    );

  const employmentType =
    getText(
      formData,
      "employment_type"
    );

  const status =
    getText(
      formData,
      "status"
    );

  const hireDate =
    getText(
      formData,
      "hire_date"
    );

  const notes =
    getText(
      formData,
      "notes"
    );

  const hourlyRate =
    getNonNegativeNumber(
      formData,
      "hourly_rate"
    );

  if (
    !Number.isInteger(
      employeeId
    ) ||
    employeeId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити працівника."
    );
  }

  validateEmployee(
    firstName,
    lastName,
    email,
    position,
    employmentType,
    status,
    hourlyRate
  );

  const previousEmployee =
    await getEmployeeProfile(
      employeeId
    );

  if (!previousEmployee) {
    throw new Error(
      "Працівника не знайдено."
    );
  }

  const {
    data: updatedEmployee,
    error,
  } =
    await supabase
      .from("employees")
      .update({
        first_name:
          firstName,

        last_name:
          lastName,

        phone:
          phone || null,

        email:
          email || null,

        position:
          position || null,

        employment_type:
          employmentType,

        status,

        hire_date:
          hireDate || null,

        notes:
          notes || null,

        hourly_rate:
          hourlyRate,
      })
      .eq(
        "id",
        employeeId
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося оновити працівника: ${error.message}`
    );
  }

  if (!updatedEmployee) {
    throw new Error(
      "Працівника не знайдено."
    );
  }

  const nextEmployee: EmployeeActivitySnapshot = {
    id: employeeId,
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    email: email || null,
    position:
      position || null,
    employment_type:
      employmentType as EmployeeActivitySnapshot["employment_type"],
    status:
      status as EmployeeActivitySnapshot["status"],
    hire_date:
      hireDate || null,
    notes: notes || null,
    hourly_rate:
      hourlyRate,
  };
  const employeeName =
    getEmployeeFullName(
      nextEmployee
    );

  await recordActivity({
    action: "employee.updated",
    entityType: "employee",
    entityId: employeeId,
    entityName: employeeName,
    description: `Оновлено дані працівника «${employeeName}».`,
    metadata:
      buildEmployeeUpdateMetadata(
        previousEmployee,
        nextEmployee
      ),
  });

  revalidatePath("/");
  revalidatePath(
    "/employees"
  );
  revalidatePath(
    `/employees/${employeeId}`
  );
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/objects"
  );
  revalidatePath(
    "/task"
  );
  revalidatePath(
    "/reports"
  );
  revalidatePath(
    "/users"
  );
}

export async function deleteEmployee(
  employeeId: number
) {
  await requireEmployeeManagement();

  const supabase =
    await createClient();

  if (
    !Number.isInteger(
      employeeId
    ) ||
    employeeId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити працівника."
    );
  }

  const employee =
    await getEmployeeProfile(
      employeeId
    );

  if (!employee) {
    throw new Error(
      "Працівника не знайдено."
    );
  }

  const {
    data: deletedEmployee,
    error,
  } =
    await supabase
      .from("employees")
      .delete()
      .eq(
        "id",
        employeeId
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося видалити працівника: ${error.message}`
    );
  }

  if (!deletedEmployee) {
    throw new Error(
      "Працівника не знайдено."
    );
  }

  const employeeName =
    getEmployeeFullName(
      employee
    );

  await recordActivity({
    action: "employee.deleted",
    entityType: "employee",
    entityId: employeeId,
    entityName: employeeName,
    description: `Видалено працівника «${employeeName}».`,
    metadata:
      getEmployeeActivityValues(
        employee
      ),
  });

  revalidatePath("/");
  revalidatePath(
    "/employees"
  );
  revalidatePath(
    "/equipment"
  );
  revalidatePath(
    "/objects"
  );
  revalidatePath(
    "/task"
  );
  revalidatePath(
    "/reports"
  );
  revalidatePath(
    "/users"
  );
}
