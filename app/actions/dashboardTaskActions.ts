"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";

function validateTaskIds(
  taskId: number,
  objectId: number
) {
  if (
    !Number.isInteger(taskId) ||
    taskId <= 0 ||
    !Number.isInteger(objectId) ||
    objectId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити завдання."
    );
  }
}

function validateDueDate(
  dueDate: string
) {
  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (
    !datePattern.test(
      dueDate
    )
  ) {
    throw new Error(
      "Дата завдання має неправильний формат."
    );
  }

  const [
    year,
    month,
    day,
  ] = dueDate
    .split("-")
    .map(Number);

  const parsedDate =
    new Date(
      year,
      month - 1,
      day
    );

  const isValidDate =
    parsedDate.getFullYear() ===
      year &&
    parsedDate.getMonth() ===
      month - 1 &&
    parsedDate.getDate() ===
      day;

  if (!isValidDate) {
    throw new Error(
      "Вказано неправильну дату завдання."
    );
  }
}

async function requireAuthenticatedUser() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Потрібно увійти в систему."
    );
  }

  return profile;
}

function refreshDashboardTaskPages(
  objectId: number
) {
  revalidatePath("/");
  revalidatePath("/task");
  revalidatePath("/calendar");
  revalidatePath("/employees");
  revalidatePath("/objects");
  revalidatePath(
    `/objects/${objectId}`
  );
}

export async function completeDashboardTask(
  taskId: number,
  objectId: number
) {
  await requireAuthenticatedUser();

  validateTaskIds(
    taskId,
    objectId
  );

  const supabase =
    await createClient();

  const {
    error,
  } = await supabase
    .from(
      "object_tasks"
    )
    .update({
      status:
        "Виконано",
    })
    .eq(
      "id",
      taskId
    )
    .eq(
      "object_id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося виконати завдання: ${error.message}`
    );
  }

  refreshDashboardTaskPages(
    objectId
  );

  return {
    id: taskId,
    status:
      "Виконано",
  };
}

export async function rescheduleDashboardTask(
  taskId: number,
  objectId: number,
  dueDate: string
) {
  await requireAuthenticatedUser();

  validateTaskIds(
    taskId,
    objectId
  );

  const normalizedDueDate =
    String(
      dueDate
    ).trim();

  validateDueDate(
    normalizedDueDate
  );

  const supabase =
    await createClient();

  const {
    error,
  } = await supabase
    .from(
      "object_tasks"
    )
    .update({
      due_date:
        normalizedDueDate,
    })
    .eq(
      "id",
      taskId
    )
    .eq(
      "object_id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося перенести завдання: ${error.message}`
    );
  }

  refreshDashboardTaskPages(
    objectId
  );

  return {
    id: taskId,
    dueDate:
      normalizedDueDate,
  };
}