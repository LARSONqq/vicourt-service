"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageObjects } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

import {
  getWorkLogAttachmentMetadataValidationError,
  WORK_LOG_ATTACHMENTS_BUCKET,
  type WorkLogAttachmentMetadata,
} from "@/constants/workLogAttachments";

type ManagementEmployeeSnapshot = {
  id: number;
  first_name: string;
  last_name: string;
  hourly_rate: number;
};

type ManagementWorkLogSnapshot = {
  id: number;
  object_id: number;
  employee_id: number | null;
  work_date: string;
  description: string;
  workers: string | null;
  hours: number;
  hourly_rate: number;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
};

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function getAttachmentMetadata(
  formData: FormData,
  objectId: number,
  required = false
): WorkLogAttachmentMetadata | null {
  const attachmentPath =
    getText(
      formData,
      "attachment_path"
    );

  const attachmentName =
    getText(
      formData,
      "attachment_name"
    );

  const attachmentType =
    getText(
      formData,
      "attachment_type"
    );

  const attachmentSizeValue =
    getText(
      formData,
      "attachment_size"
    );

  const hasAttachmentData =
    Boolean(
      attachmentPath ||
        attachmentName ||
        attachmentType ||
        attachmentSizeValue
    );

  if (
    !hasAttachmentData &&
    !required
  ) {
    return null;
  }

  if (
    !attachmentPath ||
    !attachmentName ||
    !attachmentType ||
    !attachmentSizeValue
  ) {
    throw new Error(
      "Не вдалося визначити прикріплений файл."
    );
  }

  const metadata = {
    attachmentPath,
    attachmentName,
    attachmentType,
    attachmentSize: Number(
      attachmentSizeValue
    ),
  };

  const validationError =
    getWorkLogAttachmentMetadataValidationError(
      metadata,
      objectId
    );

  if (validationError) {
    throw new Error(
      validationError
    );
  }

  return metadata;
}

