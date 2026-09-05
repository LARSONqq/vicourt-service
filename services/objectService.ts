import { createClient } from "@/lib/supabase/server";

import {
  WORK_LOG_ATTACHMENTS_BUCKET,
} from "@/constants/workLogAttachments";

import type {
  ManagementMaterial,
  Material,
} from "@/types/material";
import type {
  ManagementObjectItem,
  ObjectItem,
} from "@/types/object";
import type { ObjectPhoto } from "@/types/objectPhoto";
import type { ObjectTask } from "@/types/objectTask";
import type {
  ManagementWorkLog,
  WorkLog,
} from "@/types/workLog";

const OBJECT_OPERATIONAL_SELECT = `
  id,
  name,
  customer,
  phone,
  address,
  status,
  manager,
  responsible_employee_id,
  supervision_interval_days,
  last_supervision_date,
  next_supervision_date,
  created_at
`;

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

type SupabaseError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export type EmployeeWorkLog =
  WorkLog & {
    object: {
      id: number;
      name: string;
    } | null;
  };

export type ObjectQueryFilters = {
  status?: string;
  statuses?: string[];
  nextSupervisionDateTo?: string;
  limit?: number;
};

function createReadableError(
  error: SupabaseError,
  context: string
) {
  const parts = [
    context,
    error.message,
    error.details,
    error.hint
      ? `Підказка: ${error.hint}`
      : "",
    error.code
      ? `Код: ${error.code}`
      : "",
  ].filter(Boolean);

  return new Error(
    parts.join(" — ")
  );
}

export async function getObjects(
  filters: ObjectQueryFilters = {}
): Promise<
  ObjectItem[]
> {
  const supabase =
    await createClient();

  let query = supabase
    .from("objects")
    .select(
      OBJECT_OPERATIONAL_SELECT
    );

  if (filters.status) {
    query = query.eq(
      "status",
      filters.status
    );
  } else if (
    filters.statuses &&
    filters.statuses.length > 0
  ) {
    query = query.in(
      "status",
      filters.statuses
    );
  }

  if (
    filters.nextSupervisionDateTo
  ) {
    query = query
      .not(
        "next_supervision_date",
        "is",
        null
      )
      .lte(
        "next_supervision_date",
        filters.nextSupervisionDateTo
      );
  }

  query = query.order(
    "created_at",
    {
      ascending: false,
    }
  );

  if (
    filters.limit !==
      undefined &&
    Number.isInteger(
      filters.limit
    ) &&
    filters.limit > 0
  ) {
    query = query.limit(
      filters.limit
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити об’єкти"
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as ObjectItem[];
}

export async function getManagementObjects(
  filters: ObjectQueryFilters = {}
): Promise<ManagementObjectItem[]> {
  const supabase =
    await createClient();
  let query = supabase.rpc(
    "get_management_objects"
  );

  if (filters.status) {
    query = query.eq(
      "status",
      filters.status
    );
  } else if (
    filters.statuses &&
    filters.statuses.length > 0
  ) {
    query = query.in(
      "status",
      filters.statuses
    );
  }

  if (
    filters.nextSupervisionDateTo
  ) {
    query = query
      .not(
        "next_supervision_date",
        "is",
        null
      )
      .lte(
        "next_supervision_date",
        filters.nextSupervisionDateTo
      );
  }

  query = query.order(
    "created_at",
    { ascending: false }
  );

  if (
    filters.limit !== undefined &&
    Number.isInteger(filters.limit) &&
    filters.limit > 0
  ) {
    query = query.limit(
      filters.limit
    );
  }

  const { data, error } =
    await query.overrideTypes<
      ManagementObjectItem[],
      { merge: false }
    >();

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити фінансові дані об’єктів"
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getObject(
  id: number
): Promise<ObjectItem | null> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .select(
      OBJECT_OPERATIONAL_SELECT
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити об’єкт"
    );
  }

  return data as ObjectItem | null;
}

export async function getManagementObject(
  id: number
): Promise<ManagementObjectItem | null> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_objects"
      )
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<
        ManagementObjectItem | null,
        { merge: false }
      >();

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити фінансові дані об’єкта"
    );
  }

  return data || null;
}

export async function getMaterials(
  objectId: number
): Promise<Material[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("materials")
    .select(
      MATERIAL_OPERATIONAL_SELECT
    )
    .eq(
      "object_id",
      objectId
    )
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити матеріали"
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as Material[];
}

