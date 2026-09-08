"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useState,
} from "react";

import {
  deleteEquipment,
} from "@/app/actions/equipmentActions";
import {
  EditEquipmentForm,
} from "@/components/equipment/EditEquipmentForm";
import {
  formatEquipmentUsage,
} from "@/lib/equipmentMaintenance";
import {
  formatDateValue,
} from "@/lib/kyivDate";

import type {
  Employee,
} from "@/types/employee";
import type {
  Equipment,
} from "@/types/equipment";
import type {
  EquipmentMaintenanceOverallKind,
} from "@/lib/equipmentMaintenance";

type Props = {
  equipment: Equipment;
  employees: Employee[];
  canManage: boolean;
  maintenanceKind: EquipmentMaintenanceOverallKind;
  maintenanceLabel: string;
};

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "Справна":
      return "bg-green-50 text-green-700";
    case "В роботі":
      return "bg-blue-50 text-blue-700";
    case "Потребує ремонту":
      return "bg-red-50 text-red-700";
    case "На ремонті":
      return "bg-orange-50 text-orange-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getMaintenanceClasses(
  kind: EquipmentMaintenanceOverallKind
) {
  switch (kind) {
    case "overdue":
    case "due":
      return "bg-red-50 text-red-700";
    case "today":
      return "bg-orange-50 text-orange-700";
    case "scheduled":
      return "bg-green-50 text-green-700";
    case "unconfigured":
      return "bg-gray-100 text-gray-600";
  }
}

function Detail({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-gray-400">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-medium text-gray-800 ${
          breakAll
            ? "break-all"
            : "break-words"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function EquipmentPassportHeader({
  equipment,
  employees,
  canManage,
  maintenanceKind,
  maintenanceLabel,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] =
    useState(false);
  const [showDelete, setShowDelete] =
    useState(false);
  const [isDeleting, setIsDeleting] =
    useState(false);
  const [deleteError, setDeleteError] =
    useState("");
  const nextMaintenance = [
    equipment.next_service_date
      ? `Дата: ${
          formatDateValue(
            equipment.next_service_date
          ) || "Не вказано"
        }`
      : null,
    equipment.usage_type !== "none" &&
    equipment.next_maintenance_usage !== null
      ? `Поріг: ${formatEquipmentUsage(
          equipment.next_maintenance_usage,
          equipment.usage_type
        )}`
      : null,
  ].filter(Boolean).join(" · ");

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteEquipment(
        equipment.id
      );
      router.push("/equipment");
      router.refresh();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Не вдалося видалити техніку."
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <Link
        href="/equipment"
        className="inline-flex min-h-10 items-center text-sm font-medium text-green-700 hover:underline"
      >
        ← Назад до техніки
      </Link>

      <header className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
        <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-green-100 text-2xl sm:h-16 sm:w-16"
            >
              🛠️
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">
                  {equipment.name}
                </h1>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${getStatusClasses(
                    equipment.status
                  )}`}
                >
                  {equipment.status}
                </span>
              </div>

              <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
                {equipment.category ||
                  "Без категорії"}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap xl:justify-end">
              <button
                type="button"
                onClick={() =>
                  setIsEditing(
                    (current) =>
                      !current
                  )
                }
                className="min-h-11 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
              >
                {isEditing
                  ? "Закрити"
                  : "Редагувати"}
              </button>

              <details className="relative min-w-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                  Ще
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setShowDelete(true);
                    }}
                    className="min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Видалити техніку
                  </button>
                </div>
              </details>
            </div>
          )}
        </div>

        <dl className="mt-5 grid min-w-0 grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <Detail
            label="Інвентарний номер"
            value={
              equipment.inventory_number ||
              "Не вказано"
            }
            breakAll
          />
          <Detail
            label="Відповідальний"
            value={
              equipment.responsible ||
              "Не призначено"
            }
          />
          <Detail
            label="Локація"
            value={
              equipment.location ||
              "Не вказано"
            }
          />
          <div className="min-w-0">
            <dt className="text-xs font-medium text-gray-400">
              Планове ТО
            </dt>
            <dd className="mt-1">
              <span
                className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-medium ${getMaintenanceClasses(
                  maintenanceKind
                )}`}
              >
                <span className="truncate">
                  {maintenanceLabel}
                </span>
              </span>
              {nextMaintenance && (
                <p className="mt-1.5 break-words text-xs leading-5 text-gray-500">
                  {nextMaintenance}
                </p>
              )}
            </dd>
          </div>
        </dl>
      </header>

      {canManage && isEditing && (
        <section className="min-w-0 rounded-2xl border bg-white p-3 sm:p-5">
          <EditEquipmentForm
            equipment={equipment}
            employees={employees}
            onCancel={() => {
              setIsEditing(false);
              router.refresh();
            }}
          />
        </section>
      )}

      {canManage && showDelete && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-equipment-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <h2
              id="delete-equipment-title"
              className="text-lg font-semibold text-gray-900"
            >
              Видалити техніку?
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Техніку «{equipment.name}» буде видалено. Якщо запис використовується в пов’язаних завданнях або історії, база даних може заборонити цю дію.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {deleteError}
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setShowDelete(false)
                }
                className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting
                  ? "Видалення…"
                  : "Видалити"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
