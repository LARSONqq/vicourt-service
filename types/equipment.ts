export interface Equipment {
  id: number;
  name: string;
  category: string | null;
  inventory_number: string | null;
  status: string;

  responsible: string | null;
  responsible_employee_id: number | null;

  location: string | null;
  purchase_date: string | null;
  maintenance_interval_days: number | null;
  last_maintenance_date: string | null;
  next_service_date: string | null;
  notes: string | null;
  created_at: string;
}

export type EquipmentMaintenanceCompletionResult = {
  service_history_id: number;
  equipment_name: string;
  previous_last_maintenance_date: string | null;
  new_last_maintenance_date: string;
  previous_next_service_date: string | null;
  new_next_service_date: string;
  maintenance_interval_days: number;
  completed_task_id: number | null;
  next_task_id: number | null;
};

export type EquipmentMaintenanceActionResult =
  | {
      success: true;
      message: string;
      completion: EquipmentMaintenanceCompletionResult;
    }
  | {
      success: false;
      message: string;
    };
