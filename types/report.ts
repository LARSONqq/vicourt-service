import type {
  ObjectExpenseCategory,
} from "@/constants/objectExpenses";

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
};

export type ReportObjectCost = {
  objectId: number;
  objectName: string;
  materialsCost: number;
  laborCost: number;
  otherExpensesCost: number;
  totalCost: number;
  hours: number;
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
};

export type ReportWarehouseMovement = {
  id: number;
  itemName: string;
  objectName: string | null;
  movementType: ReportMovementType;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  createdAt: string;
  performedBy: string | null;
  note: string | null;
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
  objectCosts: ReportObjectCost[];
  employeeWork:
    ReportEmployeeWork[];
  expenseCategories:
    ReportExpenseCategory[];
  expenseHighlights:
    ReportExpenseHighlight[];
  purchases:
    ReportPurchaseSummary;
  purchaseExportRows:
    ReportPurchaseExportRow[];
  warehouseMovementExportRows:
    ReportWarehouseMovement[];
  warehouse:
    ReportWarehouseSummary;
};
