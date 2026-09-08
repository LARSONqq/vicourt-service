import type {
  Equipment,
} from "@/types/equipment";
import type {
  ActivityLog,
} from "@/types/activityLog";
import type {
  EquipmentMaintenanceEvaluation,
  EquipmentMaintenanceState,
} from "@/lib/equipmentMaintenance";
import type {
  EquipmentServiceRecordOperational,
  EquipmentServiceRecordView,
} from "@/types/equipmentServiceRecord";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";

export type EquipmentScopedPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type EquipmentServiceHistoryPage =
  EquipmentScopedPage<EquipmentServiceRecordView> & {
    includesCost: boolean;
  };

export type EquipmentMaintenanceOverview = {
  equipmentId: number;
  today: string;
  nextServiceDate: string | null;
  dateState: EquipmentMaintenanceState;
  evaluation: EquipmentMaintenanceEvaluation;
};

export type EquipmentServiceCostKpis = {
  total: number;
  currentYear: number;
  yearStart: string;
};

export type EquipmentProfileKpis = {
  equipmentId: number;
  status: string;
  currentUsage: number | null;
  nextServiceDate: string | null;
  nextMaintenanceUsage: number | null;
  activeMaintenanceTask: TaskWithObject | null;
  openTasks: number;
  overdueTasks: number;
  serviceCount: number;
  lastService: EquipmentServiceRecordOperational | null;
  serviceCosts?: EquipmentServiceCostKpis;
};

export type EquipmentOverviewPreview = {
  equipment: Equipment;
  maintenance: EquipmentMaintenanceOverview;
  kpis: EquipmentProfileKpis;
};

export type EquipmentActivityAssociation =
  | "equipment_entity"
  | "equipment_task_target";

export type EquipmentActivityLog = ActivityLog & {
  equipmentAssociation: EquipmentActivityAssociation;
};

export type EquipmentActivityPage =
  EquipmentScopedPage<EquipmentActivityLog>;
