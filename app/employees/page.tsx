import EmployeeActions from "@/components/employees/EmployeeActions";
import EmployeeList from "@/components/employees/EmployeeList";

import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canManageEmployees } from "@/lib/auth/permissions";

import { getEmployees } from "@/services/employeeService";

export default async function EmployeesPage() {
  const currentProfile =
    await requireSectionAccess(
      "employees"
    );

  const canManage =
    canManageEmployees(
      currentProfile.role
    );

  const employees =
    await getEmployees();

  const activeCount =
    employees.filter(
      (employee) =>
        employee.status ===
        "Активний"
    ).length;

  const unavailableCount =
    employees.filter(
      (employee) =>
        employee.status ===
          "У відпустці" ||
        employee.status ===
          "На лікарняному"
    ).length;

  const contractorsCount =
    employees.filter(
      (employee) =>
        employee.employment_type ===
        "Підрядник"
    ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Працівники
          </h1>

          <p className="mt-1 text-gray-500">
            Команда, контакти, посади та
            статуси роботи
          </p>
        </div>

        {canManage && (
          <EmployeeActions />
        )}
      </div>

      {!canManage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="font-medium text-blue-800">
            Режим перегляду
          </p>

          <p className="mt-1 text-sm text-blue-700">
            Ти можеш переглядати
            працівників та їхню
            інформацію. Додавати,
            редагувати або видаляти
            працівників може лише
            адміністратор.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Усього працівників
          </p>

          <p className="mt-2 text-3xl font-bold">
            {employees.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Активні
          </p>

          <p className="mt-2 text-3xl font-bold text-green-700">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Тимчасово відсутні
          </p>

          <p className="mt-2 text-3xl font-bold text-orange-600">
            {unavailableCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Підрядники
          </p>

          <p className="mt-2 text-3xl font-bold text-blue-700">
            {contractorsCount}
          </p>
        </div>
      </div>

      <EmployeeList
        employees={employees}
        canManage={canManage}
      />
    </div>
  );
}