import "server-only";

import {
  cache,
} from "react";

import {
  equipmentServiceTypes,
} from "@/constants/equipmentService";
import {
  equipmentOperationalSelect,
} from "@/constants/equipment";
import {
  canManageEquipment,
  canViewReports,
} from "@/lib/auth/permissions";
import {
  evaluateEquipmentMaintenance,
} from "@/lib/equipmentMaintenance";
import {
  getKyivDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type { Equipment } from "@/types/equipment";
import type {
  EquipmentDirectoryFilters,
  EquipmentDirectoryPage,
  EquipmentDirectoryStats,
} from "@/types/equipmentProfile";
import type {
  CreateEquipmentServiceRecordInput,
  EquipmentServiceCreationResult,
  EquipmentServiceRecord,
  EquipmentServiceRecordOperational,
  EquipmentServiceRecordView,
  EquipmentServiceVoidResult,
  VoidEquipmentServiceRecordInput,
} from "@/types/equipmentServiceRecord";

const SERVICE_READ_PAGE_SIZE = 500;
export const EQUIPMENT_DIRECTORY_PAGE_SIZE =
  20;
const EQUIPMENT_DIRECTORY_STATS_PAGE_SIZE =
  500;

const EQUIPMENT_DIRECTORY_STATS_SELECT = `
  id,
  status,
  maintenance_interval_days,
  next_service_date,
  usage_type,
  current_usage,
  maintenance_interval_usage,
  next_maintenance_usage
`;

const SERVICE_OPERATIONAL_SELECT = `
  id,
  equipment_id,
  service_type,
  service_date,
  performed_by,
  description,
  next_service_date,
  usage_reading,
  usage_type_snapshot,
  usage_log_id,
  created_by_name,
  voided_at,
  void_reason,
  created_at,
  equipment:equipment (
    id,
    name,
    inventory_number
  )
`;

type ManagementServiceRpcRow = Omit<
  EquipmentServiceRecord,
  "equipment"
> & {
  equipment_name: string | null;
  equipment_inventory_number: string | null;
};

type ServiceReadOptions = {
  equipmentId?: number;
  includeVoided: boolean;
  from?: number;
  to?: number;
};

type ServiceReadResult = {
  records: EquipmentServiceRecordView[];
  total: number;
  includesCost: boolean;
};

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(
  value: unknown
): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableNumber(
  value: unknown
): value is number | null {
  return typeof value === "number" || value === null;
}

function isServiceCreationResult(
  value: unknown
): value is EquipmentServiceCreationResult {
  return (
    isRecord(value) &&
    typeof value.service_history_id === "number" &&
    typeof value.equipment_id === "number" &&
    typeof value.equipment_name === "string" &&
    equipmentServiceTypes.includes(
      value.service_type as (typeof equipmentServiceTypes)[number]
    ) &&
    typeof value.service_date === "string" &&
    typeof value.cost === "number" &&
    isNullableString(value.performed_by) &&
    isNullableString(value.description) &&
    isNullableString(value.next_service_date) &&
    (value.usage_type === "hours" ||
      value.usage_type === "km" ||
      value.usage_type === null) &&
    isNullableNumber(value.usage_reading) &&
    isNullableNumber(value.usage_log_id)
  );
}

function isServiceVoidResult(
  value: unknown
): value is EquipmentServiceVoidResult {
  return (
    isRecord(value) &&
    typeof value.service_history_id === "number" &&
    typeof value.equipment_id === "number" &&
    typeof value.equipment_name === "string" &&
    equipmentServiceTypes.includes(
      value.service_type as (typeof equipmentServiceTypes)[number]
    ) &&
    typeof value.service_date === "string" &&
    typeof value.cost === "number" &&
    typeof value.void_reason === "string"
  );
}

async function requireEquipmentServiceManagement() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error("Для виконання цієї дії потрібно увійти в систему.");
  }

  if (!canManageEquipment(profile.role)) {
    throw new Error(
      "Обслуговуванням техніки може керувати лише адміністратор."
    );
  }
}

async function loadEquipment(): Promise<Equipment[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("equipment")
    .select(
      equipmentOperationalSelect
    )
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити техніку: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as Equipment[];
}

