"use server";

import {
  randomUUID,
} from "node:crypto";

import {
  revalidatePath,
} from "next/cache";

import {
  getObjectDocumentExtension,
  getObjectDocumentFileValidationError,
  normalizeObjectDocumentMetadata,
  normalizeObjectDocumentMimeType,
  OBJECT_DOCUMENTS_BUCKET,
} from "@/constants/objectDocuments";
import {
  canManageObjects,
} from "@/lib/auth/permissions";
import {
  createClient,
} from "@/lib/supabase/server";
import {
  createServiceRoleClient,
} from "@/lib/supabase/admin";
import {
  recordActivity,
} from "@/services/activityLogService";
import {
  getObjectDocumentForAction,
  getObjectDocumentObjectSnapshot,
} from "@/services/objectDocumentService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  ObjectDocument,
  PrepareObjectDocumentUploadInput,
  PreparedObjectDocumentUpload,
} from "@/types/objectDocument";

const SIGNED_DOCUMENT_URL_TTL_SECONDS =
  10 * 60;

function validatePositiveId(
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

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  );
}

async function requireDocumentUser() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Потрібно увійти в систему."
    );
  }

  return profile;
}

async function requireDocumentManagementAccess() {
  const profile =
    await requireDocumentUser();

  if (
    !canManageObjects(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування документами об’єкта."
    );
  }

  return profile;
}

function refreshObjectDocuments(
  objectId: number
) {
  revalidatePath(
    `/objects/${objectId}`
  );
}

async function removePendingDocument(
  document: Pick<
    ObjectDocument,
    "id" | "storage_path"
  >
) {
  const adminClient =
    createServiceRoleClient();
  const {
    error: storageError,
  } = await adminClient.storage
    .from(
      OBJECT_DOCUMENTS_BUCKET
    )
    .remove([
      document.storage_path,
    ]);

  if (storageError) {
    throw new Error(
      "Не вдалося очистити незавершене завантаження."
    );
  }

  const {
    error: databaseError,
  } = await adminClient
    .from("object_documents")
    .delete()
    .eq("id", document.id)
    .eq("is_ready", false);

  if (databaseError) {
    throw new Error(
      "Файл очищено, але не вдалося прибрати технічний запис документа."
    );
  }
}

export async function prepareObjectDocumentUpload(
  input: PrepareObjectDocumentUploadInput
): Promise<PreparedObjectDocumentUpload> {
  const profile =
    await requireDocumentManagementAccess();

  validatePositiveId(
    input.objectId,
    "Не вдалося визначити об’єкт."
  );

  const object =
    await getObjectDocumentObjectSnapshot(
      input.objectId
    );
  const metadata =
    normalizeObjectDocumentMetadata(
      {
        title: input.title,
        category:
          input.category,
        accessLevel:
          input.accessLevel,
        note: input.note,
      }
    );
  const originalFileName =
    input.fileName
      .normalize("NFKC")
      .trim();
  const mimeType =
    normalizeObjectDocumentMimeType(
      input.mimeType
    );
  const fileValidationError =
    getObjectDocumentFileValidationError(
      {
        name: originalFileName,
        size: input.fileSize,
        type: mimeType,
      }
    );

  if (fileValidationError) {
    throw new Error(
      fileValidationError
    );
  }

  const extension =
    getObjectDocumentExtension(
      originalFileName
    );

  if (!extension) {
    throw new Error(
      "Не вдалося визначити тип файла."
    );
  }

  const storagePath =
    `${object.id}/${randomUUID()}.${extension}`;
  const supabase =
    await createClient();
  const {
    data: document,
    error: insertError,
  } = await supabase
    .from("object_documents")
    .insert({
      object_id: object.id,
      title: metadata.title,
      category:
        metadata.category,
      access_level:
        metadata.accessLevel,
      original_file_name:
        originalFileName,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size:
        input.fileSize,
      note: metadata.note,
      created_by: profile.id,
      is_ready: false,
    })
    .select(`
      id,
      object_id,
      storage_path,
      original_file_name,
      mime_type,
      file_size
    `)
    .single<{
      id: number;
      object_id: number;
      storage_path: string;
      original_file_name: string;
      mime_type: string;
      file_size: number;
    }>();

  if (
    insertError ||
    !document
  ) {
    throw new Error(
      "Не вдалося підготувати завантаження документа."
    );
  }

  const {
    data: uploadData,
    error: uploadUrlError,
  } = await supabase.storage
    .from(
      OBJECT_DOCUMENTS_BUCKET
    )
    .createSignedUploadUrl(
      document.storage_path,
      {
        upsert: false,
      }
    );

  if (
    uploadUrlError ||
    !uploadData
  ) {
    await supabase
      .from("object_documents")
      .delete()
      .eq("id", document.id)
      .eq("is_ready", false);

    throw new Error(
      "Не вдалося підготувати захищене сховище для документа."
    );
  }

  return {
    documentId:
      document.id,
    objectId:
      document.object_id,
    storagePath:
      document.storage_path,
    uploadToken:
      uploadData.token,
    originalFileName:
      document.original_file_name,
    mimeType:
      document.mime_type,
    fileSize:
      Number(
        document.file_size
      ),
  };
}

