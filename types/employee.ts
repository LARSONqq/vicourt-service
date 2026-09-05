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

  position: string | null;

  status: EmployeeStatus;
}

export interface EmployeeDetails
  extends Employee {

  phone: string | null;

  email: string | null;

  employment_type: EmploymentType;

  hire_date: string | null;

  notes: string | null;

  created_at: string;
}

export type ManagementEmployee =
  EmployeeDetails & {
    hourly_rate: number;
  };
