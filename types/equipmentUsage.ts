import type {
  EquipmentUsageType,
} from "@/types/equipment";

export type ActiveEquipmentUsageType =
  Exclude<EquipmentUsageType, "none">;

export type EquipmentUsageEntryType =
  | "reading"
  | "correction";

export type EquipmentUsageLogEntryType =
  | EquipmentUsageEntryType
  | "work_session";

export interface EquipmentUsageLog {
  id: number;
  equipment_id: number | null;
  equipment_name_snapshot: string;
  inventory_number_snapshot: string | null;
  usage_type: ActiveEquipmentUsageType;
  reading: number;
  previous_reading: number | null;
  delta: number | null;
  reading_date: string;
  entry_type: EquipmentUsageLogEntryType;
  object_id: number | null;
  object_name_snapshot: string | null;
  employee_id: number | null;
  employee_name_snapshot: string | null;
  note: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
}

export interface EquipmentUsageRecordResult {
  equipment_id: number;
  equipment_name: string;
  usage_type: ActiveEquipmentUsageType;
  previous_current_usage: number | null;
  new_current_usage: number;
  reading_date: string;
  entry_type: EquipmentUsageEntryType;
  usage_log_id: number;
  appended: true;
}

export interface EquipmentUsageScheduleResult {
  equipment_id: number;
  equipment_name: string;
  previous_usage_type: EquipmentUsageType;
  new_usage_type: EquipmentUsageType;
  previous_maintenance_interval_usage: number | null;
  new_maintenance_interval_usage: number | null;
  previous_next_maintenance_usage: number | null;
  new_next_maintenance_usage: number | null;
}

export type RecordEquipmentUsageInput = {
  equipmentId: number;
  reading: number;
  readingDate: string;
  entryType: EquipmentUsageEntryType;
  note?: string | null;
};

export type RecordEquipmentWorkSessionInput = {
  equipmentId: number;
  duration: number;
  readingDate: string;
  objectId: number;
  employeeId: number;
  note?: string | null;
  idempotencyKey: string;
};

export interface EquipmentWorkSessionResult {
  usage_log_id: number;
  equipment_id: number;
  equipment_name: string;
  usage_type: "hours";
  previous_current_usage: number;
  new_current_usage: number;
  duration: number;
  reading_date: string;
  entry_type: "work_session";
  object_id: number;
  object_name: string;
  employee_id: number;
  employee_name: string;
  note: string | null;
  created_by_name: string;
  appended: true;
  idempotent_replay: boolean;
}

export type EquipmentWorkSessionObjectOption = {
  id: number;
  name: string;
};

export type EquipmentWorkSessionEmployeeOption = {
  id: number;
  first_name: string;
  last_name: string;
};

export type EquipmentWorkSessionFormOptions = {
  objects: EquipmentWorkSessionObjectOption[];
  employees: EquipmentWorkSessionEmployeeOption[];
};

export type ConfigureEquipmentUsageInput = {
  equipmentId: number;
  usageType: EquipmentUsageType;
  maintenanceIntervalUsage: number | null;
  nextMaintenanceUsage: number | null;
};