export async function cancelObjectDocumentUpload(
  documentId: number,
  objectId: number
) {
  await requireDocumentManagementAccess();
  const document =
    await getObjectDocumentForAction(
      documentId,
      objectId
    );

  if (
    !document ||
    document.is_ready
  ) {
    return;
  }

  await removePendingDocument(
    document
  );
  refreshObjectDocuments(
    objectId
  );
}

export async function finalizeObjectDocumentUpload(
  documentId: number,
  objectId: number
) {
  await requireDocumentManagementAccess();
  const document =
    await getObjectDocumentForAction(
      documentId,
      objectId
    );

  if (!document) {
    throw new Error(
      "Документ не знайдено."
    );
  }

  if (document.is_ready) {
    return;
  }

  await getObjectDocumentObjectSnapshot(
    objectId
  );

  const originalExtension =
    getObjectDocumentExtension(
      document.original_file_name
    );
  const storageExtension =
    getObjectDocumentExtension(
      document.storage_path
    );
  const hasCanonicalStoragePath =
    document.storage_path.startsWith(
      `${objectId}/`
    ) &&
    originalExtension !== null &&
    originalExtension ===
      storageExtension;
  const adminClient =
    createServiceRoleClient();
  const {
    data: storageInfo,
    error: storageInfoError,
  } = await adminClient.storage
    .from(
      OBJECT_DOCUMENTS_BUCKET
    )
    .info(
      document.storage_path
    );
  const storedMimeType =
    normalizeObjectDocumentMimeType(
      storageInfo?.contentType ||
        ""
    );
  const storedFileValidationError =
    storageInfo
      ? getObjectDocumentFileValidationError(
          {
            name:
              document.original_file_name,
            size: Number(
              storageInfo.size
            ),
            type:
              storedMimeType,
          }
        )
      : "Файл не знайдено.";

  if (
    !hasCanonicalStoragePath ||
    storageInfoError ||
    !storageInfo ||
    storedFileValidationError ||
    Number(storageInfo.size) !==
      Number(
        document.file_size
      ) ||
    storedMimeType !==
      document.mime_type
  ) {
    await removePendingDocument(
      document
    );

    throw new Error(
      "Завантажений файл не пройшов серверну перевірку розміру або типу."
    );
  }

  const {
    error: updateError,
  } = await adminClient
    .from("object_documents")
    .update({
      is_ready: true,
    })
    .eq("id", document.id)
    .eq("object_id", objectId)
    .eq("is_ready", false);

  if (updateError) {
    await removePendingDocument(
      document
    );

    throw new Error(
      "Не вдалося завершити збереження документа. Завантажений файл очищено."
    );
  }

  await recordActivity({
    action:
      "object.document.created",
    entityType:
      "object_document",
    entityId:
      document.id,
    entityName:
      document.title,
    objectId,
    description:
      `Завантажив документ «${document.title}».`,
    metadata: {
      category:
        document.category,
      access_level:
        document.access_level,
      original_file_name:
        document.original_file_name,
    },
  });

  refreshObjectDocuments(
    objectId
  );
}

