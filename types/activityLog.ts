export type ActivityEntityType =
  | "object"
  | "task"
  | "material"
  | "work_log"
  | "object_expense"
  | "object_payment"
  | "object_payment_schedule"
  | "purchase"
  | "equipment";

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
  actor_name: string;
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
  entityType?: string;
  actorName?: string;
  objectName?: string;
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
}
