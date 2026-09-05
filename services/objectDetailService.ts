import "server-only";

import {
  WORK_LOG_ATTACHMENTS_BUCKET,
} from "@/constants/workLogAttachments";
import {
  createClient,
} from "@/lib/supabase/server";

import type {
  ManagementMaterial,
  Material,
} from "@/types/material";
import type {
  ObjectPhoto,
} from "@/types/objectPhoto";
import type {
  ObjectTask,
} from "@/types/objectTask";
import type {
  ManagementWorkLog,
  WorkLog,
} from "@/types/workLog";

export const OBJECT_TAB_PAGE_SIZE = 20;
export const OBJECT_PHOTO_PAGE_SIZE = 12;

const MATERIAL_OPERATIONAL_SELECT = `
  id,
  object_id,
  warehouse_item_id,
  name,
  quantity,
  unit,
  created_at
`;

const WORK_LOG_OPERATIONAL_SELECT = `
  id,
  object_id,
  employee_id,
  work_date,
  description,
  workers,
  hours,
  attachment_path,
  attachment_name,
  attachment_type,
  attachment_size,
  created_at
`;

const OBJECT_TASK_SELECT = `
  id,
  object_id,
  equipment_id,
  title,
  description,
  due_date,
  assignee,
  assigned_employee_id,
  priority,
  status,
  task_source,
  task_template_id,
  recurrence_sequence,
  created_at
`;

const OBJECT_PHOTO_SELECT = `
  id,
  object_id,
  storage_path,
  caption,
  created_at
`;

export type ObjectListPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type ObjectOverviewPreview = {
  activeTasks: ObjectTask[];
  activeTasksCount: number;
  recentWorkLogs: WorkLog[];
  materialsCount: number;
  documentsCount: number;
  photosCount: number;
  totalHours: number;
};

export type ObjectCostSummary = {
  materialsCost: number;
  laborCost: number;
};

type PageWindow = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

function normalizePositiveId(
  value: number,
  message: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(message);
  }

  return value;
}

function getPageWindow(
  requestedPage: number,
  total: number,
  pageSize: number
): PageWindow {
  const normalizedPage =
    Number.isInteger(requestedPage) &&
    requestedPage > 0
      ? requestedPage
      : 1;
  const lastPage = Math.max(
    1,
    Math.ceil(total / pageSize)
  );
  const page = Math.min(
    normalizedPage,
    lastPage
  );
  const from =
    (page - 1) * pageSize;

  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
    hasPreviousPage: page > 1,
    hasNextPage:
      page * pageSize < total,
  };
}

function sumFiniteValues(
  values: unknown[]
) {
  return values.reduce<number>(
    (sum, value) => {
      const numberValue =
        Number(value);

      return (
        sum +
        (Number.isFinite(
          numberValue
        )
          ? numberValue
          : 0)
      );
    },
    0
  );
}

async function addWorkLogSignedUrls<
  T extends WorkLog,
>(
  workLogs: T[]
): Promise<T[]> {
  const attachmentPaths =
    Array.from(
      new Set(
        workLogs
          .map(
            (workLog) =>
              workLog.attachment_path
          )
          .filter(
            (
              path
            ): path is string =>
              Boolean(path)
          )
      )
    );

  if (
    attachmentPaths.length === 0
  ) {
    return workLogs.map(
      (workLog) => ({
        ...workLog,
        attachment_url: null,
      })
    );
  }

  const supabase =
    await createClient();
  const { data, error } =
    await supabase.storage
      .from(
        WORK_LOG_ATTACHMENTS_BUCKET
      )
      .createSignedUrls(
        attachmentPaths,
        60 * 60
      );

  if (error || !data) {
    return workLogs.map(
      (workLog) => ({
        ...workLog,
        attachment_url: null,
      })
    );
  }

  const signedUrlsByPath =
    new Map(
      data.map((item) => [
        item.path,
        item.signedUrl,
      ])
    );

  return workLogs.map(
    (workLog) => ({
      ...workLog,
      attachment_url:
        workLog.attachment_path
          ? signedUrlsByPath.get(
              workLog.attachment_path
            ) || null
          : null,
    })
  );
}

