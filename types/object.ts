export interface ObjectItem {
  id: number;
  name: string;
  customer: string | null;
  phone: string | null;
  address: string | null;
  status: string;

  manager: string | null;
  responsible_employee_id: number | null;

  cost_budget?: number | null;
  client_price?: number | null;

  supervision_interval_days:
    | number
    | null;
  last_supervision_date:
    | string
    | null;
  next_supervision_date:
    | string
    | null;

  created_at: string;
}

export type ManagementObjectItem =
  ObjectItem & {
    cost_budget: number | null;
    client_price: number | null;
  };
