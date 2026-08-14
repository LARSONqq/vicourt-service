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
  employmentTypes,
  employeeStatuses,
  employeePositions,
} from "@/constants/employees";

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

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function validateEmployee(
  firstName: string,
  lastName: string,
  email: string,
  position: string,
  employmentType: string,
  status: string
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

  validateEmployee(
    firstName,
    lastName,
    email,
    position,
    employmentType,
    status
  );

  const { error } =
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
      });

  if (error) {
    throw new Error(
      `Не вдалося додати працівника: ${error.message}`
    );
  }

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
    status
  );

  const { error } =
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
      })
      .eq(
        "id",
        employeeId
      );

  if (error) {
    throw new Error(
      `Не вдалося оновити працівника: ${error.message}`
    );
  }

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

  const { error } =
    await supabase
      .from("employees")
      .delete()
      .eq(
        "id",
        employeeId
      );

  if (error) {
    throw new Error(
      `Не вдалося видалити працівника: ${error.message}`
    );
  }

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