export interface WorkLog {
  id: number;

  object_id: number;

  employee_id: number | null;

  work_date: string;

  description: string;

  workers: string | null;

  hours: number;

  hourly_rate: number;

  created_at: string;
}