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
  next_service_date: string | null;
  notes: string | null;
  created_at: string;
}