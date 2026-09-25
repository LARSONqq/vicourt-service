// Client metadata only. Never reuse the internal ObjectDocument DTO.
export type ClientObjectDocument = {
  id: number;
  object_id: number;
  title: string;
  description: string | null;
  mime_type: string;
  file_size: number;
  published_at: string;
};

export type ClientObjectDocumentsPage = {
  items: ClientObjectDocument[];
  page: number;
  pageSize: 20;
  // An empty non-first page has no count row; do not fabricate the total.
  totalCount: number | null;
  hasNextPage: boolean;
};

export type ManagementClientDocumentPublication = {
  document_id: number;
  object_id: number;
  is_published: boolean;
  // NULL represents a source document with no publication row yet.
  client_title: string | null;
  client_description: string | null;
  sort_order: number;
  published_at: string | null;
  unpublished_at: string | null;
  updated_at: string | null;
};

export type SetClientDocumentPublicationInput = {
  object_id: number;
  document_id: number;
  is_published: boolean;
  client_title: string;
  client_description: string | null;
  sort_order: number;
};
