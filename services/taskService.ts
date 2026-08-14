import { createClient } from "@/lib/supabase/server";

import type { TaskWithObject } from "@/types/taskWithObject";

const priorityOrder: Record<
  string,
  number
> = {
  Терміновий: 1,
  Високий: 2,
  Середній: 3,
  Низький: 4,
};

export async function getAllTasks(): Promise<
  TaskWithObject[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("object_tasks")
    .select(`
      id,
      object_id,
      title,
      description,
      due_date,
      assignee,
      assigned_employee_id,
      priority,
      status,
      created_at,
      object:objects (
        id,
        name
      ),
      checklist_items:task_checklist_items (
        id,
        is_completed
      )
    `)
    .overrideTypes<
      TaskWithObject[]
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити завдання: ${error.message}`
    );
  }

  const tasks =
    Array.isArray(data)
      ? data
      : [];

  return tasks.sort(
    (
      firstTask,
      secondTask
    ) => {
      const firstPriority =
        priorityOrder[
          firstTask.priority
        ] ?? 3;

      const secondPriority =
        priorityOrder[
          secondTask.priority
        ] ?? 3;

      if (
        firstPriority !==
        secondPriority
      ) {
        return (
          firstPriority -
          secondPriority
        );
      }

      if (
        firstTask.due_date &&
        secondTask.due_date
      ) {
        return firstTask.due_date.localeCompare(
          secondTask.due_date
        );
      }

      if (
        firstTask.due_date
      ) {
        return -1;
      }

      if (
        secondTask.due_date
      ) {
        return 1;
      }

      return secondTask.created_at.localeCompare(
        firstTask.created_at
      );
    }
  );
}