import type { Equipment } from "@/types/equipment";
import type { ActivityLog } from "@/types/activityLog";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";
import type { WorkLog } from "@/types/workLog";

export type EmployeeDirectoryWorkload = {
  employeeId: number;
  activeTasks: number;
  objects: number;
  equipment: number;
};

export type EmployeeProfileKpis = {
  employeeId: number;
  activeTasks: number;
  overdueTasks: number;
  completedTasks: number;
  monthlyHours: number;
  lifetimeHours: number;
  workLogs: number;
  objects: number;
  equipment: number;
  monthStart: string;
};

export type EmployeeScopedPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type EmployeeTaskFilter =
  | "all"
  | "active"
  | "overdue"
  | "completed";

export type EmployeeWorkLog =
  WorkLog & {
    object: {
      id: number;
      name: string;
    } | null;
  };

export type EmployeeTaskPage =
  EmployeeScopedPage<TaskWithObject>;

export type EmployeeWorkLogPage =
  EmployeeScopedPage<EmployeeWorkLog>;

export type EmployeeObjectPage =
  EmployeeScopedPage<ObjectItem>;

export type EmployeeEquipmentPage =
  EmployeeScopedPage<Equipment>;

export type EmployeeActivityPage =
  EmployeeScopedPage<ActivityLog>;

export type EmployeeSupervisionPreview = Pick<
  ObjectItem,
  | "id"
  | "name"
  | "status"
  | "last_supervision_date"
  | "next_supervision_date"
  | "supervision_interval_days"
>;

export type EmployeeActor = {
  actorId: string;
  actorName: string;
};
