import "server-only";

import {
  MANUAL_TASK_SOURCE,
  SUPERVISION_TASK_SOURCE,
} from "@/constants/taskSource";
import {
  canManageObjects,
} from "@/lib/auth/permissions";
import {
  addDaysToDateValue,
  formatDateValue,
  getKyivDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";
import {
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import {
  createClient,
} from "@/lib/supabase/server";
import {
  recordActivity,
} from "@/services/activityLogService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

const COMPLETED_TASK_STATUS =
  "Виконано";
const PLANNED_TASK_STATUS =
  "Заплановано";
const DEFAULT_TASK_PRIORITY =
  "Середній";
const SUPERVISION_TASK_DESCRIPTION =
  "Автоматичне завдання для періодичного нагляду за об’єктом.";

type SupervisionObjectSnapshot = {
  id: number;
  name: string;
  status: string;
  manager: string | null;
  responsible_employee_id:
    | number
    | null;
  supervision_interval_days:
    | number
    | null;
  last_supervision_date:
    | string
    | null;
  next_supervision_date:
    | string
    | null;
};

type SupervisionTaskSnapshot = {
  id: number;
  object_id: number;
  title: string;
  status: string;
  due_date: string | null;
  task_source:
    | typeof MANUAL_TASK_SOURCE
    | typeof SUPERVISION_TASK_SOURCE;
};

function validateId(
  value: number,
  label: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `Не вдалося визначити ${label}.`
    );
  }
}

function formatActivityDate(
  value: string | null
) {
  return value
    ? formatDateValue(value) ||
        value
    : "не заплановано";
}

function getSupervisionTaskTitle(
  objectName: string
) {
  return `Періодичний огляд — ${objectName}`;
}

export async function requireSupervisionTaskManagement() {
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
      "У тебе немає прав для керування періодичним наглядом."
    );
  }

  return profile;
}

async function getObjectSnapshot(
  objectId: number
) {
  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .select(`
      id,
      name,
      status,
      manager,
      responsible_employee_id,
      supervision_interval_days,
      last_supervision_date,
      next_supervision_date
    `)
    .eq(
      "id",
      objectId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося завантажити об’єкт для синхронізації нагляду: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Об’єкт не знайдено."
    );
  }

  return data as SupervisionObjectSnapshot;
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
      object_id,
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
      `Не вдалося завантажити завдання нагляду: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Завдання не знайдено."
    );
  }

  return data as SupervisionTaskSnapshot;
}

export async function syncSupervisionTask(
  objectId: number
) {
  validateId(
    objectId,
    "об’єкт"
  );

  const object =
    await getObjectSnapshot(
      objectId
    );
  const supabase =
    await createClient();
  const shouldHaveActiveTask =
    object.status ===
      PERIODIC_SUPERVISION_STATUS &&
    Boolean(
      object.next_supervision_date
    );

  if (!shouldHaveActiveTask) {
    const {
      error,
    } = await supabase
      .from("object_tasks")
      .delete()
      .eq(
        "object_id",
        objectId
      )
      .eq(
        "task_source",
        SUPERVISION_TASK_SOURCE
      )
      .neq(
        "status",
        COMPLETED_TASK_STATUS
      );

    if (error) {
      throw new Error(
        `Не вдалося прибрати неактуальне завдання нагляду: ${error.message}`
      );
    }

    return null;
  }

  const taskValues = {
    title:
      getSupervisionTaskTitle(
        object.name
      ),
    description:
      SUPERVISION_TASK_DESCRIPTION,
    due_date:
      object.next_supervision_date,
    assigned_employee_id:
      object.responsible_employee_id,
    assignee:
      object.manager,
  };

  async function loadActiveTask() {
    const {
      data,
      error,
    } = await supabase
      .from("object_tasks")
      .select(`
        id,
        object_id,
        title,
        status,
        due_date,
        task_source
      `)
      .eq(
        "object_id",
        objectId
      )
      .eq(
        "task_source",
        SUPERVISION_TASK_SOURCE
      )
      .neq(
        "status",
        COMPLETED_TASK_STATUS
      )
      .order(
        "id",
        {
          ascending: true,
        }
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Не вдалося знайти активне завдання нагляду: ${error.message}`
      );
    }

    return data as SupervisionTaskSnapshot | null;
  }

  async function updateActiveTask(
    taskId: number
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("object_tasks")
      .update(taskValues)
      .eq(
        "id",
        taskId
      )
      .eq(
        "object_id",
        objectId
      )
      .eq(
        "task_source",
        SUPERVISION_TASK_SOURCE
      )
      .neq(
        "status",
        COMPLETED_TASK_STATUS
      )
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(
        `Не вдалося синхронізувати завдання нагляду: ${error.message}`
      );
    }

    return data?.id
      ? Number(data.id)
      : null;
  }

  const activeTask =
    await loadActiveTask();

  if (activeTask) {
    return await updateActiveTask(
      activeTask.id
    );
  }

  const {
    data: createdTask,
    error: createError,
  } = await supabase
    .from("object_tasks")
    .insert({
      object_id:
        objectId,
      ...taskValues,
      priority:
        DEFAULT_TASK_PRIORITY,
      status:
        PLANNED_TASK_STATUS,
      task_source:
        SUPERVISION_TASK_SOURCE,
    })
    .select("id")
    .single();

  if (!createError) {
    return Number(
      createdTask.id
    );
  }

  if (createError.code === "23505") {
    const concurrentTask =
      await loadActiveTask();

    if (concurrentTask) {
      return await updateActiveTask(
        concurrentTask.id
      );
    }
  }

  throw new Error(
    `Не вдалося створити завдання нагляду: ${createError.message}`
  );
}

