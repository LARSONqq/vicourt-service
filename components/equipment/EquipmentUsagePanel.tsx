"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  configureEquipmentUsage,
  recordEquipmentUsage,
} from "@/app/actions/equipmentUsageActions";
import {
  evaluateEquipmentMaintenance,
  formatEquipmentUsage,
  getEquipmentMaintenanceOverallKind,
  getEquipmentMaintenanceOverallLabel,
  getEquipmentUsageMaintenanceLabel,
  getEquipmentUsageTypeLabel,
  getEquipmentUsageUnit,
} from "@/lib/equipmentMaintenance";
import { formatDateValue } from "@/lib/kyivDate";

import type {
  Equipment,
  EquipmentUsageType,
} from "@/types/equipment";
import type {
  EquipmentUsageEntryType,
  EquipmentUsageLog,
} from "@/types/equipmentUsage";

type Props = {
  equipment: Equipment[];
  logs: EquipmentUsageLog[];
  canManage: boolean;
  today: string;
};

function getOptionalNumber(
  formData: FormData,
  field: string
) {
  const raw = String(
    formData.get(field) ?? ""
  ).trim();

  if (!raw) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(
      "Вкажіть коректне числове значення."
    );
  }

  return value;
}

function getStatusClasses(
  kind: ReturnType<
    typeof getEquipmentMaintenanceOverallKind
  >
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

function formatDelta(
  value: number | null,
  usageType: "hours" | "km"
) {
  if (value === null) {
    return "Початковий";
  }

  const formatted = formatEquipmentUsage(
    Math.abs(value),
    usageType
  );

  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${formatted}`;
}

export default function EquipmentUsagePanel({
  equipment,
  logs,
  canManage,
  today,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] =
    useState<number | null>(
      equipment[0]?.id ?? null
    );
  const [usageType, setUsageType] =
    useState<EquipmentUsageType>(
      equipment[0]?.usage_type ?? "none"
    );
  const [isSavingSchedule, setIsSavingSchedule] =
    useState(false);
  const [isSavingReading, setIsSavingReading] =
    useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedEquipment =
    equipment.find(
      (item) => item.id === selectedId
    ) ?? null;
  const selectedLogs = useMemo(
    () =>
      selectedId === null
        ? []
        : logs.filter(
            (log) =>
              log.equipment_id === selectedId
          ),
    [logs, selectedId]
  );
  const evaluation = selectedEquipment
    ? evaluateEquipmentMaintenance(
        selectedEquipment,
        today
      )
    : null;

  function selectEquipment(
    value: string
  ) {
    const equipmentId = Number(value);
    const selected = equipment.find(
      (item) => item.id === equipmentId
    );

    setSelectedId(
      selected?.id ?? null
    );
    setUsageType(
      selected?.usage_type ?? "none"
    );
    setMessage("");
    setError("");
  }

  async function saveSchedule(
    formData: FormData
  ) {
    if (
      !selectedEquipment ||
      isSavingSchedule
    ) {
      return;
    }

    setIsSavingSchedule(true);
    setMessage("");
    setError("");

    try {
      await configureEquipmentUsage({
        equipmentId:
          selectedEquipment.id,
        usageType,
        maintenanceIntervalUsage:
          getOptionalNumber(
            formData,
            "maintenance_interval_usage"
          ),
        nextMaintenanceUsage:
          getOptionalNumber(
            formData,
            "next_maintenance_usage"
          ),
      });
      setMessage(
        "Налаштування напрацювання збережено."
      );
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося зберегти налаштування."
      );
    } finally {
      setIsSavingSchedule(false);
    }
  }

  async function saveReading(
    formData: FormData
  ) {
    if (
      !selectedEquipment ||
      isSavingReading
    ) {
      return;
    }

    setIsSavingReading(true);
    setMessage("");
    setError("");

    try {
      const reading = getOptionalNumber(
        formData,
        "reading"
      );

      if (reading === null) {
        throw new Error(
          "Вкажіть абсолютний показник."
        );
      }

      await recordEquipmentUsage({
        equipmentId:
          selectedEquipment.id,
        reading,
        readingDate: String(
          formData.get("reading_date") ?? ""
        ),
        entryType: String(
          formData.get("entry_type") ?? "reading"
        ) as EquipmentUsageEntryType,
        note:
          String(
            formData.get("note") ?? ""
          ).trim() || null,
      });
      setMessage(
        "Показник напрацювання додано."
      );
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не вдалося додати показник."
      );
    } finally {
      setIsSavingReading(false);
    }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Напрацювання техніки
            </h2>
            <p className="mt-1 text-sm leading-5 text-gray-500">
              Абсолютні показники мотогодин або пробігу та історія змін.
            </p>
          </div>

          {equipment.length > 0 && (
            <label className="min-w-0 text-sm font-medium text-gray-700 lg:w-80">
              Техніка
              <select
                value={selectedId ?? ""}
                onChange={(event) =>
                  selectEquipment(
                    event.target.value
                  )
                }
                className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 outline-none transition focus:border-green-600"
              >
                {equipment.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name} — {item.inventory_number || "без номера"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {!selectedEquipment || !evaluation ? (
        <div className="p-6 text-center text-sm text-gray-500">
          Спочатку додайте техніку.
        </div>
      ) : (
        <div className="min-w-0 space-y-5 p-3 sm:p-5">
          <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="min-w-0 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Тип обліку</p>
              <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                {getEquipmentUsageTypeLabel(
                  selectedEquipment.usage_type
                )}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Поточний показник</p>
              <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                {formatEquipmentUsage(
                  selectedEquipment.current_usage,
                  selectedEquipment.usage_type
                )}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Наступне ТО</p>
              <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                {formatEquipmentUsage(
                  selectedEquipment.next_maintenance_usage,
                  selectedEquipment.usage_type
                )}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Залишок до ТО</p>
              <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                {evaluation.usageRemaining !== null
                  ? formatEquipmentUsage(
                      evaluation.usageRemaining,
                      selectedEquipment.usage_type
                    )
                  : "Не розраховується"}
              </p>
            </div>
            <div className="col-span-2 min-w-0 rounded-lg bg-gray-50 p-3 lg:col-span-1">
              <p className="text-xs text-gray-500">Загальний стан ТО</p>
              <span
                className={`mt-1 inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                  getEquipmentMaintenanceOverallKind(
                    evaluation
                  )
                )}`}
              >
                {getEquipmentMaintenanceOverallLabel(
                  evaluation
                )}
              </span>
            </div>
          </div>

          <p className="break-words text-sm text-gray-600">
            {getEquipmentUsageMaintenanceLabel(
              selectedEquipment
            )}
          </p>

          {message && (
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {canManage && (
            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              <form
                key={`schedule-${selectedEquipment.id}`}
                action={saveSchedule}
                className="min-w-0 space-y-4 rounded-xl border bg-gray-50 p-4"
              >
                <h3 className="font-semibold text-gray-900">
                  Налаштування обліку
                </h3>
                <label className="block min-w-0 text-sm font-medium text-gray-700">
                  Тип обліку
                  <select
                    value={usageType}
                    onChange={(event) =>
                      setUsageType(
                        event.target.value as EquipmentUsageType
                      )
                    }
                    className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600"
                  >
                    <option value="none">Не використовується</option>
                    <option value="hours">Мотогодини</option>
                    <option value="km">Кілометри</option>
                  </select>
                </label>
                {usageType !== "none" && (
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="min-w-0 text-sm font-medium text-gray-700">
                      Інтервал ТО
                      <input
                        type="number"
                        name="maintenance_interval_usage"
                        min="0.001"
                        step="0.001"
                        defaultValue={selectedEquipment.maintenance_interval_usage ?? ""}
                        placeholder={usageType === "hours" ? "Наприклад: 250" : "Наприклад: 10000"}
                        className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600"
                      />
                    </label>
                    <label className="min-w-0 text-sm font-medium text-gray-700">
                      Наступний поріг ТО
                      <input
                        type="number"
                        name="next_maintenance_usage"
                        min="0"
                        step="0.001"
                        defaultValue={selectedEquipment.next_maintenance_usage ?? ""}
                        placeholder="Абсолютний показник"
                        className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600"
                      />
                    </label>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSavingSchedule}
                  className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 sm:w-fit"
                >
                  {isSavingSchedule ? "Збереження…" : "Зберегти налаштування"}
                </button>
              </form>

              <form
                key={`reading-${selectedEquipment.id}`}
                action={saveReading}
                className="min-w-0 space-y-4 rounded-xl border bg-gray-50 p-4"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Новий показник
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Вводьте абсолютне накопичене значення, не приріст.
                  </p>
                </div>
                {selectedEquipment.usage_type === "none" ? (
                  <p className="text-sm text-gray-600">
                    Спочатку увімкніть облік мотогодин або кілометрів.
                  </p>
                ) : (
                  <>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="min-w-0 text-sm font-medium text-gray-700">
                        Показник, {getEquipmentUsageUnit(selectedEquipment.usage_type)}
                        <input
                          type="number"
                          name="reading"
                          min="0"
                          step="0.001"
                          required
                          className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600"
                        />
                      </label>
                      <label className="min-w-0 text-sm font-medium text-gray-700">
                        Дата
                        <input
                          type="date"
                          name="reading_date"
                          defaultValue={today}
                          required
                          className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600"
                        />
                      </label>
                      <label className="min-w-0 text-sm font-medium text-gray-700">
                        Тип
                        <select
                          name="entry_type"
                          defaultValue="reading"
                          className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600"
                        >
                          <option value="reading">Показник</option>
                          <option value="correction">Корекція</option>
                        </select>
                      </label>
                    </div>
                    <label className="block min-w-0 text-sm font-medium text-gray-700">
                      Примітка
                      <textarea
                        name="note"
                        rows={2}
                        className="mt-2 w-full resize-none rounded-lg border bg-white px-3 py-2 outline-none focus:border-green-600"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSavingReading}
                      className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 sm:w-fit"
                    >
                      {isSavingReading ? "Збереження…" : "Додати показник"}
                    </button>
                  </>
                )}
              </form>
            </div>
          )}

          <div className="min-w-0 overflow-hidden rounded-xl border">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">
                Історія показників
              </h3>
            </div>
            {selectedLogs.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">
                Показників для цієї техніки ще немає.
              </p>
            ) : (
              <>
                <div className="space-y-3 p-3 md:hidden">
                  {selectedLogs.map((log) => (
                    <article key={log.id} className="min-w-0 rounded-lg border bg-white p-3">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {formatEquipmentUsage(log.reading, log.usage_type)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDateValue(log.reading_date) || log.reading_date} · {formatDelta(log.delta, log.usage_type)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                          {log.entry_type === "correction" ? "Корекція" : "Показник"}
                        </span>
                      </div>
                      <p className="mt-3 break-words text-sm text-gray-600">
                        {log.created_by_name || "Система"}
                        {log.note ? ` · ${log.note}` : ""}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-gray-50 text-left text-gray-500">
                      <tr>
                        <th className="p-3 font-medium">Дата</th>
                        <th className="p-3 font-medium">Показник</th>
                        <th className="p-3 font-medium">Зміна</th>
                        <th className="p-3 font-medium">Тип</th>
                        <th className="p-3 font-medium">Хто</th>
                        <th className="p-3 font-medium">Примітка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLogs.map((log) => (
                        <tr key={log.id} className="border-t align-top">
                          <td className="whitespace-nowrap p-3">{formatDateValue(log.reading_date) || log.reading_date}</td>
                          <td className="whitespace-nowrap p-3 font-semibold">{formatEquipmentUsage(log.reading, log.usage_type)}</td>
                          <td className="whitespace-nowrap p-3">{formatDelta(log.delta, log.usage_type)}</td>
                          <td className="p-3">{log.entry_type === "correction" ? "Корекція" : "Показник"}</td>
                          <td className="p-3">{log.created_by_name || "Система"}</td>
                          <td className="max-w-sm whitespace-pre-wrap break-words p-3 text-gray-600">{log.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
