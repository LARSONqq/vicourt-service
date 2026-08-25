export const WORK_LOG_ATTACHMENTS_BUCKET =
  "work-log-attachments";

export const MAX_WORK_LOG_ATTACHMENT_SIZE =
  10 * 1024 * 1024;

export const WORK_LOG_ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx";

const contentTypesByExtension = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export type WorkLogAttachmentMetadata = {
  attachmentPath: string;
  attachmentName: string;
  attachmentType: string;
  attachmentSize: number;
};

export function getWorkLogAttachmentExtension(
  fileName: string
) {
  const extension =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase() || "";

  return extension in
    contentTypesByExtension
    ? (extension as keyof typeof contentTypesByExtension)
    : null;
}

export function getWorkLogAttachmentContentType(
  fileName: string
) {
  const extension =
    getWorkLogAttachmentExtension(
      fileName
    );

  return extension
    ? contentTypesByExtension[
        extension
      ]
    : null;
}

export function getWorkLogAttachmentValidationError(
  file: {
    name: string;
    size: number;
    type: string;
  }
) {
  const contentType =
    getWorkLogAttachmentContentType(
      file.name
    );

  if (!contentType) {
    return "Дозволені формати: PDF, DOC, DOCX, XLS, XLSX.";
  }

  if (
    !Number.isFinite(
      file.size
    ) ||
    file.size <= 0
  ) {
    return "Вибраний файл порожній.";
  }

  if (
    file.size >
    MAX_WORK_LOG_ATTACHMENT_SIZE
  ) {
    return "Максимальний розмір файла — 10 МБ.";
  }

  if (
    file.type &&
    file.type !==
      "application/octet-stream" &&
    file.type !== contentType
  ) {
    return "Тип файла не відповідає його розширенню.";
  }

  return null;
}

export function getWorkLogAttachmentMetadataValidationError(
  metadata: WorkLogAttachmentMetadata,
  objectId: number
) {
  const extension =
    getWorkLogAttachmentExtension(
      metadata.attachmentName
    );

  const contentType =
    getWorkLogAttachmentContentType(
      metadata.attachmentName
    );

  if (
    !extension ||
    !contentType
  ) {
    return "Дозволені формати: PDF, DOC, DOCX, XLS, XLSX.";
  }

  if (
    !metadata.attachmentName ||
    metadata.attachmentName.length >
      255 ||
    metadata.attachmentName.includes(
      "/"
    ) ||
    metadata.attachmentName.includes(
      "\\"
    )
  ) {
    return "Назва прикріпленого файла неправильна або надто довга.";
  }

  if (
    metadata.attachmentType !==
    contentType
  ) {
    return "Тип прикріпленого файла неправильний.";
  }

  if (
    !Number.isInteger(
      metadata.attachmentSize
    ) ||
    metadata.attachmentSize <= 0 ||
    metadata.attachmentSize >
      MAX_WORK_LOG_ATTACHMENT_SIZE
  ) {
    return "Розмір прикріпленого файла неправильний.";
  }

  const expectedPathPattern =
    new RegExp(
      `^${objectId}/[a-z0-9-]+\\.${extension}$`,
      "i"
    );

  if (
    !expectedPathPattern.test(
      metadata.attachmentPath
    )
  ) {
    return "Шлях прикріпленого файла неправильний.";
  }

  return null;
}