export const getEquipment =
  cache(loadEquipment);

function normalizeDirectoryPage(
  page: number
) {
  return Number.isSafeInteger(page) &&
    page > 0
    ? page
    : 1;
}

function quotePostgrestValue(
  value: string
) {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')}"`;
}

export async function getEquipmentDirectoryPage(
  filters: EquipmentDirectoryFilters,
  page = 1
): Promise<EquipmentDirectoryPage> {
  const normalizedPage =
    normalizeDirectoryPage(page);
  const from =
    (normalizedPage - 1) *
    EQUIPMENT_DIRECTORY_PAGE_SIZE;
  const to =
    from +
    EQUIPMENT_DIRECTORY_PAGE_SIZE -
    1;
  const supabase =
    await createClient();
  let query = supabase
    .from("equipment")
    .select(
      equipmentOperationalSelect,
      { count: "exact" }
    );

  if (filters.search) {
    const pattern =
      quotePostgrestValue(
        `%${filters.search}%`
      );

    query = query.or(
      [
        "name",
        "inventory_number",
      ]
        .map(
          (column) =>
            `${column}.ilike.${pattern}`
        )
        .join(",")
    );
  }

  if (filters.status) {
    query = query.eq(
      "status",
      filters.status
    );
  }

  if (filters.category) {
    query = query.eq(
      "category",
      filters.category
    );
  }

  const {
    data,
    error,
    count,
  } = await query
    .order("name", {
      ascending: true,
    })
    .order("id", {
      ascending: true,
    })
    .range(from, to)
    .overrideTypes<
      Equipment[],
      { merge: false }
    >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити техніку: ${error.message}`
    );
  }

  const items = Array.isArray(data)
    ? data
    : [];
  const total = Number(count) || 0;

  return {
    items,
    total,
    page: normalizedPage,
    pageSize:
      EQUIPMENT_DIRECTORY_PAGE_SIZE,
    hasPreviousPage:
      normalizedPage > 1,
    hasNextPage:
      from + items.length < total,
  };
}

export async function getEquipmentDirectoryStats(
  today: string
): Promise<EquipmentDirectoryStats> {
  const supabase =
    await createClient();
  const rows: Array<
    Pick<
      Equipment,
      | "id"
      | "status"
      | "maintenance_interval_days"
      | "next_service_date"
      | "usage_type"
      | "current_usage"
      | "maintenance_interval_usage"
      | "next_maintenance_usage"
    >
  > = [];

  for (
    let from = 0;
    ;
    from +=
      EQUIPMENT_DIRECTORY_STATS_PAGE_SIZE
  ) {
    const { data, error } =
      await supabase
        .from("equipment")
        .select(
          EQUIPMENT_DIRECTORY_STATS_SELECT
        )
        .order("id", {
          ascending: true,
        })
        .range(
          from,
          from +
            EQUIPMENT_DIRECTORY_STATS_PAGE_SIZE -
            1
        )
        .overrideTypes<
          Array<
            Pick<
              Equipment,
              | "id"
              | "status"
              | "maintenance_interval_days"
              | "next_service_date"
              | "usage_type"
              | "current_usage"
              | "maintenance_interval_usage"
              | "next_maintenance_usage"
            >
          >,
          { merge: false }
        >();

    if (error) {
      throw new Error(
        `Не вдалося завантажити статистику техніки: ${error.message}`
      );
    }

    const pageRows =
      Array.isArray(data)
        ? data
        : [];

    rows.push(...pageRows);

    if (
      pageRows.length <
      EQUIPMENT_DIRECTORY_STATS_PAGE_SIZE
    ) {
      break;
    }
  }

  return rows.reduce<EquipmentDirectoryStats>(
    (stats, item) => ({
      total:
        stats.total + 1,
      working:
        stats.working +
        (item.status === "Справна" ||
        item.status === "В роботі"
          ? 1
          : 0),
      repair:
        stats.repair +
        (item.status ===
          "На ремонті" ||
        item.status ===
          "Потребує ремонту"
          ? 1
          : 0),
      maintenanceAttention:
        stats.maintenanceAttention +
        (evaluateEquipmentMaintenance(
          item,
          today
        ).isDue
          ? 1
          : 0),
    }),
    {
      total: 0,
      working: 0,
      repair: 0,
      maintenanceAttention: 0,
    }
  );
}

function normalizeEquipmentId(
  equipmentId: number
) {
  if (
    !Number.isInteger(equipmentId) ||
    equipmentId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити техніку."
    );
  }

  return equipmentId;
}

function mapManagementServiceRecord(
  row: ManagementServiceRpcRow
): EquipmentServiceRecord {
  const {
    equipment_name: equipmentName,
    equipment_inventory_number:
      inventoryNumber,
    ...record
  } = row;

  return {
    ...record,
    equipment:
      equipmentName
        ? {
            id: Number(
              row.equipment_id
            ),
            name:
              equipmentName,
            inventory_number:
              inventoryNumber,
          }
        : null,
  };
}

const canReadEquipmentServiceCost = cache(async () => {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для перегляду історії обслуговування потрібно увійти в систему."
    );
  }

  return canViewReports(
    profile.role
  );
});

async function loadManagementServiceRecords(
  options: ServiceReadOptions
): Promise<ServiceReadResult> {
  const supabase =
    await createClient();
  let query = supabase
    .rpc(
      "get_management_equipment_service_records",
      options.equipmentId
        ? {
            p_equipment_id:
              options.equipmentId,
          }
        : undefined,
      { count: "exact" }
    );

  if (!options.includeVoided) {
    query = query.is(
      "voided_at",
      null
    );
  }

  query = query
    .order("service_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    });

  if (
    options.from !== undefined &&
    options.to !== undefined
  ) {
    query = query.range(
      options.from,
      options.to
    );
  }

  const {
    data,
    error,
    count,
  } = await query.overrideTypes<
    ManagementServiceRpcRow[],
    { merge: false }
  >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити управлінську історію обслуговування: ${error.message}`
    );
  }

  const rows = Array.isArray(data)
    ? data
    : [];

  return {
    records: rows.map(
      mapManagementServiceRecord
    ),
    total:
      Number(count) || 0,
    includesCost: true,
  };
}

