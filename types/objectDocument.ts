export type ObjectDocumentCategory =
  | "contract"
  | "estimate"
  | "drawing"
  | "act"
  | "spreadsheet"
  | "instruction"
  | "other";

export type ObjectDocumentAccessLevel =
  | "team"
  | "management";

export interface ObjectDocument {
  id: number;
  object_id: number;
  title: string;
  category: ObjectDocumentCategory;
  access_level: ObjectDocumentAccessLevel;
  original_file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PrepareObjectDocumentUploadInput = {
  objectId: number;
  title: string;
  category: string;
  accessLevel: string;
  note: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type PreparedObjectDocumentUpload = {
  documentId: number;
  objectId: number;
  storagePath: string;
  uploadToken: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
};
