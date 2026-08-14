"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { canManageObjects } from "@/lib/auth/permissions";
import { getCurrentUserProfile } from "@/services/profileService";

function validateId(
  value: number,
  message: string
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(message);
  }
}

async function requirePhotoManagementAccess() {
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
      "У тебе немає прав для керування фотографіями."
    );
  }

  return profile;
}

export async function deleteObjectPhoto(
  photoId: number,
  objectId: number
) {
  await requirePhotoManagementAccess();

  validateId(
    photoId,
    "Не вдалося визначити фотографію."
  );

  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();

  const {
    data: photo,
    error: photoError,
  } = await supabase
    .from("object_photos")
    .select(`
      id,
      storage_path
    `)
    .eq(
      "id",
      photoId
    )
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle();

  if (photoError) {
    throw new Error(
      `Не вдалося знайти фотографію: ${photoError.message}`
    );
  }

  if (!photo) {
    throw new Error(
      "Фотографію не знайдено."
    );
  }

  const {
    error: storageError,
  } =
    await supabase.storage
      .from(
        "object-photos"
      )
      .remove([
        photo.storage_path,
      ]);

  if (storageError) {
    throw new Error(
      `Не вдалося видалити файл: ${storageError.message}`
    );
  }

  const {
    error: databaseError,
  } = await supabase
    .from("object_photos")
    .delete()
    .eq(
      "id",
      photoId
    )
    .eq(
      "object_id",
      objectId
    );

  if (databaseError) {
    throw new Error(
      `Файл видалено, але не вдалося видалити запис фотографії: ${databaseError.message}`
    );
  }

  revalidatePath(
    `/objects/${objectId}`
  );

  revalidatePath(
    "/objects"
  );
}