export async function getObjectOverviewPreview(
  objectId: number
): Promise<ObjectOverviewPreview> {
  normalizePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const [
    tasksResult,
    recentWorkLogsResult,
    hoursResult,
    materialsCountResult,
    documentsCountResult,
    photosCountResult,
  ] = await Promise.all([
    supabase
      .from("object_tasks")
      .select(OBJECT_TASK_SELECT, {
        count: "exact",
      })
      .eq("object_id", objectId)
      .neq("status", "Виконано")
      .order("due_date", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      })
      .limit(5),
    supabase
      .from("work_logs")
      .select(
        WORK_LOG_OPERATIONAL_SELECT
      )
      .eq("object_id", objectId)
      .order("work_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .limit(3),
    supabase
      .from("work_logs")
      .select("hours")
      .eq("object_id", objectId),
    supabase
      .from("materials")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId),
    supabase
      .from("object_documents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId)
      .eq("is_ready", true),
    supabase
      .from("object_photos")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId),
  ]);

  const firstError = [
    tasksResult.error,
    recentWorkLogsResult.error,
    hoursResult.error,
    materialsCountResult.error,
    documentsCountResult.error,
    photosCountResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(
      `Не вдалося завантажити огляд об’єкта: ${firstError.message}`
    );
  }

  return {
    activeTasks: Array.isArray(
      tasksResult.data
    )
      ? (tasksResult.data as ObjectTask[])
      : [],
    activeTasksCount:
      tasksResult.count || 0,
    recentWorkLogs: Array.isArray(
      recentWorkLogsResult.data
    )
      ? (recentWorkLogsResult.data as WorkLog[])
      : [],
    totalHours: sumFiniteValues(
      (Array.isArray(
        hoursResult.data
      )
        ? hoursResult.data
        : []
      ).map((row) => row.hours)
    ),
    materialsCount:
      materialsCountResult.count ||
      0,
    documentsCount:
      documentsCountResult.count ||
      0,
    photosCount:
      photosCountResult.count || 0,
  };
}

export async function getObjectMaterialsPage(
  objectId: number,
  requestedPage: number
): Promise<ObjectListPage<Material>> {
  normalizePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const { count, error: countError } =
    await supabase
      .from("materials")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId);

  if (countError) {
    throw new Error(
      `Не вдалося завантажити матеріали: ${countError.message}`
    );
  }

  const total = count || 0;
  const window = getPageWindow(
    requestedPage,
    total,
    OBJECT_TAB_PAGE_SIZE
  );
  const { data, error } =
    await supabase
      .from("materials")
      .select(
        MATERIAL_OPERATIONAL_SELECT
      )
      .eq("object_id", objectId)
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(window.from, window.to);

  if (error) {
    throw new Error(
      `Не вдалося завантажити матеріали: ${error.message}`
    );
  }

  return {
    items: Array.isArray(data)
      ? (data as Material[])
      : [],
    total,
    ...window,
  };
}

export async function getManagementObjectMaterialsPage(
  objectId: number,
  requestedPage: number
): Promise<
  ObjectListPage<ManagementMaterial>
> {
  normalizePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const { count, error: countError } =
    await supabase
      .from("materials")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId);

  if (countError) {
    throw new Error(
      `Не вдалося завантажити матеріали: ${countError.message}`
    );
  }

  const total = count || 0;
  const window = getPageWindow(
    requestedPage,
    total,
    OBJECT_TAB_PAGE_SIZE
  );
  const { data, error } =
    await supabase
      .rpc(
        "get_management_materials"
      )
      .eq("object_id", objectId)
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(window.from, window.to)
      .overrideTypes<
        ManagementMaterial[],
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити вартість матеріалів: ${error.message}`
    );
  }

  return {
    items: Array.isArray(data)
      ? data
      : [],
    total,
    ...window,
  };
}

export async function getObjectWorkLogsPage(
  objectId: number,
  requestedPage: number
): Promise<ObjectListPage<WorkLog>> {
  normalizePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const { count, error: countError } =
    await supabase
      .from("work_logs")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId);

  if (countError) {
    throw new Error(
      `Не вдалося завантажити журнал робіт: ${countError.message}`
    );
  }

  const total = count || 0;
  const window = getPageWindow(
    requestedPage,
    total,
    OBJECT_TAB_PAGE_SIZE
  );
  const { data, error } =
    await supabase
      .from("work_logs")
      .select(
        WORK_LOG_OPERATIONAL_SELECT
      )
      .eq("object_id", objectId)
      .order("work_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(window.from, window.to);

  if (error) {
    throw new Error(
      `Не вдалося завантажити журнал робіт: ${error.message}`
    );
  }

  const workLogs =
    Array.isArray(data)
      ? (data as WorkLog[])
      : [];

  return {
    items:
      await addWorkLogSignedUrls(
        workLogs
      ),
    total,
    ...window,
  };
}

export async function getManagementObjectWorkLogsPage(
  objectId: number,
  requestedPage: number
): Promise<
  ObjectListPage<ManagementWorkLog>
> {
  normalizePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const { count, error: countError } =
    await supabase
      .from("work_logs")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId);

  if (countError) {
    throw new Error(
      `Не вдалося завантажити журнал робіт: ${countError.message}`
    );
  }

  const total = count || 0;
  const window = getPageWindow(
    requestedPage,
    total,
    OBJECT_TAB_PAGE_SIZE
  );
  const { data, error } =
    await supabase
      .rpc(
        "get_management_work_logs"
      )
      .eq("object_id", objectId)
      .order("work_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(window.from, window.to)
      .overrideTypes<
        ManagementWorkLog[],
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити вартість робіт: ${error.message}`
    );
  }

  const workLogs =
    Array.isArray(data)
      ? data
      : [];

  return {
    items:
      await addWorkLogSignedUrls(
        workLogs
      ),
    total,
    ...window,
  };
}