export async function syncSupervisionTaskSafely(
  objectId: number
) {
  try {
    return await syncSupervisionTask(
      objectId
    );
  } catch (error) {
    console.error(
      "[SupervisionTask] Не вдалося синхронізувати автоматичне завдання.",
      {
        objectId,
        message:
          error instanceof Error
            ? error.message
            : "Невідома помилка",
      }
    );

    return null;
  }
}

export async function completeSupervisionCycle({
  objectId,
  taskId,
}: {
  objectId: number;
  taskId?: number;
}) {
  await requireSupervisionTaskManagement();
  validateId(
    objectId,
    "об’єкт"
  );

  if (taskId !== undefined) {
    validateId(
      taskId,
      "завдання"
    );
  }

  const object =
    await getObjectSnapshot(
      objectId
    );

  if (
    object.status !==
    PERIODIC_SUPERVISION_STATUS
  ) {
    throw new Error(
      "Періодичний огляд доступний лише для об’єктів під періодичним наглядом."
    );
  }

  const intervalDays =
    Number(
      object.supervision_interval_days
    );

  if (
    !Number.isInteger(
      intervalDays
    ) ||
    intervalDays <= 0
  ) {
    throw new Error(
      "Спочатку вкажіть періодичність нагляду."
    );
  }

  const today =
    getKyivDateValue();
  let currentTask:
    | SupervisionTaskSnapshot
    | null = null;

  if (taskId !== undefined) {
    currentTask =
      await getTaskSnapshot(
        taskId,
        objectId
      );

    if (
      currentTask.task_source !==
      SUPERVISION_TASK_SOURCE
    ) {
      throw new Error(
        "Завдання не належить до періодичного нагляду."
      );
    }

    if (
      currentTask.status ===
      COMPLETED_TASK_STATUS
    ) {
      if (
        object.last_supervision_date ===
        today
      ) {
        const nextTaskId =
          await syncSupervisionTask(
            objectId
          );

        return {
          lastSupervisionDate:
            object.last_supervision_date,
          nextSupervisionDate:
            object.next_supervision_date,
          completedTaskId:
            currentTask.id,
          nextTaskId,
          alreadyCompleted:
            true,
        };
      }

      throw new Error(
        "Завершений періодичний огляд не можна виконати повторно."
      );
    }
  }

  if (
    object.last_supervision_date ===
    today
  ) {
    throw new Error(
      "Періодичний огляд уже виконано сьогодні."
    );
  }

  if (!currentTask) {
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
        status,
        due_date,
        task_source
      `)
      .eq(
        "object_id",
        objectId
      )
      .eq(
        "task_source",
        SUPERVISION_TASK_SOURCE
      )
      .neq(
        "status",
        COMPLETED_TASK_STATUS
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Не вдалося знайти поточне завдання нагляду: ${error.message}`
      );
    }

    currentTask =
      data as SupervisionTaskSnapshot | null;
  }

  const nextDate =
    addDaysToDateValue(
      today,
      intervalDays
    );
  const supabase =
    await createClient();
  const {
    data: updatedObject,
    error: updateObjectError,
  } = await supabase
    .from("objects")
    .update({
      last_supervision_date:
        today,
      next_supervision_date:
        nextDate,
    })
    .eq(
      "id",
      objectId
    )
    .eq(
      "status",
      PERIODIC_SUPERVISION_STATUS
    )
    .or(
      `last_supervision_date.is.null,last_supervision_date.neq.${today}`
    )
    .select("id")
    .maybeSingle();

  if (updateObjectError) {
    throw new Error(
      `Не вдалося зберегти огляд: ${updateObjectError.message}`
    );
  }

  if (!updatedObject) {
    throw new Error(
      "Періодичний огляд уже виконано сьогодні."
    );
  }

  if (
    currentTask &&
    currentTask.status !==
      COMPLETED_TASK_STATUS
  ) {
    const {
      error: completeTaskError,
    } = await supabase
      .from("object_tasks")
      .update({
        status:
          COMPLETED_TASK_STATUS,
      })
      .eq(
        "id",
        currentTask.id
      )
      .eq(
        "object_id",
        objectId
      )
      .eq(
        "task_source",
        SUPERVISION_TASK_SOURCE
      );

    if (completeTaskError) {
      throw new Error(
        `Не вдалося завершити завдання нагляду: ${completeTaskError.message}`
      );
    }
  }

  const nextTaskId =
    await syncSupervisionTask(
      objectId
    );

  await recordActivity({
    action:
      "object.supervision_completed",
    entityType:
      "object",
    entityId:
      object.id,
    entityName:
      object.name,
    objectId:
      object.id,
    objectName:
      object.name,
    description:
      `Виконав періодичний огляд об’єкта «${object.name}». Наступний огляд: ${formatActivityDate(
        nextDate
      )}.`,
    metadata: {
      previous_last_supervision_date:
        object.last_supervision_date,
      new_last_supervision_date:
        today,
      previous_next_supervision_date:
        object.next_supervision_date,
      new_next_supervision_date:
        nextDate,
      interval_days:
        intervalDays,
      completed_auto_task_id:
        currentTask?.id || null,
      next_auto_task_id:
        nextTaskId,
    },
  });

  return {
    lastSupervisionDate:
      today,
    nextSupervisionDate:
      nextDate,
    completedTaskId:
      currentTask?.id || null,
    nextTaskId,
    alreadyCompleted:
      false,
  };
}

