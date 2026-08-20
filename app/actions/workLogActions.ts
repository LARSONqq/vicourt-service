"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageObjects } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

async function requireWorkLogManagementAccess() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Потрібно увійти в систему."
    );
  }

  if (
    !canManageObjects(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування журналом робіт."
    );
  }

  return profile;
}

async function getEmployeeAssignment(
  employeeValue: string,
  workersValue: string
) {
  if (!employeeValue) {
    return {
      employeeId: null,
      workers:
        workersValue || null,
      hourlyRate: 0,
    };
  }

  const employeeId =
    Number(employeeValue);

  if (
    !Number.isInteger(
      employeeId
    ) ||
    employeeId <= 0
  ) {
    throw new Error(
      "Неправильно вибраний працівник."
    );
  }

  const supabase =
    await createClient();

  const {
    data: employee,
    error,
  } = await supabase
    .from("employees")
    .select(`
      id,
      first_name,
      last_name,
      hourly_rate
    `)
    .eq(
      "id",
      employeeId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося завантажити працівника: ${error.message}`
    );
  }

  if (!employee) {
    throw new Error(
      "Вибраного працівника не знайдено."
    );
  }

  const fullName = [
    employee.last_name,
    employee.first_name,
  ]
    .filter(Boolean)
    .join(" ");

  const rawHourlyRate =
    Number(
      employee.hourly_rate ??
        0
    );

  const hourlyRate =
    Number.isFinite(
      rawHourlyRate
    ) &&
    rawHourlyRate >= 0
      ? rawHourlyRate
      : 0;

  return {
    employeeId:
      employee.id,

    workers:
      fullName ||
      workersValue ||
      null,

    hourlyRate,
  };
}

function refreshWorkLogPages(
  objectId: number,
  employeeIds: Array<
    number | null | undefined
  > = []
) {
  revalidatePath("/");
  revalidatePath("/objects");

  revalidatePath(
    `/objects/${objectId}`
  );

  revalidatePath(
    "/employees"
  );

  revalidatePath(
    "/reports"
  );

  const uniqueEmployeeIds =
    Array.from(
      new Set(
        employeeIds.filter(
          (
            employeeId
          ): employeeId is number =>
            Number.isInteger(
              employeeId
            ) &&
            Number(
              employeeId
            ) > 0
        )
      )
    );

  uniqueEmployeeIds.forEach(
    (employeeId) => {
      revalidatePath(
        `/employees/${employeeId}`
      );
    }
  );
}

export async function createWorkLog(
  formData: FormData
) {
  await requireWorkLogManagementAccess();

  const supabase =
    await createClient();

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const workDate =
    getText(
      formData,
      "work_date"
    );

  const description =
    getText(
      formData,
      "description"
    );

  const workersValue =
    getText(
      formData,
      "workers"
    );

  const employeeValue =
    getText(
      formData,
      "employee_id"
    );

  const hoursValue =
    getText(
      formData,
      "hours"
    );

  const hours =
    hoursValue
      ? Number(
          hoursValue
        )
      : 0;

  if (
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0 ||
    !workDate ||
    !description
  ) {
    throw new Error(
      "Заповни дату та опис роботи."
    );
  }

  if (
    !Number.isFinite(
      hours
    ) ||
    hours < 0
  ) {
    throw new Error(
      "Кількість годин має бути правильним невід’ємним числом."
    );
  }

  const assignment =
    await getEmployeeAssignment(
      employeeValue,
      workersValue
    );

  const {
    error,
  } = await supabase
    .from("work_logs")
    .insert({
      object_id:
        objectId,

      work_date:
        workDate,

      description,

      employee_id:
        assignment.employeeId,

      workers:
        assignment.workers,

      hours,

      hourly_rate:
        assignment.hourlyRate,
    });

  if (error) {
    throw new Error(
      `Не вдалося додати запис роботи: ${error.message}`
    );
  }

  refreshWorkLogPages(
    objectId,
    [
      assignment.employeeId,
    ]
  );
}

export async function updateWorkLog(
  formData: FormData
) {
  await requireWorkLogManagementAccess();

  const supabase =
    await createClient();

  const workLogId =
    Number(
      formData.get(
        "work_log_id"
      )
    );

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const workDate =
    getText(
      formData,
      "work_date"
    );

  const description =
    getText(
      formData,
      "description"
    );

  const workersValue =
    getText(
      formData,
      "workers"
    );

  const employeeValue =
    getText(
      formData,
      "employee_id"
    );

  const hoursValue =
    getText(
      formData,
      "hours"
    );

  const hours =
    hoursValue
      ? Number(
          hoursValue
        )
      : 0;

  if (
    !Number.isInteger(
      workLogId
    ) ||
    workLogId <= 0 ||
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0 ||
    !workDate ||
    !description
  ) {
    throw new Error(
      "Заповни дату та опис роботи."
    );
  }

  if (
    !Number.isFinite(
      hours
    ) ||
    hours < 0
  ) {
    throw new Error(
      "Кількість годин має бути правильним невід’ємним числом."
    );
  }

  const {
    data: previousWorkLog,
    error: previousWorkLogError,
  } = await supabase
    .from("work_logs")
    .select(`
      employee_id,
      hourly_rate
    `)
    .eq(
      "id",
      workLogId
    )
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle();

  if (
    previousWorkLogError
  ) {
    throw new Error(
      `Не вдалося завантажити запис роботи: ${previousWorkLogError.message}`
    );
  }

  if (
    !previousWorkLog
  ) {
    throw new Error(
      "Запис роботи не знайдено."
    );
  }

  const assignment =
    await getEmployeeAssignment(
      employeeValue,
      workersValue
    );

  const previousEmployeeId =
    previousWorkLog.employee_id
      ? Number(
          previousWorkLog.employee_id
        )
      : null;

  const previousHourlyRate =
    Number(
      previousWorkLog.hourly_rate ??
        0
    );

  const hourlyRate =
    assignment.employeeId ===
      previousEmployeeId
      ? (
          Number.isFinite(
            previousHourlyRate
          ) &&
          previousHourlyRate >= 0
            ? previousHourlyRate
            : 0
        )
      : assignment.hourlyRate;

  const {
    error,
  } = await supabase
    .from("work_logs")
    .update({
      work_date:
        workDate,

      description,

      employee_id:
        assignment.employeeId,

      workers:
        assignment.workers,

      hours,

      hourly_rate:
        hourlyRate,
    })
    .eq(
      "id",
      workLogId
    )
    .eq(
      "object_id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося оновити запис роботи: ${error.message}`
    );
  }

  refreshWorkLogPages(
    objectId,
    [
      previousEmployeeId,
      assignment.employeeId,
    ]
  );
}

export async function deleteWorkLog(
  workLogId: number,
  objectId: number
) {
  await requireWorkLogManagementAccess();

  const supabase =
    await createClient();

  if (
    !Number.isInteger(
      workLogId
    ) ||
    workLogId <= 0 ||
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити запис."
    );
  }

  const {
    data: workLog,
    error:
      workLogError,
  } = await supabase
    .from("work_logs")
    .select(
      "employee_id"
    )
    .eq(
      "id",
      workLogId
    )
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle();

  if (workLogError) {
    throw new Error(
      `Не вдалося завантажити запис роботи: ${workLogError.message}`
    );
  }

  if (!workLog) {
    throw new Error(
      "Запис роботи не знайдено."
    );
  }

  const {
    error,
  } = await supabase
    .from("work_logs")
    .delete()
    .eq(
      "id",
      workLogId
    )
    .eq(
      "object_id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося видалити запис роботи: ${error.message}`
    );
  }

  refreshWorkLogPages(
    objectId,
    [
      workLog.employee_id
        ? Number(
            workLog.employee_id
          )
        : null,
    ]
  );
}