export async function updateObjectDocumentMetadata(
  formData: FormData
) {
  await requireDocumentManagementAccess();
  const documentId = Number(
    getText(
      formData,
      "document_id"
    )
  );
  const objectId = Number(
    getText(
      formData,
      "object_id"
    )
  );

  validatePositiveId(
    documentId,
    "Не вдалося визначити документ."
  );
  validatePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const metadata =
    normalizeObjectDocumentMetadata(
      {
        title: getText(
          formData,
          "title"
        ),
        category: getText(
          formData,
          "category"
        ),
        accessLevel: getText(
          formData,
          "access_level"
        ),
        note: getText(
          formData,
          "note"
        ),
      }
    );
  const previousDocument =
    await getObjectDocumentForAction(
      documentId,
      objectId
    );

  if (
    !previousDocument ||
    !previousDocument.is_ready
  ) {
    throw new Error(
      "Документ не знайдено."
    );
  }

  const supabase =
    await createClient();
  const {
    error,
  } = await supabase
    .from("object_documents")
    .update({
      title: metadata.title,
      category:
        metadata.category,
      access_level:
        metadata.accessLevel,
      note: metadata.note,
    })
    .eq("id", documentId)
    .eq("object_id", objectId)
    .eq("is_ready", true);

  if (error) {
    throw new Error(
      "Не вдалося оновити документ."
    );
  }

  await recordActivity({
    action:
      "object.document.updated",
    entityType:
      "object_document",
    entityId: documentId,
    entityName:
      metadata.title,
    objectId,
    description:
      `Оновив документ «${metadata.title}».`,
    metadata: {
      previous_title:
        previousDocument.title,
      new_title:
        metadata.title,
      previous_category:
        previousDocument.category,
      new_category:
        metadata.category,
      previous_access_level:
        previousDocument.access_level,
      new_access_level:
        metadata.accessLevel,
      original_file_name:
        previousDocument.original_file_name,
    },
  });

  refreshObjectDocuments(
    objectId
  );
}

export async function deleteObjectDocument(
  documentId: number,
  objectId: number
) {
  await requireDocumentManagementAccess();
  const document =
    await getObjectDocumentForAction(
      documentId,
      objectId
    );

  if (
    !document ||
    !document.is_ready
  ) {
    throw new Error(
      "Документ не знайдено."
    );
  }

  const adminClient =
    createServiceRoleClient();
  const {
    error: pendingError,
  } = await adminClient
    .from("object_documents")
    .update({
      is_ready: false,
    })
    .eq("id", documentId)
    .eq("object_id", objectId)
    .eq("is_ready", true);

  if (pendingError) {
    throw new Error(
      "Не вдалося підготувати документ до видалення."
    );
  }

  const {
    error: storageError,
  } = await adminClient.storage
    .from(
      OBJECT_DOCUMENTS_BUCKET
    )
    .remove([
      document.storage_path,
    ]);

  if (storageError) {
    await adminClient
      .from("object_documents")
      .update({
        is_ready: true,
      })
      .eq("id", documentId)
      .eq("object_id", objectId);

    throw new Error(
      "Не вдалося видалити файл документа. Запис документа відновлено."
    );
  }

  const {
    error: deleteError,
  } = await adminClient
    .from("object_documents")
    .delete()
    .eq("id", documentId)
    .eq("object_id", objectId)
    .eq("is_ready", false);

  if (deleteError) {
    throw new Error(
      "Файл видалено, але технічний запис не вдалося очистити. Повідом адміністратора."
    );
  }

  await recordActivity({
    action:
      "object.document.deleted",
    entityType:
      "object_document",
    entityId: document.id,
    entityName:
      document.title,
    objectId,
    description:
      `Видалив документ «${document.title}».`,
    metadata: {
      category:
        document.category,
      access_level:
        document.access_level,
      original_file_name:
        document.original_file_name,
    },
  });

  refreshObjectDocuments(
    objectId
  );
}

export async function createObjectDocumentSignedUrl(
  documentId: number
) {
  await requireDocumentUser();
  const document =
    await getObjectDocumentForAction(
      documentId
    );

  if (
    !document ||
    !document.is_ready
  ) {
    throw new Error(
      "Документ не знайдено або він недоступний."
    );
  }

  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase.storage
    .from(
      OBJECT_DOCUMENTS_BUCKET
    )
    .createSignedUrl(
      document.storage_path,
      SIGNED_DOCUMENT_URL_TTL_SECONDS
    );

  if (
    error ||
    !data?.signedUrl
  ) {
    throw new Error(
      "Не вдалося відкрити документ."
    );
  }

  return {
    url: data.signedUrl,
  };
}