export async function rescheduleSupervisionTask({
  taskId,
  objectId,
  dueDate,
}: {
  taskId: number;
  objectId: number;
  dueDate: string;
}) {
  await requireSupervisionTaskManagement();
  validateId(
    taskId,
    "завдання"
  );
  validateId(
    objectId,
    "об’єкт"
  );

  if (!isValidDateValue(dueDate)) {
    throw new Error(
      "Вказано неправильну дату огляду."
    );
  }

  const task =
    await getTaskSnapshot(
      taskId,
      objectId
    );

  if (
    task.task_source !==
    SUPERVISION_TASK_SOURCE
  ) {
    throw new Error(
      "Завдання не належить до періодичного нагляду."
    );
  }

  if (
    task.status ===
    COMPLETED_TASK_STATUS
  ) {
    throw new Error(
      "Завершений огляд не можна переносити."
    );
  }

  const object =
    await getObjectSnapshot(
      objectId
    );

  if (
    object.status !==
    PERIODIC_SUPERVISION_STATUS
  ) {
    throw new Error(
      "Об’єкт більше не перебуває під періодичним наглядом."
    );
  }

  const supabase =
    await createClient();
  const {
    error,
  } = await supabase
    .from("objects")
    .update({
      next_supervision_date:
        dueDate,
    })
    .eq(
      "id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося перенести огляд: ${error.message}`
    );
  }

  const syncedTaskId =
    await syncSupervisionTask(
      objectId
    );

  await recordActivity({
    action:
      "object.supervision_rescheduled",
    entityType:
      "object",
    entityId:
      object.id,
    entityName:
      object.name,
    objectId:
      object.id,
    objectName:
      object.name,
    description:
      `Переніс дату періодичного огляду об’єкта «${object.name}»: ${formatActivityDate(
        object.next_supervision_date
      )} → ${formatActivityDate(
        dueDate
      )}.`,
    metadata: {
      previous_next_supervision_date:
        object.next_supervision_date,
      new_next_supervision_date:
        dueDate,
      auto_task_id:
        syncedTaskId || task.id,
    },
  });

  return {
    id:
      syncedTaskId || task.id,
    dueDate,
  };
}
