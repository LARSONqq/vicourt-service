import EquipmentActions from "@/components/equipment/EquipmentActions";
import EquipmentList from "@/components/equipment/EquipmentList";
import EquipmentMaintenancePanel from "@/components/equipment/EquipmentMaintenancePanel";
import EquipmentServiceHistory from "@/components/equipment/EquipmentServiceHistory";

import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canManageEquipment } from "@/lib/auth/permissions";
import {
  getEquipmentMaintenanceState,
} from "@/lib/equipmentMaintenance";
import {
  getKyivDateValue,
} from "@/lib/kyivDate";

import { getEmployees } from "@/services/employeeService";

import {
  getEquipment,
  getEquipmentServiceRecords,
} from "@/services/equipmentService";

import { getAppSettings } from "@/services/settingsService";

export default async function EquipmentPage() {
  const currentProfile =
    await requireSectionAccess(
      "equipment"
    );

  const canManage =
    canManageEquipment(
      currentProfile.role
    );

  const [
    equipment,
    serviceRecords,
    employees,
    settings,
  ] = await Promise.all([
    getEquipment(),
    getEquipmentServiceRecords(),
    getEmployees(),
    getAppSettings(),
  ]);

  const workingCount =
    equipment.filter(
      (item) =>
        item.status ===
          "Справна" ||
        item.status ===
          "В роботі"
    ).length;

  const repairCount =
    equipment.filter(
      (item) =>
        item.status ===
          "На ремонті" ||
        item.status ===
          "Потребує ремонту"
    ).length;

  const today =
    getKyivDateValue();
  const maintenanceAttentionCount =
    equipment.filter(
      (item) => {
        const state =
          getEquipmentMaintenanceState(
            item.maintenance_interval_days,
            item.next_service_date,
            today
          );

        return (
          state.kind ===
            "today" ||
          state.kind ===
            "overdue"
        );
      }
    ).length;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* HEADER */}
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Техніка
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500 sm:text-base sm:leading-6">
            Облік обладнання, стану,
            ремонтів і сервісного
            обслуговування
          </p>
        </div>

        {canManage && (
          <div className="min-w-0">
            <EquipmentActions
              equipment={
                equipment
              }
              employees={
                employees
              }
              currency={
                settings.currency
              }
            />
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
                техніку, її стан та
                історію обслуговування.
                Додавати, редагувати та
                видаляти техніку може
                лише адміністратор.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs text-gray-500 sm:text-sm">
            Усього техніки
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            {equipment.length}
          </p>
        </div>

        <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-5">
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Справна та в роботі
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700 sm:text-3xl">
            {workingCount}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-xl border bg-white p-3 sm:p-5 ${
            repairCount > 0
              ? "border-orange-200"
              : ""
          }`}
        >
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Потребує ремонту
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              repairCount > 0
                ? "text-orange-600"
                : "text-gray-900"
            }`}
          >
            {repairCount}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-xl border bg-white p-3 sm:p-5 ${
            maintenanceAttentionCount > 0
              ? "border-red-200"
              : ""
          }`}
        >
          <p className="text-xs leading-4 text-gray-500 sm:text-sm">
            Техніка потребує ТО
          </p>

          <p
            className={`mt-2 text-2xl font-bold sm:text-3xl ${
              maintenanceAttentionCount > 0
                ? "text-red-600"
                : "text-gray-900"
            }`}
          >
            {maintenanceAttentionCount}
          </p>
        </div>
      </div>

      {/* EQUIPMENT LIST */}
      <div className="min-w-0">
        <EquipmentList
          equipment={
            equipment
          }
          employees={
            employees
          }
          canManage={
            canManage
          }
          today={today}
        />
      </div>

      {/* PLANNED MAINTENANCE */}
      <EquipmentMaintenancePanel
        equipment={equipment}
        currency={
          settings.currency
        }
        canManage={canManage}
        today={today}
      />

      {/* SERVICE HISTORY */}
      <div className="min-w-0">
        <EquipmentServiceHistory
          records={
            serviceRecords
          }
          currency={
            settings.currency
          }
          canManage={
            canManage
          }
        />
      </div>
    </div>
  );
}