function getWorkLogEntityName(
  workDate: string,
  description: string
) {
  const shortDescription =
    description.length > 80
      ? `${description.slice(
          0,
          77
        )}...`
      : description;

  return `${workDate} — ${shortDescription}`;
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
    .rpc(
      "get_management_employees"
    )
    .eq(
      "id",
      employeeId
    )
    .maybeSingle()
    .overrideTypes<
      ManagementEmployeeSnapshot | null,
      { merge: false }
    >();

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

  const attachment =
    getAttachmentMetadata(
      formData,
      objectId
    );

  const assignment =
    await getEmployeeAssignment(
      employeeValue,
      workersValue
    );

  const {
    data: createdWorkLog,
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

      attachment_path:
        attachment
          ?.attachmentPath ||
        null,

      attachment_name:
        attachment
          ?.attachmentName ||
        null,

      attachment_type:
        attachment
          ?.attachmentType ||
        null,

      attachment_size:
        attachment
          ?.attachmentSize ||
        null,
    })
    .select(`
      id,
      work_date,
      description,
      hours,
      workers,
      attachment_name
    `)
    .single();

  if (error) {
    throw new Error(
      `Не вдалося додати запис роботи: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "work_log.created",
    entityType:
      "work_log",
    entityId:
      createdWorkLog.id,
    entityName:
      getWorkLogEntityName(
        createdWorkLog.work_date,
        createdWorkLog.description
      ),
    objectId,
    description:
      attachment
        ? `Створив запис журналу робіт за ${createdWorkLog.work_date} та прикріпив файл «${createdWorkLog.attachment_name}».`
        : `Створив запис журналу робіт за ${createdWorkLog.work_date}.`,
    metadata: {
      work_date:
        createdWorkLog.work_date,
      hours:
        Number(
          createdWorkLog.hours
        ),
      workers:
        createdWorkLog.workers,
      attachment_action:
        attachment
          ? "added"
          : null,
      attachment_name:
        createdWorkLog.attachment_name,
    },
  });

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

  const attachmentAction =
    getText(
      formData,
      "attachment_action"
    ) || "keep";

  if (
    attachmentAction !==
      "keep" &&
    attachmentAction !==
      "replace" &&
    attachmentAction !==
      "remove"
  ) {
    throw new Error(
      "Неправильна дія з прикріпленим файлом."
    );
  }

  const nextAttachment =
    attachmentAction ===
    "replace"
      ? getAttachmentMetadata(
          formData,
          objectId,
          true
        )
      : null;

  const {
    data: previousWorkLog,
    error: previousWorkLogError,
  } = await supabase
    .rpc(
      "get_management_work_logs"
    )
    .eq(
      "id",
      workLogId
    )
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle()
    .overrideTypes<
      ManagementWorkLogSnapshot | null,
      { merge: false }
    >();

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

  const updateValues: {
    work_date: string;
    description: string;
    employee_id: number | null;
    workers: string | null;
    hours: number;
    hourly_rate: number;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_size?: number | null;
  } = {
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
  };

  if (
    attachmentAction ===
    "replace" &&
    nextAttachment
  ) {
    updateValues.attachment_path =
      nextAttachment.attachmentPath;

    updateValues.attachment_name =
      nextAttachment.attachmentName;

    updateValues.attachment_type =
      nextAttachment.attachmentType;

    updateValues.attachment_size =
      nextAttachment.attachmentSize;
  }

  if (
    attachmentAction ===
    "remove"
  ) {
    updateValues.attachment_path =
      null;

    updateValues.attachment_name =
      null;

    updateValues.attachment_type =
      null;

    updateValues.attachment_size =
      null;
  }

  const {
    error,
  } = await supabase
    .from("work_logs")
    .update(
      updateValues
    )
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

  let attachmentWarning:
    | string
    | null = null;

  const previousAttachmentPath =
    previousWorkLog.attachment_path ||
    null;

  const shouldDeletePreviousAttachment =
    attachmentAction !==
      "keep" &&
    previousAttachmentPath &&
    previousAttachmentPath !==
      nextAttachment
        ?.attachmentPath;

  if (
    shouldDeletePreviousAttachment
  ) {
    const {
      error: storageError,
    } = await supabase.storage
      .from(
        WORK_LOG_ATTACHMENTS_BUCKET
      )
      .remove([
        previousAttachmentPath,
      ]);

    if (storageError) {
      attachmentWarning =
        `Запис збережено, але старий файл не вдалося видалити зі Storage: ${storageError.message}`;
    }
  }

  const attachmentChange =
    attachmentAction ===
      "replace"
      ? (
          previousAttachmentPath
            ? "replaced"
            : "added"
        )
      : attachmentAction ===
          "remove" &&
        previousAttachmentPath
        ? "removed"
        : null;

  const attachmentDescription =
    attachmentChange ===
    "replaced"
      ? ` Замінив файл «${previousWorkLog.attachment_name || "без назви"}» на «${nextAttachment?.attachmentName || "без назви"}».`
      : attachmentChange ===
        "added"
        ? ` Прикріпив файл «${nextAttachment?.attachmentName || "без назви"}».`
        : attachmentChange ===
          "removed"
          ? ` Видалив прикріплений файл «${previousWorkLog.attachment_name || "без назви"}».`
          : "";

  await recordActivity({
    action:
      "work_log.updated",
    entityType:
      "work_log",
    entityId:
      workLogId,
    entityName:
      getWorkLogEntityName(
        workDate,
        description
      ),
    objectId,
    description:
      `Відредагував запис журналу робіт за ${workDate}.${attachmentDescription}`,
    metadata: {
      previous_work_date:
        previousWorkLog.work_date,
      new_work_date:
        workDate,
      previous_hours:
        Number(
          previousWorkLog.hours
        ),
      new_hours:
        hours,
      attachment_action:
        attachmentChange,
      previous_attachment_name:
        previousWorkLog.attachment_name,
      new_attachment_name:
        nextAttachment
          ?.attachmentName ||
        (
          attachmentAction ===
          "keep"
            ? previousWorkLog.attachment_name
            : null
        ),
    },
  });

  refreshWorkLogPages(
    objectId,
    [
      previousEmployeeId,
      assignment.employeeId,
    ]
  );

  return {
    warning:
      attachmentWarning,
  };
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
    .select(`
      id,
      employee_id,
      work_date,
      description,
      workers,
      hours,
      attachment_path,
      attachment_name
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

  if (
    workLog.attachment_path
  ) {
    const {
      error: storageError,
    } = await supabase.storage
      .from(
        WORK_LOG_ATTACHMENTS_BUCKET
      )
      .remove([
        workLog.attachment_path,
      ]);

    if (storageError) {
      throw new Error(
        `Не вдалося видалити прикріплений файл: ${storageError.message}`
      );
    }
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

  await recordActivity({
    action:
      "work_log.deleted",
    entityType:
      "work_log",
    entityId:
      workLog.id,
    entityName:
      getWorkLogEntityName(
        workLog.work_date,
        workLog.description
      ),
    objectId,
    description:
      `Видалив запис журналу робіт за ${workLog.work_date}.`,
    metadata: {
      work_date:
        workLog.work_date,
      hours:
        Number(
          workLog.hours
        ),
      workers:
        workLog.workers,
      attachment_removed:
        Boolean(
          workLog.attachment_path
        ),
      attachment_name:
        workLog.attachment_name,
    },
  });

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
