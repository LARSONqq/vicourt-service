import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  NotificationItem,
  NotificationSummary,
} from "@/types/notification";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";
import type {
  UserRole,
} from "@/types/userProfile";

export type DashboardPermissions = {
  canCreateObject: boolean;
  canCreateTask: boolean;
  canCreatePurchase: boolean;
  canCreateEquipment: boolean;
  canManageSupervision: boolean;
  canManageEquipment: boolean;
  canViewPurchases: boolean;
  canViewFinance: boolean;
};

export type DashboardObjectPreview = {
  id: number;
  name: string;
  customer: string | null;
  manager: string | null;
  status: string;
  createdAt: string;
};

export type DashboardDatedEntityPreview = {
  id: number;
  name: string;
  date: string;
};

export type DashboardWarehouseItem = {
  id: number;
  name: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  targetQuantity: number | null;
  plannedIncoming: number | null;
  recommendedRemaining: number | null;
};

export type DashboardFinanceSummary = {
  overdueCount: number;
  overdueAmount: number;
  dueTodayCount: number;
  dueTodayAmount: number;
};

export type DashboardData = {
  today: string;
  role: UserRole;
  userName: string | null;
  currency: AppCurrency;
  permissions: DashboardPermissions;
  kpis: {
    activeObjects: number;
    todayTasks: number;
    overdueTasks: number;
    attentionItems: number;
    lowStockItems: number;
    overduePayments: number | null;
  };
  attention: {
    items: NotificationItem[];
    summary: NotificationSummary;
  };
  todayTasks: TaskWithObject[];
  nearestTasks: TaskWithObject[];
  objects: {
    working: number;
    permanentMaintenance: number;
    supervision: number;
    supervisionToday: number;
    supervisionOverdue: number;
    nextSupervision: DashboardDatedEntityPreview | null;
    recent: DashboardObjectPreview[];
  };
  equipment: {
    active: number;
    maintenanceToday: number;
    maintenanceOverdue: number;
    nextMaintenance: DashboardDatedEntityPreview | null;
  };
  warehouse: {
    lowStockCount: number;
    items: DashboardWarehouseItem[];
    planningVisible: boolean;
  };
  purchases: {
    plannedCount: number;
  } | null;
  finance: DashboardFinanceSummary | null;
};
