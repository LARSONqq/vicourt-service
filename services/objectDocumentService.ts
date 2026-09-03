import "server-only";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  ObjectDocument,
} from "@/types/objectDocument";

type ObjectDocumentActionRow =
  ObjectDocument & {
    is_ready: boolean;
  };

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

const OBJECT_DOCUMENT_SELECT = `
  id,
  object_id,
  title,
  category,
  access_level,
  original_file_name,
  storage_path,
  mime_type,
  file_size,
  note,
  created_by,
  created_at,
  updated_at
`;

const OBJECT_DOCUMENT_ACTION_SELECT = `
  ${OBJECT_DOCUMENT_SELECT},
  is_ready
`;

export async function getObjectDocuments(
  objectId: number
): Promise<ObjectDocument[]> {
  validatePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("object_documents")
    .select(
      OBJECT_DOCUMENT_SELECT
    )
    .eq(
      "object_id",
      objectId
    )
    .eq(
      "is_ready",
      true
    )
    .order("created_at", {
      ascending: false,
    })
    .overrideTypes<
      ObjectDocument[]
    >();

  if (error) {
    throw new Error(
      "Не вдалося завантажити документи об’єкта."
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function getObjectDocumentForAction(
  documentId: number,
  objectId?: number
): Promise<ObjectDocumentActionRow | null> {
  validatePositiveId(
    documentId,
    "Не вдалося визначити документ."
  );

  if (
    objectId !== undefined
  ) {
    validatePositiveId(
      objectId,
      "Не вдалося визначити об’єкт."
    );
  }

  const supabase =
    await createClient();
  let query = supabase
    .from("object_documents")
    .select(
      OBJECT_DOCUMENT_ACTION_SELECT
    )
    .eq("id", documentId);

  if (
    objectId !== undefined
  ) {
    query = query.eq(
      "object_id",
      objectId
    );
  }

  const {
    data,
    error,
  } = await query
    .maybeSingle()
    .overrideTypes<
      ObjectDocumentActionRow | null
    >();

  if (error) {
    throw new Error(
      "Не вдалося завантажити документ."
    );
  }

  return data || null;
}

export async function getObjectDocumentObjectSnapshot(
  objectId: number
) {
  validatePositiveId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .select(`
      id,
      name
    `)
    .eq("id", objectId)
    .maybeSingle<{
      id: number;
      name: string;
    }>();

  if (error) {
    throw new Error(
      "Не вдалося перевірити об’єкт."
    );
  }

  if (!data) {
    throw new Error(
      "Об’єкт не знайдено або він недоступний."
    );
  }

  return data;
}
