import UserManagement from "@/components/users/UserManagement";

import { requireSectionAccess } from "@/lib/auth/requireAccess";

import { getEmployees } from "@/services/employeeService";
import { getUserProfiles } from "@/services/profileService";

export default async function UsersPage() {
  const currentProfile =
    await requireSectionAccess("users");

  const [
    profiles,
    employees,
  ] = await Promise.all([
    getUserProfiles(),
    getEmployees(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Користувачі
        </h1>

        <p className="mt-1 text-gray-500">
          Керування акаунтами,
          ролями та зв’язком із
          працівниками
        </p>
      </div>

      <UserManagement
        profiles={profiles}
        employees={employees}
        currentUserId={
          currentProfile.id
        }
      />
    </div>
  );
}