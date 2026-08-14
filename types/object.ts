export interface ObjectItem {
  id: number;
  name: string;
  customer: string | null;
  phone: string | null;
  address: string | null;
  status: string;

  manager: string | null;
  responsible_employee_id: number | null;

  created_at: string;
}