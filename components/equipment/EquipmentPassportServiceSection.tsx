"use client";

import {
  useRouter,
} from "next/navigation";
import {
  useState,
} from "react";

import AddEquipmentServiceForm from "@/components/equipment/AddEquipmentServiceForm";
import EquipmentServiceHistory from "@/components/equipment/EquipmentServiceHistory";

import type {
  AppCurrency,
} from "@/types/appSettings";
import type {
  Equipment,
} from "@/types/equipment";
import type {
  EquipmentServiceRecordView,
} from "@/types/equipmentServiceRecord";

type Props = {
  equipment: Equipment;
  records: EquipmentServiceRecordView[];
  currency: AppCurrency;
  today: string;
  canManage: boolean;
  showCost: boolean;
  totalCost?: number;
};

export default function EquipmentPassportServiceSection({
  equipment,
  records,
  currency,
  today,
  canManage,
  showCost,
  totalCost,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] =
    useState(false);

  return (
    <section className="min-w-0 space-y-4">
      {canManage && (
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                Новий сервісний запис
              </h2>
              <p className="mt-1 text-sm leading-5 text-gray-500">
                Ремонт, діагностика, заміна запчастин або інше обслуговування.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setShowForm(
                  (current) =>
                    !current
                )
              }
              className={`min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium transition sm:w-auto ${
                showForm
                  ? "border bg-white text-gray-700 hover:bg-gray-50"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {showForm
                ? "Закрити форму"
                : "+ Додати запис"}
            </button>
          </div>

          {showForm && (
            <div className="mt-4 border-t pt-4">
              <AddEquipmentServiceForm
                equipment={[
                  equipment,
                ]}
                fixedEquipmentId={
                  equipment.id
                }
                currency={currency}
                today={today}
                onCreated={() => {
                  setShowForm(false);
                  router.refresh();
                }}
              />
            </div>
          )}
        </div>
      )}

      <EquipmentServiceHistory
        records={records}
        currency={currency}
        canManage={canManage}
        showCost={showCost}
        singleEquipment
        totalCostOverride={
          totalCost
        }
      />
    </section>
  );
}
