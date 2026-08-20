import Link from "next/link";

import EmployeeWorkReport from "@/components/reports/EmployeeWorkReport";
import ObjectCostReport from "@/components/reports/ObjectCostReport";
import ReportExportButtons from "@/components/reports/ReportExportButtons";

import { requireSectionAccess } from "@/lib/auth/requireAccess";

import { getEmployees } from "@/services/employeeService";

import {
  getEquipment,
  getEquipmentServiceRecords,
} from "@/services/equipmentService";

import { getObjects } from "@/services/objectService";

import {
  getReportMaterials,
  getReportWorkLogs,
} from "@/services/reportService";

import { getAppSettings } from "@/services/settingsService";

import {
  getWarehouseItems,
  getWarehouseMovements,
} from "@/services/warehouseService";

import type { AppCurrency } from "@/types/appSettings";

function formatMoney(
  value: number,
  currency: AppCurrency
) {
  const symbols: Record<
    string,
    string
  > = {
    UAH: "₴",
    USD: "$",
    EUR: "€",
  };

  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const negative =
    safeValue < 0;

  const absoluteValue =
    Math.abs(safeValue);

  const [
    wholePart,
    decimalPart,
  ] = absoluteValue
    .toFixed(2)
    .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${
    negative ? "−" : ""
  }${formattedWhole},${decimalPart} ${
    symbols[currency] ||
    currency
  }`;
}

function formatDate(
  date: string
) {
  const datePart =
    date.slice(0, 10);

  const [
    year,
    month,
    day,
  ] = datePart.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return "Невідома дата";
  }

  return `${day}.${month}.${year}`;
}

export default async function ReportsPage() {
  await requireSectionAccess(
    "reports"
  );

  const [
    objects,
    warehouseItems,
    warehouseMovements,
    equipment,
    serviceRecords,
    employees,
    settings,
    reportWorkLogs,
    reportMaterials,
  ] = await Promise.all([
    getObjects(),
    getWarehouseItems(),
    getWarehouseMovements(),
    getEquipment(),
    getEquipmentServiceRecords(),
    getEmployees(),
    getAppSettings(),
    getReportWorkLogs(),
    getReportMaterials(),
  ]);

  const warehouseValue =
    warehouseItems.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.quantity
        ) *
          Number(
            item.purchase_price
          ),
      0
    );

  const lowStockCount =
    warehouseItems.filter(
      (item) =>
        Number(
          item.quantity
        ) <=
        Number(
          item.min_quantity
        )
    ).length;

  const equipmentRepairCount =
    equipment.filter(
      (item) =>
        item.status ===
          "Потребує ремонту" ||
        item.status ===
          "На ремонті"
    ).length;

  const totalServiceCost =
    serviceRecords.reduce(
      (
        sum,
        record
      ) =>
        sum +
        Number(
          record.cost
        ),
      0
    );

  const activeEmployeesCount =
    employees.filter(
      (employee) =>
        employee.status ===
        "Активний"
    ).length;

  const unavailableEmployeesCount =
    employees.filter(
      (employee) =>
        employee.status ===
          "У відпустці" ||
        employee.status ===
          "На лікарняному"
    ).length;

  const recentWarehouseMovements =
    warehouseMovements.slice(
      0,
      5
    );

  const recentServiceRecords =
    serviceRecords.slice(
      0,
      5
    );

  const objectReportExport =
    objects.map(
      (object) => {
        const objectWorkLogs =
          reportWorkLogs.filter(
            (log) =>
              Number(
                log.object_id
              ) ===
              Number(
                object.id
              )
          );

        const objectMaterials =
          reportMaterials.filter(
            (material) =>
              Number(
                material.object_id
              ) ===
              Number(
                object.id
              )
          );

        const totalHours =
          objectWorkLogs.reduce(
            (
              sum,
              log
            ) =>
              sum +
              Number(
                log.hours
              ),
            0
          );

        const totalMaterialCost =
          objectMaterials.reduce(
            (
              sum,
              material
            ) =>
              sum +
              Number(
                material.quantity
              ) *
                Number(
                  material.price
                ),
            0
          );

        return {
          object_id:
            object.id,

          object_name:
            object.name,

          total_hours:
            totalHours,

          material_positions:
            objectMaterials.length,

          material_cost:
            totalMaterialCost,
        };
      }
    );

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      {/* HEADER */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Звіти
        </h1>

        <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
          Загальне зведення роботи{" "}
          {settings.company_name}
        </p>
      </div>

      {/* EXPORT */}
      <div className="min-w-0">
        <ReportExportButtons
          datasets={[
            {
              title:
                "Об’єкти",

              filename:
                "vicourt-objects.csv",

              rows:
                objects,
            },

            {
              title:
                "Звіт по об’єктах",

              filename:
                "vicourt-object-report.csv",

              rows:
                objectReportExport,
            },

            {
              title:
                "Склад",

              filename:
                "vicourt-warehouse.csv",

              rows:
                warehouseItems,
            },

            {
              title:
                "Рухи складу",

              filename:
                "vicourt-warehouse-movements.csv",

              rows:
                warehouseMovements,
            },

            {
              title:
                "Техніка",

              filename:
                "vicourt-equipment.csv",

              rows:
                equipment,
            },

            {
              title:
                "Обслуговування техніки",

              filename:
                "vicourt-equipment-service.csv",

              rows:
                serviceRecords,
            },

            {
              title:
                "Працівники",

              filename:
                "vicourt-employees.csv",

              rows:
                employees,
            },
          ]}
        />
      </div>

      {/* GENERAL */}
      <section className="min-w-0">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 sm:mb-4 sm:text-xl">
          Загальні показники
        </h2>

        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Link
            href="/objects"
            className="min-w-0 rounded-xl border bg-white p-3 transition hover:border-green-300 hover:shadow-sm sm:p-5"
          >
            <p className="text-xs leading-4 text-gray-500 sm:text-sm">
              Об’єкти
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              {objects.length}
            </p>
          </Link>

          <Link
            href="/warehouse"
            className="min-w-0 rounded-xl border bg-white p-3 transition hover:border-green-300 hover:shadow-sm sm:p-5"
          >
            <p className="text-xs leading-4 text-gray-500 sm:text-sm">
              Позиції на складі
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              {
                warehouseItems.length
              }
            </p>
          </Link>

          <Link
            href="/equipment"
            className="min-w-0 rounded-xl border bg-white p-3 transition hover:border-green-300 hover:shadow-sm sm:p-5"
          >
            <p className="text-xs leading-4 text-gray-500 sm:text-sm">
              Одиниці техніки
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              {equipment.length}
            </p>
          </Link>

          <Link
            href="/employees"
            className="min-w-0 rounded-xl border bg-white p-3 transition hover:border-green-300 hover:shadow-sm sm:p-5"
          >
            <p className="text-xs leading-4 text-gray-500 sm:text-sm">
              Працівники
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              {
                employees.length
              }
            </p>
          </Link>
        </div>
      </section>

      {/* EMPLOYEE REPORT */}
      <div className="min-w-0">
        <EmployeeWorkReport
          employees={
            employees
          }
          workLogs={
            reportWorkLogs
          }
        />
      </div>

      {/* OBJECT COST REPORT */}
      <div className="min-w-0">
        <ObjectCostReport
          workLogs={
            reportWorkLogs
          }
          materials={
            reportMaterials
          }
          currency={
            settings.currency
          }
        />
      </div>

      {/* SUMMARY */}
      <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        {/* WAREHOUSE */}
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Склад
          </h2>

          <div className="mt-4 space-y-4 sm:mt-5">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b pb-4">
              <span className="min-w-0 text-sm text-gray-500 sm:text-base">
                Вартість залишків
              </span>

              <span className="max-w-[150px] break-words text-right text-sm font-semibold text-green-700 sm:max-w-none sm:text-base">
                {formatMoney(
                  warehouseValue,
                  settings.currency
                )}
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b pb-4">
              <span className="text-sm text-gray-500 sm:text-base">
                Низький залишок
              </span>

              <span
                className={`font-semibold ${
                  lowStockCount > 0
                    ? "text-red-600"
                    : "text-green-700"
                }`}
              >
                {lowStockCount}
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-sm text-gray-500 sm:text-base">
                Операцій зі складом
              </span>

              <span className="font-semibold text-gray-900">
                {
                  warehouseMovements.length
                }
              </span>
            </div>
          </div>
        </div>

        {/* EQUIPMENT */}
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Техніка
          </h2>

          <div className="mt-4 space-y-4 sm:mt-5">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b pb-4">
              <span className="text-sm text-gray-500 sm:text-base">
                Потребує ремонту
              </span>

              <span
                className={`font-semibold ${
                  equipmentRepairCount >
                  0
                    ? "text-orange-600"
                    : "text-green-700"
                }`}
              >
                {
                  equipmentRepairCount
                }
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b pb-4">
              <span className="text-sm text-gray-500 sm:text-base">
                Записів
                обслуговування
              </span>

              <span className="font-semibold text-gray-900">
                {
                  serviceRecords.length
                }
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="min-w-0 text-sm text-gray-500 sm:text-base">
                Витрати на
                обслуговування
              </span>

              <span className="max-w-[150px] break-words text-right text-sm font-semibold text-green-700 sm:max-w-none sm:text-base">
                {formatMoney(
                  totalServiceCost,
                  settings.currency
                )}
              </span>
            </div>
          </div>
        </div>

        {/* TEAM */}
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Команда
          </h2>

          <div className="mt-4 space-y-4 sm:mt-5">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b pb-4">
              <span className="text-sm text-gray-500 sm:text-base">
                Усього працівників
              </span>

              <span className="font-semibold text-gray-900">
                {
                  employees.length
                }
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b pb-4">
              <span className="text-sm text-gray-500 sm:text-base">
                Активні
              </span>

              <span className="font-semibold text-green-700">
                {
                  activeEmployeesCount
                }
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-sm text-gray-500 sm:text-base">
                Тимчасово відсутні
              </span>

              <span className="font-semibold text-orange-600">
                {
                  unavailableEmployeesCount
                }
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2">
        {/* WAREHOUSE MOVEMENTS */}
        <div className="min-w-0 overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Останні рухи складу
            </h2>
          </div>

          {recentWarehouseMovements.length ===
          0 ? (
            <div className="p-5 text-center sm:p-6">
              <p className="text-sm text-gray-500 sm:text-base">
                Операцій поки що
                немає.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentWarehouseMovements.map(
                (movement) => {
                  const isIncome =
                    movement.movement_type ===
                    "Прихід";

                  return (
                    <div
                      key={
                        movement.id
                      }
                      className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium text-gray-900">
                          {movement
                            .item
                            ?.name ||
                            "Позицію видалено"}
                        </p>

                        <p className="mt-1 break-words text-sm leading-5 text-gray-500">
                          {formatDate(
                            movement.created_at
                          )}

                          {movement.object
                            ? ` • ${movement.object.name}`
                            : ""}
                        </p>
                      </div>

                      <span
                        className={`w-fit shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                          isIncome
                            ? "bg-green-50 text-green-700"
                            : "bg-orange-50 text-orange-600"
                        }`}
                      >
                        {isIncome
                          ? "+"
                          : "−"}
                        {Number(
                          movement.quantity
                        )}{" "}
                        {movement
                          .item
                          ?.unit ||
                          ""}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* SERVICE RECORDS */}
        <div className="min-w-0 overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Останні обслуговування
            </h2>
          </div>

          {recentServiceRecords.length ===
          0 ? (
            <div className="p-5 text-center sm:p-6">
              <p className="text-sm text-gray-500 sm:text-base">
                Записів поки що
                немає.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentServiceRecords.map(
                (record) => (
                  <div
                    key={
                      record.id
                    }
                    className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-gray-900">
                        {record
                          .equipment
                          ?.name ||
                          "Техніку видалено"}
                      </p>

                      <p className="mt-1 break-words text-sm leading-5 text-gray-500">
                        {
                          record.service_type
                        }{" "}
                        •{" "}
                        {formatDate(
                          record.service_date
                        )}
                      </p>
                    </div>

                    <span className="w-fit shrink-0 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                      {formatMoney(
                        Number(
                          record.cost
                        ),
                        settings.currency
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}