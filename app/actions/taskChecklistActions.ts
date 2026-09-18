"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";

import type { TaskChecklistItem } from "@/types/taskChecklistItem";

function validateId(
  value: number,
  errorMessage: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      errorMessage
    );
  }
}

function validateTaskData(taskId: number) {
  validateId(
    taskId,
    "Не вдалося визначити завдання."
  );
}

function normalizeTitle(
  title: string
) {
  const normalizedTitle =
    String(
      title ?? ""
    ).trim();

  if (!normalizedTitle) {
    throw new Error(
      "Введи назву пункту чекліста."
    );
  }

  if (
    normalizedTitle.length >
    250
  ) {
    throw new Error(
      "Назва пункту не може бути довшою за 250 символів."
    );
  }

  return normalizedTitle;
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

async function refreshTaskPages(taskId: number) {
  revalidatePath("/");
  revalidatePath("/task");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/employees");
  revalidatePath("/objects");
  revalidatePath("/equipment");
  revalidatePath(`/tasks/${taskId}`);
  const supabase = await createClient();
  const { data } = await supabase.from("object_tasks").select("object_id, equipment_id").eq("id", taskId).maybeSingle();
  if (data?.object_id) revalidatePath(`/objects/${data.object_id}`);
  if (data?.equipment_id) revalidatePath(`/equipment/${data.equipment_id}`);
}

export async function getTaskChecklistItems(
  taskId: number
): Promise<TaskChecklistItem[]> {
  await requireAuthenticatedUser();

  validateTaskData(
    taskId
  );

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "task_checklist_items"
    )
    .select(`
      id,
      task_id,
      title,
      is_completed,
      created_at
    `)
    .eq(
      "task_id",
      taskId
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    ).order("id", { ascending: true });

  if (error) {
    throw new Error(
      `Не вдалося завантажити чекліст: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? (data as TaskChecklistItem[])
    : [];
}

export async function addTaskChecklistItem(
  taskId: number,
  title: string
): Promise<TaskChecklistItem> {
  await requireAuthenticatedUser();

  validateTaskData(
    taskId
  );

  const normalizedTitle =
    normalizeTitle(
      title
    );

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "task_checklist_items"
    )
    .insert({
      task_id:
        taskId,

      title:
        normalizedTitle,

      is_completed:
        false,
    })
    .select(`
      id,
      task_id,
      title,
      is_completed,
      created_at
    `)
    .single();

  if (error) {
    throw new Error(
      `Не вдалося додати пункт: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Пункт додано, але не вдалося отримати його дані."
    );
  }

  await refreshTaskPages(taskId);

  return data as TaskChecklistItem;
}

export async function toggleTaskChecklistItem(
  itemId: number,
  taskId: number,
  isCompleted: boolean
): Promise<TaskChecklistItem> {
  await requireAuthenticatedUser();

  validateId(
    itemId,
    "Не вдалося визначити пункт чекліста."
  );

  validateTaskData(
    taskId
  );

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "task_checklist_items"
    )
    .update({
      is_completed:
        Boolean(
          isCompleted
        ),
    })
    .eq(
      "id",
      itemId
    )
    .eq(
      "task_id",
      taskId
    )
    .select(`
      id,
      task_id,
      title,
      is_completed,
      created_at
    `)
    .single();

  if (error) {
    throw new Error(
      `Не вдалося оновити пункт: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Пункт чекліста не знайдено."
    );
  }

  await refreshTaskPages(taskId);

  return data as TaskChecklistItem;
}

export async function deleteTaskChecklistItem(
  itemId: number,
  taskId: number
) {
  await requireAuthenticatedUser();

  validateId(
    itemId,
    "Не вдалося визначити пункт чекліста."
  );

  validateTaskData(
    taskId
  );

  const supabase =
    await createClient();

  const {
    error,
  } = await supabase
    .from(
      "task_checklist_items"
    )
    .delete()
    .eq(
      "id",
      itemId
    )
    .eq(
      "task_id",
      taskId
    );

  if (error) {
    throw new Error(
      `Не вдалося видалити пункт: ${error.message}`
    );
  }

  await refreshTaskPages(taskId);

  return {
    id: itemId,
  };
}
