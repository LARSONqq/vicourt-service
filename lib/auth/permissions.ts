import type { UserRole } from "@/types/userProfile";

export type AppSection =
  | "home"
  | "objects"
  | "tasks"
  | "calendar"
  | "warehouse"
  | "purchases"
  | "equipment"
  | "employees"
  | "reports"
  | "settings"
  | "users";

const permissions: Record<
  UserRole,
  AppSection[]
> = {
  admin: [
    "home",
    "objects",
    "tasks",
    "calendar",
    "warehouse",
    "purchases",
    "equipment",
    "employees",
    "reports",
    "settings",
    "users",
  ],

  object_manager: [
    "home",
    "objects",
    "tasks",
    "calendar",
    "warehouse",
    "purchases",
    "equipment",
    "employees",
    "reports",
  ],

  worker: [
    "home",
    "objects",
    "tasks",
    "calendar",
    "warehouse",
    "equipment",
  ],
};

export function canAccessSection(
  role: UserRole,
  section: AppSection
) {
  return permissions[
    role
  ].includes(section);
}

export function isAdmin(
  role: UserRole
) {
  return role === "admin";
}

export function isObjectManager(
  role: UserRole
) {
  return role === "object_manager";
}

export function isWorker(
  role: UserRole
) {
  return role === "worker";
}

export function canManageObjects(
  role: UserRole
) {
  return (
    role === "admin" ||
    role === "object_manager"
  );
}

export function canManageTasks(
  role: UserRole
) {
  return (
    role === "admin" ||
    role === "object_manager"
  );
}

export function canViewWarehouse(
  role: UserRole
) {
  return (
    role === "admin" ||
    role === "object_manager" ||
    role === "worker"
  );
}

export function canManageWarehouse(
  role: UserRole
) {
  return role === "admin";
}

export function canUseWarehouseForObjects(
  role: UserRole
) {
  return (
    role === "admin" ||
    role === "object_manager"
  );
}

export function canManagePurchases(
  role: UserRole
) {
  return (
    role === "admin" ||
    role === "object_manager"
  );
}

export function canViewEquipment(
  role: UserRole
) {
  return (
    role === "admin" ||
    role === "object_manager" ||
    role === "worker"
  );
}

export function canManageEquipment(
  role: UserRole
) {
  return role === "admin";
}

export function canManageEmployees(
  role: UserRole
) {
  return role === "admin";
}

export function canViewReports(
  role: UserRole
) {
  return (
    role === "admin" ||
    role === "object_manager"
  );
}

export function canManageSettings(
  role: UserRole
) {
  return role === "admin";
}

export function canManageUsers(
  role: UserRole
) {
  return role === "admin";
}