async function loadOperationalServiceRecords(
  options: ServiceReadOptions
): Promise<ServiceReadResult> {
  const supabase =
    await createClient();
  let query = supabase
    .from(
      "equipment_service_records"
    )
    .select(
      SERVICE_OPERATIONAL_SELECT,
      { count: "exact" }
    );

  if (options.equipmentId) {
    query = query.eq(
      "equipment_id",
      options.equipmentId
    );
  }

  if (!options.includeVoided) {
    query = query.is(
      "voided_at",
      null
    );
  }

  query = query
    .order("service_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    });

  if (
    options.from !== undefined &&
    options.to !== undefined
  ) {
    query = query.range(
      options.from,
      options.to
    );
  }

  const {
    data,
    error,
    count,
  } = await query.overrideTypes<
    EquipmentServiceRecordOperational[],
    { merge: false }
  >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію обслуговування: ${error.message}`
    );
  }

  return {
    records: Array.isArray(data)
      ? data
      : [],
    total:
      Number(count) || 0,
    includesCost: false,
  };
}

export async function getEquipmentServiceRecordsPage(
  options: ServiceReadOptions
): Promise<ServiceReadResult> {
  if (options.equipmentId) {
    normalizeEquipmentId(
      options.equipmentId
    );
  }

  return (await canReadEquipmentServiceCost())
    ? loadManagementServiceRecords(
        options
      )
    : loadOperationalServiceRecords(
        options
      );
}

async function loadAllManagementServiceRecords(
  includeVoided: boolean
) {
  const records: EquipmentServiceRecord[] = [];

  for (
    let from = 0;
    ;
    from += SERVICE_READ_PAGE_SIZE
  ) {
    const result =
      await loadManagementServiceRecords({
        includeVoided,
        from,
        to:
          from +
          SERVICE_READ_PAGE_SIZE -
          1,
      });

    records.push(
      ...(result.records as EquipmentServiceRecord[])
    );

    if (
      result.records.length <
      SERVICE_READ_PAGE_SIZE
    ) {
      break;
    }
  }

  return records;
}

export async function getManagementEquipmentServiceHistoryRecords(): Promise<
  EquipmentServiceRecord[]
> {
  if (
    !(await canReadEquipmentServiceCost())
  ) {
    throw new Error(
      "Недостатньо прав для перегляду вартості обслуговування техніки."
    );
  }

  return loadAllManagementServiceRecords(
    true
  );
}

export async function getManagementEquipmentServiceRecordsRange(
  from: number,
  to: number
): Promise<EquipmentServiceRecord[]> {
  if (
    !(await canReadEquipmentServiceCost())
  ) {
    throw new Error(
      "Недостатньо прав для перегляду вартості обслуговування техніки."
    );
  }

  const result =
    await loadManagementServiceRecords({
      includeVoided: true,
      from,
      to,
    });

  return result.records as EquipmentServiceRecord[];
}

export async function createEquipmentServiceRecordV2(
  input: CreateEquipmentServiceRecordInput
): Promise<EquipmentServiceCreationResult> {
  await requireEquipmentServiceManagement();

  if (!Number.isInteger(input.equipmentId) || input.equipmentId <= 0) {
    throw new Error("Не вдалося визначити техніку.");
  }

  if (!equipmentServiceTypes.includes(input.serviceType)) {
    throw new Error("Обери тип обслуговування.");
  }

  if (input.serviceType === "Планове обслуговування") {
    throw new Error(
      "Планове ТО потрібно завершувати через окрему дію «ТО виконано»."
    );
  }

  if (
    !isValidDateValue(input.serviceDate) ||
    input.serviceDate > getKyivDateValue()
  ) {
    throw new Error("Вкажи коректну дату обслуговування без майбутньої дати.");
  }

  if (!Number.isFinite(input.cost) || input.cost < 0) {
    throw new Error("Вартість обслуговування не може бути від’ємною.");
  }

  const nextServiceDate = input.nextServiceDate?.trim() || null;

  if (
    nextServiceDate &&
    (!isValidDateValue(nextServiceDate) ||
      nextServiceDate < input.serviceDate)
  ) {
    throw new Error(
      "Наступне обслуговування не може бути раніше за поточне."
    );
  }

  if (
    input.usageReading !== undefined &&
    input.usageReading !== null &&
    (!Number.isFinite(input.usageReading) || input.usageReading < 0)
  ) {
    throw new Error("Показник напрацювання має бути невід’ємним числом.");
  }

  const performedBy = input.performedBy?.trim() || null;
  const description = input.description?.trim() || null;

  if (performedBy && performedBy.length > 300) {
    throw new Error("Поле «Хто виконав» не може перевищувати 300 символів.");
  }

  if (description && description.length > 4000) {
    throw new Error("Опис робіт не може перевищувати 4000 символів.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_equipment_service_record_v2",
    {
      p_equipment_id: input.equipmentId,
      p_service_type: input.serviceType,
      p_service_date: input.serviceDate,
      p_cost: input.cost,
      p_performed_by: performedBy,
      p_description: description,
      p_next_service_date: nextServiceDate,
      p_usage_reading: input.usageReading ?? null,
    }
  );

  if (error) {
    throw new Error(`Не вдалося додати запис обслуговування: ${error.message}`);
  }

  if (!isServiceCreationResult(data)) {
    throw new Error(
      "Система отримала некоректний результат створення сервісного запису."
    );
  }

  return data;
}

export async function voidEquipmentServiceRecordV2(
  input: VoidEquipmentServiceRecordInput
): Promise<EquipmentServiceVoidResult> {
  await requireEquipmentServiceManagement();

  if (!Number.isInteger(input.serviceRecordId) || input.serviceRecordId <= 0) {
    throw new Error("Не вдалося визначити запис обслуговування.");
  }

  const reason = input.reason.trim();

  if (!reason || reason.length > 1000) {
    throw new Error("Вкажи причину анулювання до 1000 символів.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "void_equipment_service_record",
    {
      p_service_record_id: input.serviceRecordId,
      p_void_reason: reason,
    }
  );

  if (error) {
    throw new Error(`Не вдалося анулювати сервісний запис: ${error.message}`);
  }

  if (!isServiceVoidResult(data)) {
    throw new Error(
      "Система отримала некоректний результат анулювання сервісного запису."
    );
  }

  return data;
}
