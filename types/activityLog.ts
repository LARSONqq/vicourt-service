export type ActivityEntityType =
  | "object"
  | "task"
  | "material"
  | "work_log"
  | "object_expense"
  | "object_payment"
  | "object_payment_schedule"
  | "object_document"
  | "purchase"
  | "equipment"
  | "employee";

export type ActivityCategory =
  | "objects"
  | "tasks"
  | "warehouse"
  | "purchases"
  | "finance"
  | "equipment"
  | "supervision"
  | "documents"
  | "employees"
  | "other";

export type ActivityMetadataValue =
  | string
  | number
  | boolean
  | null;

export type ActivityMetadata =
  Record<
    string,
    ActivityMetadataValue
  >;

export interface ActivityLog {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  entity_name: string | null;
  object_id: number | null;
  object_name: string | null;
  description: string;
  metadata: ActivityMetadata;
  created_at: string;
}

export interface ActivityLogFilters {
  search?: string;
  category?: string;
  action?: string;
  actorId?: string;
  actorName?: string;
  objectId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

export interface ActivityLogPage {
  logs: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  existingObjectIds: number[];
}

export interface ActivityActorOption {
  id: string;
  name: string;
}

export interface ActivityObjectOption {
  id: number;
  name: string;
}

export interface ActivityFilterOptions {
  actors: ActivityActorOption[];
  objects: ActivityObjectOption[];
}

export interface ActivityLogCursor {
  createdAt: string;
  id: number;
}

export interface ObjectActivityLogPage {
  logs: ActivityLog[];
  nextCursor: ActivityLogCursor | null;
}

export interface ActivityDetail {
  label: string;
  value?: string;
  previousValue?: string;
  newValue?: string;
}

export interface ActivityEntityLink {
  label: string;
  name: string;
  href: string | null;
}

export interface ActivityPresentation {
  label: string;
  category: ActivityCategory;
  categoryLabel: string;
  icon: string;
  actorName: string;
  description: string;
  details: ActivityDetail[];
  entity: ActivityEntityLink | null;
  object: ActivityEntityLink | null;
  sectionHref: string | null;
  isKnownEvent: boolean;
}
