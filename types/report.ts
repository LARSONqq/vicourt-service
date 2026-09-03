import type {
  ObjectExpenseCategory,
} from "@/constants/objectExpenses";
import type {
  ObjectPaymentStatus,
} from "@/types/objectPayment";
import type {
  ObjectPaymentScheduleStatus,
} from "@/types/objectPaymentSchedule";
import type {
  WarehouseMovementCode,
} from "@/types/warehouseMovement";

export type ReportMovementType =
  | "Прихід"
  | "Списання";

export type ReportsFilters = {
  dateFrom: string;
  dateTo: string;
  objectId: number | null;
  employeeId: number | null;
  expenseCategory:
    | ObjectExpenseCategory
    | null;
  movementType:
    | ReportMovementType
    | null;
};

export type ReportsFilterInput = {
  from?: string;
  to?: string;
  object?: string;
  employee?: string;
  expenseCategory?: string;
  movementType?: string;
};

export type ReportObjectOption = {
  id: number;
  name: string;
};

export type ReportEmployeeOption = {
  id: number;
  name: string;
};

export type ReportKpis = {
  materialsCost: number;
  laborCost: number;
  otherExpensesCost: number;
  totalObjectCost: number;
  totalHours: number;
  purchasedCost: number;
  paymentsReceived: number;
  outstandingReceivables: number;
  objectsWithoutClientPrice: number;
  overdueScheduleAmount: number;
};

export type ReportObjectCost = {
  objectId: number;
  objectName: string;
  materialsCost: number;
  laborCost: number;
  otherExpensesCost: number;
  totalCost: number;
  hours: number;
  periodPaymentsReceived: number;
  costBudget: number | null;
  clientPrice: number | null;
  lifetimeMaterialsCost: number;
  lifetimeLaborCost: number;
  lifetimeOtherExpensesCost: number;
  lifetimeActualCost: number;
  budgetRemaining: number | null;
  budgetOverrun: number | null;
  financialResult: number | null;
  marginPercent: number | null;
  lifetimePaid: number;
  remainingToPay: number | null;
  overpayment: number | null;
  paymentStatus:
    ObjectPaymentStatus;
};

export type ReportMaterialAccountingMethod =
  | "exact_ledger"
  | "legacy_approximation"
  | "opening_snapshot";

export type ReportMaterialPeriodMode =
  | "exact"
  | "legacy"
  | "mixed";

export type ReportMaterialAccounting = {
  periodMode: ReportMaterialPeriodMode;
  periodTotal: number;
  exactCost: number;
  legacyApproximateCost:
    number | null;
  cutoverAt: string | null;
  exactFromDate: string | null;
  lifetimeMethod:
    | "exact_ledger"
    | "legacy_current_balance";
  limitation: string | null;
};

export type ReportPaymentDetail = {
  id: number;
  objectId: number;
  objectName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string | null;
  note: string | null;
};

export type ReportPaymentScheduleDetail = {
  id: number;
  objectId: number;
  objectName: string;
  title: string;
  dueDate: string;
  plannedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: ObjectPaymentScheduleStatus;
  note: string | null;
};

export type ReportEmployeeWork = {
  employeeId: number | null;
  employeeName: string;
  recordsCount: number;
  hours: number;
  laborCost: number;
  objectsCount: number;
};

export type ReportExpenseCategory = {
  category: string;
  recordsCount: number;
  amount: number;
  share: number;
};

export type ReportExpenseHighlight = {
  id: number;
  objectId: number;
  objectName: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
};

export type ReportExpenseDetail = {
  id: number;
  expenseDate: string;
  objectName: string;
  category: string;
  description: string;
  amount: number;
  note: string | null;
  createdBy: string | null;
};

export type ReportPurchaseSummary = {
  plannedCount: number;
  plannedAmount: number;
  purchasedCount: number;
  purchasedAmount: number;
};

export type ReportPurchaseExportRow = {
  material: string;
  status: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  supplier: string | null;
  createdAt: string;
  purchasedAt: string | null;
  note: string | null;
};

export type ReportWarehouseSnapshotRow = {
  material: string;
  category: string | null;
  stockQuantity: number;
  unit: string;
  minimumQuantity: number;
  targetQuantity: number | null;
  targetShortage: number | null;
  plannedIncoming: number;
  remainingRecommended: number | null;
  averagePrice: number;
  lastPurchasePrice: number | null;
  stockValue: number;
  supplier: string | null;
};

export type ReportWarehouseMovement = {
  id: number;
  itemName: string;
  objectName: string | null;
  movementType: ReportMovementType;
  movementCode: WarehouseMovementCode;
  movementLabel: string;
  accountingMethod:
    ReportMaterialAccountingMethod;
  objectCostImpact: number | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  createdAt: string;
  performedBy: string | null;
  source: string;
  note: string | null;
};

export type ReportPaymentScheduleSummary = {
  plannedAmount: number;
  paidAmount: number;
  dueTodayAmount: number;
  overdueAmount: number;
};

export type ReportWarehouseSummary = {
  incomeCount: number;
  writeOffCount: number;
  incomeValue: number;
  writeOffValue: number;
  currentItemsCount: number;
  currentLowStockCount: number;
  currentStockValue: number;
  recentMovements:
    ReportWarehouseMovement[];
};

export type ReportsData = {
  filters: ReportsFilters;
  invalidPeriod: boolean;
  objectOptions:
    ReportObjectOption[];
  employeeOptions:
    ReportEmployeeOption[];
  kpis: ReportKpis;
  materialAccounting:
    ReportMaterialAccounting;
  objectCosts: ReportObjectCost[];
  employeeWork:
    ReportEmployeeWork[];
  expenseCategories:
    ReportExpenseCategory[];
  expenseHighlights:
    ReportExpenseHighlight[];
  expenseDetails:
    ReportExpenseDetail[];
  paymentDetails:
    ReportPaymentDetail[];
  paymentScheduleDetails:
    ReportPaymentScheduleDetail[];
  paymentScheduleSummary:
    ReportPaymentScheduleSummary;
  purchases:
    ReportPurchaseSummary;
  purchaseExportRows:
    ReportPurchaseExportRow[];
  warehouseMovementExportRows:
    ReportWarehouseMovement[];
  warehouseSnapshotRows:
    ReportWarehouseSnapshotRow[];
  warehouse:
    ReportWarehouseSummary;
};
