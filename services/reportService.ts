import { createClient } from "@/lib/supabase/server";

import type { WorkLog } from "@/types/workLog";

export type ReportWorkLog = WorkLog & {
  object: {
    id: number;
    name: string;
  } | null;
};

export type ReportMaterial = {
  id: number;
  object_id: number;
  warehouse_item_id: number | null;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  created_at: string;

  object: {
    id: number;
    name: string;
  } | null;
};

export type ObjectReportSummary = {
  objectId: number;
  objectName: string;
  totalHours: number;
  materialItemsCount: number;
  totalMaterialCost: number;
};

export async function getReportWorkLogs(): Promise<
  ReportWorkLog[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("work_logs")
    .select(`
      id,
      object_id,
      employee_id,
      work_date,
      description,
      workers,
      hours,
      created_at,
      object:objects (
        id,
        name
      )
    `)
    .order("work_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити звіт по працівниках: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as unknown as ReportWorkLog[];
}

export async function getReportMaterials(): Promise<
  ReportMaterial[]
> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("materials")
    .select(`
      id,
      object_id,
      warehouse_item_id,
      name,
      quantity,
      unit,
      price,
      created_at,
      object:objects (
        id,
        name
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Не вдалося завантажити звіт по матеріалах: ${error.message}`
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ) as unknown as ReportMaterial[];
}

export async function getObjectReportSummaries(): Promise<
  ObjectReportSummary[]
> {
  const [
    workLogs,
    materials,
  ] = await Promise.all([
    getReportWorkLogs(),
    getReportMaterials(),
  ]);

  const summaries = new Map<
    number,
    ObjectReportSummary
  >();

  for (const workLog of workLogs) {
    const objectId =
      Number(
        workLog.object_id
      );

    if (
      !Number.isInteger(
        objectId
      ) ||
      objectId <= 0
    ) {
      continue;
    }

    const current =
      summaries.get(
        objectId
      ) ?? {
        objectId,
        objectName:
          workLog.object?.name ||
          `Об’єкт #${objectId}`,
        totalHours: 0,
        materialItemsCount: 0,
        totalMaterialCost: 0,
      };

    current.totalHours +=
      Number(
        workLog.hours
      ) || 0;

    summaries.set(
      objectId,
      current
    );
  }

  for (
    const material of materials
  ) {
    const objectId =
      Number(
        material.object_id
      );

    if (
      !Number.isInteger(
        objectId
      ) ||
      objectId <= 0
    ) {
      continue;
    }

    const current =
      summaries.get(
        objectId
      ) ?? {
        objectId,
        objectName:
          material.object?.name ||
          `Об’єкт #${objectId}`,
        totalHours: 0,
        materialItemsCount: 0,
        totalMaterialCost: 0,
      };

    const quantity =
      Number(
        material.quantity
      ) || 0;

    const price =
      Number(
        material.price
      ) || 0;

    current.materialItemsCount +=
      1;

    current.totalMaterialCost +=
      quantity * price;

    summaries.set(
      objectId,
      current
    );
  }

  return Array.from(
    summaries.values()
  ).sort(
    (
      first,
      second
    ) =>
      first.objectName.localeCompare(
        second.objectName,
        "uk"
      )
  );
}