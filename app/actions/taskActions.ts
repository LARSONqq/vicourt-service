"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";
import { recordActivity } from "@/services/activityLogService";

import type { TaskPriority } from "@/types/objectTask";

const allowedStatuses = [
  "Заплановано",
  "В роботі",
  "Виконано",
];

const allowedPriorities: TaskPriority[] = [
  "Низький",
  "Середній",
  "Високий",
  "Терміновий",
];

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
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

function refreshTaskPages(
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

function validateTaskIds(
  taskId: number,
  objectId: number
) {
  if (
    !Number.isInteger(
      taskId
    ) ||
    taskId <= 0 ||
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити завдання."
    );
  }
}

function validateStatus(
  status: string
) {
  if (
    !allowedStatuses.includes(
      status
    )
  ) {
    throw new Error(
      "Вибрано неправильний статус завдання."
    );
  }
}

function validatePriority(
  priority: string
): asserts priority is TaskPriority {
  if (
    !allowedPriorities.includes(
      priority as TaskPriority
    )
  ) {
    throw new Error(
      "Вибрано неправильний пріоритет завдання."
    );
  }
}

function validateDueDate(
  dueDate: string
) {
  if (!dueDate) {
    return;
  }

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

async function getAssignedEmployee(
  employeeValue: string,
  oldAssigneeValue: string
) {
  if (!employeeValue) {
    return {
      employeeId: null,
      assignee:
        oldAssigneeValue ||
        null,
    };
  }

  const employeeId =
    Number(
      employeeValue
    );

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
      last_name
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

  return {
    employeeId:
      Number(
        employee.id
      ),

    assignee:
      fullName ||
      null,
  };
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
      priority
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

export async function createObjectTask(
  formData: FormData
) {
  await requireAuthenticatedUser();

  const supabase =
    await createClient();

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const title =
    getText(
      formData,
      "title"
    );

  const description =
    getText(
      formData,
      "description"
    );

  const dueDate =
    getText(
      formData,
      "due_date"
    );

  const employeeValue =
    getText(
      formData,
      "assigned_employee_id"
    );

  const oldAssigneeValue =
    getText(
      formData,
      "assignee"
    );

  const status =
    getText(
      formData,
      "status"
    ) || "Заплановано";

  const priority =
    getText(
      formData,
      "priority"
    ) || "Середній";

  if (
    !Number.isInteger(
      objectId
    ) ||
    objectId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити об’єкт."
    );
  }

  if (!title) {
    throw new Error(
      "Введи назву завдання."
    );
  }

  validateDueDate(
    dueDate
  );

  validateStatus(
    status
  );

  validatePriority(
    priority
  );

  const assignment =
    await getAssignedEmployee(
      employeeValue,
      oldAssigneeValue
    );

  const {
    data: createdTask,
    error,
  } = await supabase
    .from(
      "object_tasks"
    )
    .insert({
      object_id:
        objectId,

      title,

      description:
        description ||
        null,

      due_date:
        dueDate ||
        null,

      assigned_employee_id:
        assignment.employeeId,

      assignee:
        assignment.assignee,

      priority,

      status,
    })
    .select(`
      id,
      title,
      status,
      due_date,
      priority
    `)
    .single();

  if (error) {
    throw new Error(
      `Не вдалося створити завдання: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "task.created",
    entityType:
      "task",
    entityId:
      createdTask.id,
    entityName:
      createdTask.title,
    objectId,
    description:
      `Створив завдання «${createdTask.title}».`,
    metadata: {
      status:
        createdTask.status,
      priority:
        createdTask.priority,
      due_date:
        createdTask.due_date,
    },
  });

  refreshTaskPages(
    objectId
  );
}

export async function updateObjectTask(
  formData: FormData
) {
  await requireAuthenticatedUser();

  const supabase =
    await createClient();

  const taskId =
    Number(
      formData.get(
        "task_id"
      )
    );

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const title =
    getText(
      formData,
      "title"
    );

  const description =
    getText(
      formData,
      "description"
    );

  const dueDate =
    getText(
      formData,
      "due_date"
    );

  const employeeValue =
    getText(
      formData,
      "assigned_employee_id"
    );

  const oldAssigneeValue =
    getText(
      formData,
      "assignee"
    );

  const status =
    getText(
      formData,
      "status"
    ) || "Заплановано";

  const priority =
    getText(
      formData,
      "priority"
    ) || "Середній";

  validateTaskIds(
    taskId,
    objectId
  );

  if (!title) {
    throw new Error(
      "Введи назву завдання."
    );
  }

  validateDueDate(
    dueDate
  );

  validateStatus(
    status
  );

  validatePriority(
    priority
  );

  const previousTask =
    await getTaskSnapshot(
      taskId,
      objectId
    );

  const assignment =
    await getAssignedEmployee(
      employeeValue,
      oldAssigneeValue
    );

  const {
    error,
  } = await supabase
    .from(
      "object_tasks"
    )
    .update({
      title,

      description:
        description ||
        null,

      due_date:
        dueDate ||
        null,

      assigned_employee_id:
        assignment.employeeId,

      assignee:
        assignment.assignee,

      priority,

      status,
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
      `Не вдалося оновити завдання: ${error.message}`
    );
  }

  const completed =
    previousTask.status !==
      "Виконано" &&
    status === "Виконано";

  await recordActivity({
    action: completed
      ? "task.completed"
      : "task.updated",
    entityType:
      "task",
    entityId:
      taskId,
    entityName:
      title,
    objectId,
    description: completed
      ? `Виконав завдання «${title}».`
      : `Відредагував завдання «${title}».`,
    metadata: {
      previous_status:
        previousTask.status,
      new_status:
        status,
      previous_due_date:
        previousTask.due_date,
      new_due_date:
        dueDate || null,
      priority,
    },
  });

  refreshTaskPages(
    objectId
  );
}

export async function updateTaskStatus(
  taskId: number,
  objectId: number,
  status: string
) {
  await requireAuthenticatedUser();

  validateTaskIds(
    taskId,
    objectId
  );

  validateStatus(
    status
  );

  const supabase =
    await createClient();

  const previousTask =
    await getTaskSnapshot(
      taskId,
      objectId
    );

  const {
    error,
  } = await supabase
    .from(
      "object_tasks"
    )
    .update({
      status,
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
      `Не вдалося змінити статус: ${error.message}`
    );
  }

  const completed =
    previousTask.status !==
      "Виконано" &&
    status === "Виконано";

  await recordActivity({
    action: completed
      ? "task.completed"
      : "task.status_changed",
    entityType:
      "task",
    entityId:
      taskId,
    entityName:
      previousTask.title,
    objectId,
    description: completed
      ? `Виконав завдання «${previousTask.title}».`
      : `Змінив статус завдання «${previousTask.title}»: ${previousTask.status} → ${status}.`,
    metadata: {
      previous_status:
        previousTask.status,
      new_status:
        status,
    },
  });

  refreshTaskPages(
    objectId
  );

  return {
    id: taskId,
    status,
  };
}

export async function updateTaskDueDate(
  taskId: number,
  objectId: number,
  dueDate: string | null
) {
  await requireAuthenticatedUser();

  validateTaskIds(
    taskId,
    objectId
  );

  const normalizedDueDate =
    String(
      dueDate ?? ""
    ).trim();

  validateDueDate(
    normalizedDueDate
  );

  const savedDueDate =
    normalizedDueDate ||
    null;

  const supabase =
    await createClient();

  const previousTask =
    await getTaskSnapshot(
      taskId,
      objectId
    );

  const {
    error,
  } = await supabase
    .from(
      "object_tasks"
    )
    .update({
      due_date:
        savedDueDate,
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
      `Не вдалося змінити дату завдання: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "task.rescheduled",
    entityType:
      "task",
    entityId:
      taskId,
    entityName:
      previousTask.title,
    objectId,
    description:
      `Переніс дату завдання «${previousTask.title}»: ${previousTask.due_date || "без дати"} → ${savedDueDate || "без дати"}.`,
    metadata: {
      previous_due_date:
        previousTask.due_date,
      new_due_date:
        savedDueDate,
    },
  });

  refreshTaskPages(
    objectId
  );

  return {
    id: taskId,
    dueDate:
      savedDueDate,
  };
}

export async function deleteObjectTask(
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

  const {
    error,
  } = await supabase
    .from(
      "object_tasks"
    )
    .delete()
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
      `Не вдалося видалити завдання: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "task.deleted",
    entityType:
      "task",
    entityId:
      task.id,
    entityName:
      task.title,
    objectId,
    description:
      `Видалив завдання «${task.title}».`,
    metadata: {
      status:
        task.status,
      due_date:
        task.due_date,
      priority:
        task.priority,
    },
  });

  refreshTaskPages(
    objectId
  );
}
