export type EmploymentType =
  | "Постійна робота"
  | "Тимчасова робота"
  | "Підрядник";

export type EmployeeStatus =
  | "Активний"
  | "У відпустці"
  | "На лікарняному"
  | "Неактивний";

export interface Employee {
  id: number;

  first_name: string;

  last_name: string;

  phone: string | null;

  email: string | null;

  position: string | null;

  employment_type: EmploymentType;

  status: EmployeeStatus;

  hire_date: string | null;

  notes: string | null;

  hourly_rate?: number;

  created_at: string;
}

export type ManagementEmployee =
  Employee & {
    hourly_rate: number;
  };
