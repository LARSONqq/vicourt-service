import EquipmentActions from "@/components/equipment/EquipmentActions";
import EquipmentList from "@/components/equipment/EquipmentList";
import EquipmentServiceHistory from "@/components/equipment/EquipmentServiceHistory";

import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { canManageEquipment } from "@/lib/auth/permissions";

import { getEmployees } from "@/services/employeeService";

import {
  getEquipment,
  getEquipmentServiceRecords,
} from "@/services/equipmentService";

import { getAppSettings } from "@/services/settingsService";

function getDateAtStartOfDay(
  date: string
) {
  return new Date(
    `${date}T00:00:00`
  );
}

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
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const serviceLimit =
    new Date(today);

  serviceLimit.setDate(
    serviceLimit.getDate() +
      30
  );

  const serviceSoonCount =
    equipment.filter(
      (item) => {
        if (
          !item.next_service_date
        ) {
          return false;
        }

        const serviceDate =
          getDateAtStartOfDay(
            item.next_service_date
          );

        return (
          serviceDate <=
          serviceLimit
        );
      }
    ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Техніка
          </h1>

          <p className="mt-1 text-gray-500">
            Облік обладнання, стану,
            ремонтів і сервісного
            обслуговування
          </p>
        </div>

        {canManage && (
          <EquipmentActions
            equipment={equipment}
            employees={employees}
            currency={
              settings.currency
            }
          />
        )}
      </div>

      {!canManage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="font-medium text-blue-800">
            Режим перегляду
          </p>

          <p className="mt-1 text-sm text-blue-700">
            Ти можеш переглядати
            техніку, її стан та історію
            обслуговування. Додавати,
            редагувати та видаляти
            техніку може лише
            адміністратор.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Усього техніки
          </p>

          <p className="mt-2 text-3xl font-bold">
            {equipment.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">
            Справна та в роботі
          </p>

          <p className="mt-2 text-3xl font-bold text-green-700">
            {workingCount}
          </p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Потребує ремонту
          </p>

          <p className="mt-2 text-3xl font-bold text-orange-600">
            {repairCount}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Сервіс протягом 30 днів
          </p>

          <p className="mt-2 text-3xl font-bold text-red-600">
            {serviceSoonCount}
          </p>
        </div>
      </div>

      <EquipmentList
        equipment={equipment}
        employees={employees}
        canManage={canManage}
      />

      <EquipmentServiceHistory
        records={serviceRecords}
        currency={
          settings.currency
        }
        canManage={canManage}
      />
    </div>
  );
}