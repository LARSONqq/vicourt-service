// Portal gallery contract: never reuse the internal ObjectPhoto type.
export type ClientObjectPhoto = {
  id: number;
  object_id: number;
  caption: string | null;
  published_at: string;
};

export type ClientObjectPhotosPage = {
  items: ClientObjectPhoto[];
  page: number;
  pageSize: 12;
  // An empty non-first page has no total_count row; never fabricate a total.
  totalCount: number | null;
  hasNextPage: boolean;
};

export type ManagementClientPhotoPublication = {
  photo_id: number;
  object_id: number;
  is_published: boolean;
  client_caption: string | null;
  sort_order: number;
  published_at: string | null;
  unpublished_at: string | null;
  updated_at: string | null;
};

export type SetClientPhotoPublicationInput = {
  object_id: number;
  photo_id: number;
  is_published: boolean;
  client_caption: string | null;
  sort_order: number;
};

// Only the fields needed by internal photo-card controls, not the RPC snapshot.
export type ClientPhotoPublicationEditorState = Pick<ManagementClientPhotoPublication,
  "photo_id" | "is_published" | "client_caption" | "sort_order">;
