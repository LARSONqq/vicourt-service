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
  created_at: string;

  equipment: {
    id: number;
    name: string;
    inventory_number: string;
  } | null;
}