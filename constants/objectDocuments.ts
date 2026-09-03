import type {
  ObjectDocumentAccessLevel,
  ObjectDocumentCategory,
} from "@/types/objectDocument";

export const OBJECT_DOCUMENTS_BUCKET =
  "object-documents";

export const MAX_OBJECT_DOCUMENT_SIZE =
  25 * 1024 * 1024;

export const OBJECT_DOCUMENT_TITLE_MAX_LENGTH =
  150;
export const OBJECT_DOCUMENT_NOTE_MAX_LENGTH =
  2000;
export const OBJECT_DOCUMENT_FILE_NAME_MAX_LENGTH =
  255;

export const OBJECT_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp";

export const OBJECT_DOCUMENT_CATEGORIES: ReadonlyArray<{
  value: ObjectDocumentCategory;
  label: string;
}> = [
  {
    value: "contract",
    label: "Договір",
  },
  {
    value: "estimate",
    label: "Кошторис",
  },
  {
    value: "drawing",
    label: "Креслення / Проєкт",
  },
  {
    value: "act",
    label: "Акт",
  },
  {
    value: "spreadsheet",
    label: "Таблиця",
  },
  {
    value: "instruction",
    label: "Інструкція",
  },
  {
    value: "other",
    label: "Інше",
  },
];

export const OBJECT_DOCUMENT_ACCESS_LEVELS: ReadonlyArray<{
  value: ObjectDocumentAccessLevel;
  label: string;
}> = [
  {
    value: "team",
    label: "Для команди",
  },
  {
    value: "management",
    label: "Тільки керівництво",
  },
];

const MIME_TYPES_BY_EXTENSION: Readonly<
  Record<string, readonly string[]>
> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  xls: [
    "application/vnd.ms-excel",
  ],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  csv: [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ],
  txt: ["text/plain"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};

export function isObjectDocumentCategory(
  value: string
): value is ObjectDocumentCategory {
  return OBJECT_DOCUMENT_CATEGORIES.some(
    (category) =>
      category.value === value
  );
}

export function isObjectDocumentAccessLevel(
  value: string
): value is ObjectDocumentAccessLevel {
  return OBJECT_DOCUMENT_ACCESS_LEVELS.some(
    (accessLevel) =>
      accessLevel.value === value
  );
}

export function getObjectDocumentExtension(
  fileName: string
) {
  const lastDotIndex =
    fileName.lastIndexOf(".");

  if (
    lastDotIndex <= 0 ||
    lastDotIndex ===
      fileName.length - 1
  ) {
    return null;
  }

  const extension =
    fileName
      .slice(lastDotIndex + 1)
      .toLocaleLowerCase("uk-UA");

  return extension in
    MIME_TYPES_BY_EXTENSION
    ? extension
    : null;
}

export function normalizeObjectDocumentMimeType(
  mimeType: string
) {
  return mimeType
    .split(";", 1)[0]
    .trim()
    .toLocaleLowerCase(
      "en-US"
    );
}

export function getObjectDocumentFileValidationError(
  file: {
    name: string;
    size: number;
    type: string;
  }
) {
  const normalizedName =
    file.name
      .normalize("NFKC")
      .trim();
  const extension =
    getObjectDocumentExtension(
      normalizedName
    );

  if (
    !normalizedName ||
    normalizedName.length >
      OBJECT_DOCUMENT_FILE_NAME_MAX_LENGTH ||
    normalizedName.includes("/") ||
    normalizedName.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(
      normalizedName
    )
  ) {
    return "Назва файла неправильна або надто довга.";
  }

  if (!extension) {
    return "Дозволені формати: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, JPEG, PNG, WEBP.";
  }

  if (
    !Number.isInteger(
      file.size
    ) ||
    file.size <= 0
  ) {
    return "Вибраний файл порожній.";
  }

  if (
    file.size >
    MAX_OBJECT_DOCUMENT_SIZE
  ) {
    return "Максимальний розмір файла — 25 МБ.";
  }

  const normalizedMimeType =
    normalizeObjectDocumentMimeType(
      file.type
    );

  if (
    !normalizedMimeType ||
    !MIME_TYPES_BY_EXTENSION[
      extension
    ].includes(
      normalizedMimeType
    )
  ) {
    return "Тип файла не відповідає його розширенню або не підтримується.";
  }

  return null;
}

export function normalizeObjectDocumentMetadata(
  values: {
    title: string;
    category: string;
    accessLevel: string;
    note: string;
  }
) {
  const title = values.title
    .normalize("NFKC")
    .trim();
  const note = values.note
    .normalize("NFKC")
    .trim();

  if (
    !title ||
    title.length >
      OBJECT_DOCUMENT_TITLE_MAX_LENGTH
  ) {
    throw new Error(
      "Назва документа має містити від 1 до 150 символів."
    );
  }

  if (
    !isObjectDocumentCategory(
      values.category
    )
  ) {
    throw new Error(
      "Вибери правильну категорію документа."
    );
  }

  if (
    !isObjectDocumentAccessLevel(
      values.accessLevel
    )
  ) {
    throw new Error(
      "Вибери правильний рівень доступу."
    );
  }

  if (
    note.length >
    OBJECT_DOCUMENT_NOTE_MAX_LENGTH
  ) {
    throw new Error(
      "Примітка не може перевищувати 2000 символів."
    );
  }

  return {
    title,
    category: values.category,
    accessLevel:
      values.accessLevel,
    note: note || null,
  };
}

export function getObjectDocumentCategoryLabel(
  category: ObjectDocumentCategory
) {
  return (
    OBJECT_DOCUMENT_CATEGORIES.find(
      (item) =>
        item.value === category
    )?.label || category
  );
}

export function getObjectDocumentAccessLabel(
  accessLevel: ObjectDocumentAccessLevel
) {
  return (
    OBJECT_DOCUMENT_ACCESS_LEVELS.find(
      (item) =>
        item.value ===
        accessLevel
    )?.label || accessLevel
  );
}

export function formatObjectDocumentFileSize(
  fileSize: number
) {
  const size = Number(
    fileSize
  );

  if (
    !Number.isFinite(size) ||
    size < 0
  ) {
    return "Невідомий розмір";
  }

  if (size < 1024) {
    return `${size} Б`;
  }

  if (
    size < 1024 * 1024
  ) {
    return `${new Intl.NumberFormat(
      "uk-UA",
      {
        maximumFractionDigits: 1,
      }
    ).format(size / 1024)} КБ`;
  }

  return `${new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 1,
    }
  ).format(
    size /
      (1024 * 1024)
  )} МБ`;
}

export function getObjectDocumentIcon(
  mimeType: string
) {
  if (
    mimeType ===
    "application/pdf"
  ) {
    return "📕";
  }

  if (
    mimeType.includes("word") ||
    mimeType.includes(
      "document"
    )
  ) {
    return "📘";
  }

  if (
    mimeType.includes("excel") ||
    mimeType.includes(
      "spreadsheet"
    ) ||
    mimeType.includes("csv")
  ) {
    return "📗";
  }

  if (
    mimeType.startsWith(
      "image/"
    )
  ) {
    return "🖼️";
  }

  return "📄";
}
