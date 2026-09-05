export interface WorkLog {
  id: number;

  object_id: number;

  employee_id: number | null;

  work_date: string;

  description: string;

  workers: string | null;

  hours: number;

  hourly_rate?: number;

  attachment_path: string | null;

  attachment_name: string | null;

  attachment_type: string | null;

  attachment_size: number | null;

  attachment_url?: string | null;

  created_at: string;
}

export type ManagementWorkLog =
  WorkLog & {
    hourly_rate: number;
  };
