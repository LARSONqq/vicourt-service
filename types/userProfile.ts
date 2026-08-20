export type UserRole =
  | "admin"
  | "object_manager"
  | "worker";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  employee_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function getUserRoleLabel(
  role: UserRole
) {
  switch (role) {
    case "admin":
      return "Адміністратор";

    case "object_manager":
      return "Керівник об’єкта";

    case "worker":
      return "Працівник";

    default:
      return "Користувач";
  }
}