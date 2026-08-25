import { createClient } from "@/lib/supabase/client";

import {
  getWorkLogAttachmentContentType,
  getWorkLogAttachmentExtension,
  getWorkLogAttachmentValidationError,
  WORK_LOG_ATTACHMENTS_BUCKET,
  type WorkLogAttachmentMetadata,
} from "@/constants/workLogAttachments";

function createUniqueId() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export async function uploadWorkLogAttachment(
  file: File,
  objectId: number
): Promise<WorkLogAttachmentMetadata> {
  const validationError =
    getWorkLogAttachmentValidationError(
      file
    );

  if (validationError) {
    throw new Error(
      validationError
    );
  }

  const extension =
    getWorkLogAttachmentExtension(
      file.name
    );

  const contentType =
    getWorkLogAttachmentContentType(
      file.name
    );

  if (
    !extension ||
    !contentType
  ) {
    throw new Error(
      "Не вдалося визначити тип файла."
    );
  }

  const attachmentPath =
    `${objectId}/${createUniqueId()}.${extension}`;

  const supabase =
    createClient();

  const {
    error,
  } = await supabase.storage
    .from(
      WORK_LOG_ATTACHMENTS_BUCKET
    )
    .upload(
      attachmentPath,
      file,
      {
        cacheControl: "3600",
        contentType,
        upsert: false,
      }
    );

  if (error) {
    throw new Error(
      `Не вдалося завантажити файл: ${error.message}`
    );
  }

  return {
    attachmentPath,
    attachmentName:
      file.name,
    attachmentType:
      contentType,
    attachmentSize:
      file.size,
  };
}

export async function removeWorkLogAttachment(
  attachmentPath: string
) {
  const supabase =
    createClient();

  const {
    error,
  } = await supabase.storage
    .from(
      WORK_LOG_ATTACHMENTS_BUCKET
    )
    .remove([
      attachmentPath,
    ]);

  if (error) {
    throw new Error(
      `Не вдалося видалити файл: ${error.message}`
    );
  }
}

export function appendWorkLogAttachmentMetadata(
  formData: FormData,
  metadata: WorkLogAttachmentMetadata
) {
  formData.set(
    "attachment_path",
    metadata.attachmentPath
  );

  formData.set(
    "attachment_name",
    metadata.attachmentName
  );

  formData.set(
    "attachment_type",
    metadata.attachmentType
  );

  formData.set(
    "attachment_size",
    String(
      metadata.attachmentSize
    )
  );
}
