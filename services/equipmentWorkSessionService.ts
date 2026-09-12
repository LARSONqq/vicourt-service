import "server-only";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  EquipmentWorkSessionListItem,
  EquipmentWorkSessionPage,
} from "@/types/equipmentUsage";

export const EQUIPMENT_WORK_SESSION_PAGE_SIZE =
  20;

const WORK_SESSION_LIST_SELECT = `
  id,
  equipment_id,
  equipment_name_snapshot,
  reading_date,
  delta,
  object_id,
  object_name_snapshot,
  employee_id,
  employee_name_snapshot,
  note
`;

function normalizeObjectId(
  objectId: number
) {
  if (
    !Number.isInteger(objectId) ||
    objectId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити об’єкт."
    );
  }

  return objectId;
}

function normalizeEmployeeId(
  employeeId: number
) {
  if (
    !Number.isInteger(employeeId) ||
    employeeId <= 0
  ) {
    throw new Error(
      "Не вдалося визначити працівника."
    );
  }

  return employeeId;
}

function normalizePage(
  requestedPage: number,
  total: number
) {
  const normalizedPage =
    Number.isInteger(requestedPage) &&
    requestedPage > 0
      ? requestedPage
      : 1;
  const lastPage = Math.max(
    1,
    Math.ceil(
      total /
        EQUIPMENT_WORK_SESSION_PAGE_SIZE
    )
  );

  return Math.min(
    normalizedPage,
    lastPage
  );
}

async function getEquipmentWorkSessionsPage(
  scopeColumn:
    | "object_id"
    | "employee_id",
  scopeId: number,
  requestedPage = 1
): Promise<EquipmentWorkSessionPage> {
  const supabase =
    await createClient();
  const { count, error: countError } =
    await supabase
      .from("equipment_usage_logs")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "entry_type",
        "work_session"
      )
      .eq(
        scopeColumn,
        scopeId
      );

  if (countError) {
    throw new Error(
      `Не вдалося завантажити кількість записів роботи техніки: ${countError.message}`
    );
  }

  const total = Number(count) || 0;
  const page = normalizePage(
    requestedPage,
    total
  );
  const from =
    (page - 1) *
    EQUIPMENT_WORK_SESSION_PAGE_SIZE;
  const { data, error } =
    await supabase
      .from("equipment_usage_logs")
      .select(
        WORK_SESSION_LIST_SELECT
      )
      .eq(
        "entry_type",
        "work_session"
      )
      .eq(
        scopeColumn,
        scopeId
      )
      .order("reading_date", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(
        from,
        from +
          EQUIPMENT_WORK_SESSION_PAGE_SIZE -
          1
      )
      .overrideTypes<
        EquipmentWorkSessionListItem[],
        { merge: false }
      >();

  if (error) {
    throw new Error(
      `Не вдалося завантажити записи роботи техніки: ${error.message}`
    );
  }

  return {
    items: data || [],
    total,
    page,
    pageSize:
      EQUIPMENT_WORK_SESSION_PAGE_SIZE,
    hasPreviousPage: page > 1,
    hasNextPage:
      page *
        EQUIPMENT_WORK_SESSION_PAGE_SIZE <
      total,
  };
}

export async function getObjectEquipmentWorkSessionsPage(
  objectId: number,
  requestedPage = 1
) {
  return getEquipmentWorkSessionsPage(
    "object_id",
    normalizeObjectId(objectId),
    requestedPage
  );
}

export async function getEmployeeEquipmentWorkSessionsPage(
  employeeId: number,
  requestedPage = 1
) {
  return getEquipmentWorkSessionsPage(
    "employee_id",
    normalizeEmployeeId(employeeId),
    requestedPage
  );
}
