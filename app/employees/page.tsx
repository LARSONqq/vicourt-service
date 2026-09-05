import EmployeeActions from "@/components/employees/EmployeeActions";
import EmployeeList from "@/components/employees/EmployeeList";

import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canManageEmployees } from "@/lib/auth/permissions";

import { getManagementEmployees } from "@/services/employeeService";
import {
  getEmployeeDirectoryWorkloads,
} from "@/services/employeeDetailService";

export default async function EmployeesPage() {
  const currentProfile =
    await requireSectionAccess(
      "employees"
    );

  const canManage =
    canManageEmployees(
      currentProfile.role
    );

  const [
    employees,
    workloads,
  ] = await Promise.all([
    getManagementEmployees(),
    getEmployeeDirectoryWorkloads(),
  ]);

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
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Працівники
          </h1>

          <p className="mt-1 text-sm leading-5 text-gray-500 sm:text-base">
            Команда, контакти,
            посади та статуси роботи
          </p>
        </div>

        {canManage && (
          <div className="min-w-0">
            <EmployeeActions />
          </div>
        )}
      </div>

      {/* READ ONLY */}
      {!canManage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm">
              👁
            </div>

            <div className="min-w-0">
              <p className="font-medium text-blue-800">
                Режим перегляду
              </p>

              <p className="mt-1 text-sm leading-5 text-blue-700">
                Ти можеш переглядати
                працівників та їхню
                інформацію. Додавати,
                редагувати або
                видаляти працівників
                може лише
                адміністратор.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Усього працівників
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {employees.length}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Активні
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700 sm:text-3xl">
            {activeCount}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-xl border bg-white p-3 sm:p-5 ${
            unavailableCount > 0
              ? "border-orange-200"
              : ""
          }`}
        >
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Тимчасово відсутні
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              unavailableCount > 0
                ? "text-orange-600"
                : "text-gray-900"
            }`}
          >
            {unavailableCount}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Підрядники
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-700 sm:text-3xl">
            {contractorsCount}
          </p>
        </div>
      </div>

      {/* EMPLOYEE LIST */}
      <div className="min-w-0">
        <EmployeeList
          employees={
            employees
          }
          workloads={
            workloads
          }
          canManage={
            canManage
          }
        />
      </div>
    </div>
  );
}
