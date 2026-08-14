import { createClient } from "@/lib/supabase/server";

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

export async function getObjects(): Promise<
  ObjectItem[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

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

  return (
    Array.isArray(data)
      ? data
      : []
  ) as WorkLog[];
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