export async function getObjectPhotosPage(
  objectId: number,
  requestedPage: number
): Promise<ObjectListPage<ObjectPhoto>> {
  normalizePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const { count, error: countError } =
    await supabase
      .from("object_photos")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("object_id", objectId);

  if (countError) {
    throw new Error(
      `Не вдалося завантажити фотографії: ${countError.message}`
    );
  }

  const total = count || 0;
  const window = getPageWindow(
    requestedPage,
    total,
    OBJECT_PHOTO_PAGE_SIZE
  );
  const { data, error } =
    await supabase
      .from("object_photos")
      .select(OBJECT_PHOTO_SELECT)
      .eq("object_id", objectId)
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(window.from, window.to);

  if (error) {
    throw new Error(
      `Не вдалося завантажити фотографії: ${error.message}`
    );
  }

  const photos = Array.isArray(data)
    ? data
    : [];
  const { data: signedUrlData, error: signedUrlError } =
    photos.length > 0
      ? await supabase.storage
          .from("object-photos")
          .createSignedUrls(
            photos.map(
              (photo) =>
                photo.storage_path
            ),
            60 * 60
          )
      : {
          data: [],
          error: null,
        };

  if (signedUrlError) {
    throw new Error(
      `Не вдалося створити посилання для фотографій: ${signedUrlError.message}`
    );
  }

  const signedUrlsByPath =
    new Map(
      (signedUrlData || []).map(
        (item) => [
          item.path,
          item.signedUrl,
        ]
      )
    );
  const photosWithUrls =
    photos.map((photo) => {
      const signedUrl =
        signedUrlsByPath.get(
          photo.storage_path
        );

      if (!signedUrl) {
        throw new Error(
          "Не вдалося створити посилання для фотографії."
        );
      }

      return {
        ...photo,
        public_url: signedUrl,
      };
    });

  return {
    items:
      photosWithUrls as ObjectPhoto[],
    total,
    ...window,
  };
}

export async function getManagementObjectCostSummary(
  objectId: number
): Promise<ObjectCostSummary> {
  normalizePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const [materialsResult, workLogsResult] =
    await Promise.all([
      supabase
        .rpc(
          "get_management_materials"
        )
        .select("quantity, price")
        .eq("object_id", objectId),
      supabase
        .rpc(
          "get_management_work_logs"
        )
        .select("hours, hourly_rate")
        .eq("object_id", objectId),
    ]);

  if (materialsResult.error) {
    throw new Error(
      `Не вдалося розрахувати вартість матеріалів: ${materialsResult.error.message}`
    );
  }

  if (workLogsResult.error) {
    throw new Error(
      `Не вдалося розрахувати вартість робіт: ${workLogsResult.error.message}`
    );
  }

  const materialsCost =
    (Array.isArray(
      materialsResult.data
    )
      ? materialsResult.data
      : []
    ).reduce((sum, material) => {
      const quantity = Number(
        material.quantity
      );
      const price = Number(
        material.price
      );

      return (
        sum +
        (Number.isFinite(quantity) &&
        Number.isFinite(price)
          ? quantity * price
          : 0)
      );
    }, 0);
  const laborCost =
    (Array.isArray(
      workLogsResult.data
    )
      ? workLogsResult.data
      : []
    ).reduce((sum, workLog) => {
      const hours = Number(
        workLog.hours
      );
      const hourlyRate = Number(
        workLog.hourly_rate
      );

      return (
        sum +
        (Number.isFinite(hours) &&
        Number.isFinite(hourlyRate)
          ? hours * hourlyRate
          : 0)
      );
    }, 0);

  return {
    materialsCost,
    laborCost,
  };
}
