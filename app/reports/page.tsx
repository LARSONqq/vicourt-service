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

  const [wholePart, decimalPart] =
    absoluteValue
      .toFixed(2)
      .split(".");

  const formattedWhole =
    wholePart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

  return `${negative ? "−" : ""}${formattedWhole},${decimalPart} ${
    symbols[currency] || currency
  }`;
}

function formatDate(
  date: string
) {
  const datePart =
    date.slice(0, 10);

  const [year, month, day] =
    datePart.split("-");

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
      (sum, item) =>
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
      (sum, record) =>
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
    objects.map((object) => {
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
          (sum, log) =>
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
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Звіти
        </h1>

        <p className="mt-1 text-gray-500">
          Загальне зведення роботи{" "}
          {settings.company_name}
        </p>
      </div>

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

      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Загальні показники
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/objects"
            className="rounded-xl border bg-white p-5 transition hover:border-green-300 hover:shadow-sm"
          >
            <p className="text-sm text-gray-500">
              Об’єкти
            </p>

            <p className="mt-2 text-3xl font-bold">
              {objects.length}
            </p>
          </Link>

          <Link
            href="/warehouse"
            className="rounded-xl border bg-white p-5 transition hover:border-green-300 hover:shadow-sm"
          >
            <p className="text-sm text-gray-500">
              Позиції на складі
            </p>

            <p className="mt-2 text-3xl font-bold">
              {
                warehouseItems.length
              }
            </p>
          </Link>

          <Link
            href="/equipment"
            className="rounded-xl border bg-white p-5 transition hover:border-green-300 hover:shadow-sm"
          >
            <p className="text-sm text-gray-500">
              Одиниці техніки
            </p>

            <p className="mt-2 text-3xl font-bold">
              {equipment.length}
            </p>
          </Link>

          <Link
            href="/employees"
            className="rounded-xl border bg-white p-5 transition hover:border-green-300 hover:shadow-sm"
          >
            <p className="text-sm text-gray-500">
              Працівники
            </p>

            <p className="mt-2 text-3xl font-bold">
              {
                employees.length
              }
            </p>
          </Link>
        </div>
      </section>

      <EmployeeWorkReport
        employees={
          employees
        }
        workLogs={
          reportWorkLogs
        }
      />

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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">
            Склад
          </h2>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-gray-500">
                Вартість залишків
              </span>

              <span className="font-semibold text-green-700">
                {formatMoney(
                  warehouseValue,
                  settings.currency
                )}
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-gray-500">
                Низький залишок
              </span>

              <span
                className={
                  lowStockCount >
                  0
                    ? "font-semibold text-red-600"
                    : "font-semibold text-green-700"
                }
              >
                {
                  lowStockCount
                }
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">
                Операцій зі складом
              </span>

              <span className="font-semibold">
                {
                  warehouseMovements.length
                }
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">
            Техніка
          </h2>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-gray-500">
                Потребує ремонту
              </span>

              <span
                className={
                  equipmentRepairCount >
                  0
                    ? "font-semibold text-orange-600"
                    : "font-semibold text-green-700"
                }
              >
                {
                  equipmentRepairCount
                }
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-gray-500">
                Записів обслуговування
              </span>

              <span className="font-semibold">
                {
                  serviceRecords.length
                }
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">
                Витрати на
                обслуговування
              </span>

              <span className="font-semibold text-green-700">
                {formatMoney(
                  totalServiceCost,
                  settings.currency
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">
            Команда
          </h2>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-gray-500">
                Усього працівників
              </span>

              <span className="font-semibold">
                {
                  employees.length
                }
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-gray-500">
                Активні
              </span>

              <span className="font-semibold text-green-700">
                {
                  activeEmployeesCount
                }
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-5">
            <h2 className="text-xl font-semibold">
              Останні рухи складу
            </h2>
          </div>

          {recentWarehouseMovements.length ===
          0 ? (
            <p className="p-6 text-gray-500">
              Операцій поки що немає.
            </p>
          ) : (
            <div className="divide-y">
              {recentWarehouseMovements.map(
                (
                  movement
                ) => {
                  const isIncome =
                    movement.movement_type ===
                    "Прихід";

                  return (
                    <div
                      key={
                        movement.id
                      }
                      className="flex items-center justify-between gap-4 p-5"
                    >
                      <div>
                        <p className="font-medium">
                          {movement
                            .item
                            ?.name ||
                            "Позицію видалено"}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {formatDate(
                            movement.created_at
                          )}

                          {movement.object
                            ? ` • ${movement.object.name}`
                            : ""}
                        </p>
                      </div>

                      <span
                        className={
                          isIncome
                            ? "font-semibold text-green-700"
                            : "font-semibold text-orange-600"
                        }
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

        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-5">
            <h2 className="text-xl font-semibold">
              Останні
              обслуговування
            </h2>
          </div>

          {recentServiceRecords.length ===
          0 ? (
            <p className="p-6 text-gray-500">
              Записів поки що немає.
            </p>
          ) : (
            <div className="divide-y">
              {recentServiceRecords.map(
                (record) => (
                  <div
                    key={
                      record.id
                    }
                    className="flex items-center justify-between gap-4 p-5"
                  >
                    <div>
                      <p className="font-medium">
                        {record
                          .equipment
                          ?.name ||
                          "Техніку видалено"}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {
                          record.service_type
                        }{" "}
                        •{" "}
                        {formatDate(
                          record.service_date
                        )}
                      </p>
                    </div>

                    <span className="font-semibold">
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