export async function getManagementMaterials(
  objectId: number
): Promise<ManagementMaterial[]> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_materials"
      )
      .eq(
        "object_id",
        objectId
      )
      .order("created_at", {
        ascending: true,
      })
      .overrideTypes<
        ManagementMaterial[],
        { merge: false }
      >();

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити вартість матеріалів"
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getWorkLogs(
  objectId: number
): Promise<WorkLog[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("work_logs")
    .select(
      WORK_LOG_OPERATIONAL_SELECT
    )
    .eq(
      "object_id",
      objectId
    )
    .order("work_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити журнал робіт"
    );
  }

  const workLogs = (
    Array.isArray(data)
      ? data
      : []
  ) as WorkLog[];

  return await Promise.all(
    workLogs.map(
      async (workLog) => {
        if (
          !workLog.attachment_path
        ) {
          return {
            ...workLog,
            attachment_url:
              null,
          };
        }

        const {
          data: signedUrlData,
          error: signedUrlError,
        } =
          await supabase.storage
            .from(
              WORK_LOG_ATTACHMENTS_BUCKET
            )
            .createSignedUrl(
              workLog.attachment_path,
              60 * 60
            );

        if (
          signedUrlError
        ) {
          throw new Error(
            `Не вдалося створити посилання для файла журналу робіт: ${signedUrlError.message}`
          );
        }

        if (
          !signedUrlData
            ?.signedUrl
        ) {
          throw new Error(
            "Не вдалося створити посилання для файла журналу робіт."
          );
        }

        return {
          ...workLog,
          attachment_url:
            signedUrlData.signedUrl,
        };
      }
    )
  );
}

export async function getManagementWorkLogs(
  objectId: number
): Promise<ManagementWorkLog[]> {
  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .rpc(
        "get_management_work_logs"
      )
      .eq(
        "object_id",
        objectId
      )
      .order("work_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .overrideTypes<
        ManagementWorkLog[],
        { merge: false }
      >();

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити вартість робіт"
    );
  }

  return await Promise.all(
    (Array.isArray(data)
      ? data
      : []
    ).map(async (workLog) => {
      if (!workLog.attachment_path) {
        return {
          ...workLog,
          attachment_url: null,
        };
      }

      const {
        data: signedUrlData,
        error: signedUrlError,
      } = await supabase.storage
        .from(
          WORK_LOG_ATTACHMENTS_BUCKET
        )
        .createSignedUrl(
          workLog.attachment_path,
          60 * 60
        );

      if (
        signedUrlError ||
        !signedUrlData?.signedUrl
      ) {
        throw new Error(
          `Не вдалося створити посилання для файла журналу робіт: ${signedUrlError?.message || "посилання відсутнє"}`
        );
      }

      return {
        ...workLog,
        attachment_url:
          signedUrlData.signedUrl,
      };
    })
  );
}

export async function getEmployeeWorkLogs(
  employeeId: number
): Promise<EmployeeWorkLog[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("work_logs")
    .select(`
      id,
      object_id,
      employee_id,
      work_date,
      description,
      workers,
      hours,
      created_at,
      object:objects (
        id,
        name
      )
    `)
    .eq(
      "employee_id",
      employeeId
    )
    .order("work_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити роботи працівника"
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as unknown as EmployeeWorkLog[];
}

export async function getObjectPhotos(
  objectId: number
): Promise<ObjectPhoto[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("object_photos")
    .select("*")
    .eq(
      "object_id",
      objectId
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити фотографії"
    );
  }

  const photos =
    Array.isArray(data)
      ? data
      : [];

  const photosWithUrls =
    await Promise.all(
      photos.map(
        async (photo) => {
          const {
            data: signedUrlData,
            error: signedUrlError,
          } =
            await supabase.storage
              .from(
                "object-photos"
              )
              .createSignedUrl(
                photo.storage_path,
                60 * 60
              );

          if (
            signedUrlError
          ) {
            throw new Error(
              `Не вдалося створити посилання для фотографії: ${signedUrlError.message}`
            );
          }

          if (
            !signedUrlData
              ?.signedUrl
          ) {
            throw new Error(
              "Не вдалося створити посилання для фотографії."
            );
          }

          return {
            ...photo,
            public_url:
              signedUrlData.signedUrl,
          };
        }
      )
    );

  return photosWithUrls as ObjectPhoto[];
}

export async function getObjectTasks(
  objectId: number
): Promise<ObjectTask[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("object_tasks")
    .select("*")
    .eq(
      "object_id",
      objectId
    )
    .order("due_date", {
      ascending: true,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося завантажити завдання"
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as ObjectTask[];
}

export async function createObject(
  object: {
    name: string;
    customer: string;
    phone: string;
    address: string;
    status: string;
    manager: string;
    cost_budget?:
      | number
      | null;
    client_price?:
      | number
      | null;
    supervision_interval_days?:
      | number
      | null;
    last_supervision_date?:
      | string
      | null;
    next_supervision_date?:
      | string
      | null;
  }
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .insert(object)
    .select(
      OBJECT_OPERATIONAL_SELECT
    )
    .single();

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося створити об’єкт"
    );
  }

  return data;
}
