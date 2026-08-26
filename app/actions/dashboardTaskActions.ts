"use server";

import { revalidatePath } from "next/cache";

import {
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";
import {
  completeSupervisionCycle,
  rescheduleSupervisionTask,
} from "@/services/supervisionTaskService";

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

async function getTaskSnapshot(
  taskId: number,
  objectId: number
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("object_tasks")
    .select(`
      id,
      title,
      status,
      due_date,
      task_source
    `)
    .eq(
      "id",
      taskId
    )
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося завантажити завдання: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Завдання не знайдено."
    );
  }

  return data;
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

  const task =
    await getTaskSnapshot(
      taskId,
      objectId
    );

  if (
    task.task_source ===
    SUPERVISION_TASK_SOURCE
  ) {
    await completeSupervisionCycle({
      objectId,
      taskId,
    });

    refreshDashboardTaskPages(
      objectId
    );

    return {
      id: taskId,
      status:
        "Виконано",
    };
  }

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

  await recordActivity({
    action:
      "task.completed",
    entityType:
      "task",
    entityId:
      task.id,
    entityName:
      task.title,
    objectId,
    description:
      `Виконав завдання «${task.title}».`,
    metadata: {
      previous_status:
        task.status,
      new_status:
        "Виконано",
    },
  });

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

  const task =
    await getTaskSnapshot(
      taskId,
      objectId
    );

  if (
    task.task_source ===
    SUPERVISION_TASK_SOURCE
  ) {
    const result =
      await rescheduleSupervisionTask({
        taskId,
        objectId,
        dueDate:
          normalizedDueDate,
      });

    refreshDashboardTaskPages(
      objectId
    );

    return result;
  }

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

  await recordActivity({
    action:
      "task.rescheduled",
    entityType:
      "task",
    entityId:
      task.id,
    entityName:
      task.title,
    objectId,
    description:
      `Переніс дату завдання «${task.title}»: ${task.due_date || "без дати"} → ${normalizedDueDate}.`,
    metadata: {
      previous_due_date:
        task.due_date,
      new_due_date:
        normalizedDueDate,
    },
  });

  refreshDashboardTaskPages(
    objectId
  );

  return {
    id: taskId,
    dueDate:
      normalizedDueDate,
  };
}
