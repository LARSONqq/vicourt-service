import type {
  EquipmentUsageType,
} from "@/types/equipment";

export type EquipmentServiceType =
  | "Планове обслуговування"
  | "Ремонт"
  | "Заміна запчастин"
  | "Діагностика"
  | "Інше";

export interface EquipmentServiceRecord {
  id: number;
  equipment_id: number;
  service_type: EquipmentServiceType;
  service_date: string;
  cost: number;
  performed_by: string | null;
  description: string | null;
  next_service_date: string | null;
  usage_reading: number | null;
  usage_type_snapshot: Exclude<
    EquipmentUsageType,
    "none"
  > | null;
  usage_log_id: number | null;
  created_by: string | null;
  created_by_name: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;

  equipment: {
    id: number;
    name: string;
    inventory_number: string | null;
  } | null;
}

export interface EquipmentServiceCreationResult {
  service_history_id: number;
  equipment_id: number;
  equipment_name: string;
  service_type: EquipmentServiceType;
  service_date: string;
  cost: number;
  performed_by: string | null;
  description: string | null;
  next_service_date: string | null;
  usage_type: Exclude<
    EquipmentUsageType,
    "none"
  > | null;
  usage_reading: number | null;
  usage_log_id: number | null;
}

export interface EquipmentServiceVoidResult {
  service_history_id: number;
  equipment_id: number;
  equipment_name: string;
  service_type: EquipmentServiceType;
  service_date: string;
  cost: number;
  void_reason: string;
}

export type CreateEquipmentServiceRecordInput = {
  equipmentId: number;
  serviceType: EquipmentServiceType;
  serviceDate: string;
  cost: number;
  performedBy?: string | null;
  description?: string | null;
  nextServiceDate?: string | null;
  usageReading?: number | null;
};

export type VoidEquipmentServiceRecordInput = {
  serviceRecordId: number;
  reason: string;
};
