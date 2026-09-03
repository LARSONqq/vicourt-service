"use client";

import {
  getObjectDocumentFileValidationError,
  OBJECT_DOCUMENTS_BUCKET,
} from "@/constants/objectDocuments";
import {
  createClient,
} from "@/lib/supabase/client";

import type {
  PreparedObjectDocumentUpload,
} from "@/types/objectDocument";

export async function uploadPreparedObjectDocument(
  file: File,
  prepared: PreparedObjectDocumentUpload
) {
  const validationError =
    getObjectDocumentFileValidationError(
      file
    );

  if (validationError) {
    throw new Error(
      validationError
    );
  }

  if (
    file.name.normalize("NFKC").trim() !==
      prepared.originalFileName ||
    file.size !==
      prepared.fileSize ||
    file.type
      .split(";", 1)[0]
      .trim()
      .toLocaleLowerCase(
        "en-US"
      ) !== prepared.mimeType
  ) {
    throw new Error(
      "Вибраний файл змінився. Обери його ще раз."
    );
  }

  const supabase =
    createClient();
  const {
    error,
  } = await supabase.storage
    .from(
      OBJECT_DOCUMENTS_BUCKET
    )
    .uploadToSignedUrl(
      prepared.storagePath,
      prepared.uploadToken,
      file,
      {
        cacheControl: "3600",
        contentType:
          prepared.mimeType,
        upsert: false,
      }
    );

  if (error) {
    throw new Error(
      "Не вдалося завантажити документ у захищене сховище."
    );
  }
}
