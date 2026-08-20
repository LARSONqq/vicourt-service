import UserManagement from "@/components/users/UserManagement";

import { requireSectionAccess } from "@/lib/auth/requireAccess";

import { getEmployees } from "@/services/employeeService";
import { getUserProfiles } from "@/services/profileService";

export default async function UsersPage() {
  const currentProfile =
    await requireSectionAccess(
      "users"
    );

  const [
    profiles,
    employees,
  ] = await Promise.all([
    getUserProfiles(),
    getEmployees(),
  ]);

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Користувачі
        </h1>

        <p className="mt-1 text-sm leading-5 text-gray-500 sm:text-base">
          Керування акаунтами,
          ролями та зв’язком із
          працівниками
        </p>
      </div>

      {/* USER MANAGEMENT */}
      <div className="min-w-0">
        <UserManagement
          profiles={
            profiles
          }
          employees={
            employees
          }
          currentUserId={
            currentProfile.id
          }
        />
      </div>
    </div>
  );
}