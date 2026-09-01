import { createClient } from "@/lib/supabase/server";

import {
  WORK_LOG_ATTACHMENTS_BUCKET,
} from "@/constants/workLogAttachments";

import type { Material } from "@/types/material";
import type { ObjectItem } from "@/types/object";
import type { ObjectPhoto } from "@/types/objectPhoto";
import type { ObjectTask } from "@/types/objectTask";
import type { WorkLog } from "@/types/workLog";

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
    .select("*");

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
    .select("*")
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
    .select("*")
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
    .select("*")
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
    .select()
    .single();

  if (error) {
    throw createReadableError(
      error,
      "Не вдалося створити об’єкт"
    );
  }

  return data;
}
