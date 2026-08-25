import "server-only";

import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  ActivityEntityType,
  ActivityLog,
  ActivityLogFilters,
  ActivityLogPage,
  ActivityMetadata,
} from "@/types/activityLog";

const ACTIVITY_PAGE_SIZE =
  50;

type RecordActivityInput = {
  action: string;
  entityType: ActivityEntityType;
  entityId?:
    | string
    | number
    | null;
  entityName?: string | null;
  objectId?: number | null;
  objectName?: string | null;
  description: string;
  metadata?: ActivityMetadata;
};

function getActivityAdminClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Не налаштовано серверний ключ Supabase для журналу дій."
    );
  }

  return createAdminClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken:
          false,
        persistSession:
          false,
      },
    }
  );
}

async function resolveObjectName(
  objectId: number
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .select("name")
    .eq(
      "id",
      objectId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "[ActivityLog] Не вдалося отримати snapshot назви об’єкта.",
      {
        objectId,
        message:
          error.message,
      }
    );

    return null;
  }

  return data?.name || null;
}

export async function recordActivity(
  input: RecordActivityInput
) {
  try {
    const profile =
      await getCurrentUserProfile();

    if (!profile) {
      console.error(
        "[ActivityLog] Не вдалося визначити активного користувача.",
        {
          action:
            input.action,
          entityType:
            input.entityType,
          entityId:
            input.entityId ??
            null,
        }
      );

      return;
    }

    const actorName =
      profile.full_name
        ?.trim() ||
      profile.email
        ?.trim() ||
      "Користувач ViCourt";

    const normalizedObjectId =
      input.objectId &&
      Number.isInteger(
        input.objectId
      ) &&
      input.objectId > 0
        ? input.objectId
        : null;

    const objectName =
      input.objectName
        ?.trim() ||
      (
        normalizedObjectId
          ? await resolveObjectName(
              normalizedObjectId
            )
          : null
      );

    const adminClient =
      getActivityAdminClient();

    const {
      error,
    } = await adminClient
      .from("activity_logs")
      .insert({
        actor_id:
          profile.id,
        actor_name:
          actorName,
        action:
          input.action,
        entity_type:
          input.entityType,
        entity_id:
          input.entityId ===
            undefined ||
          input.entityId ===
            null
            ? null
            : String(
                input.entityId
              ),
        entity_name:
          input.entityName
            ?.trim() ||
          null,
        object_id:
          normalizedObjectId,
        object_name:
          objectName,
        description:
          input.description,
        metadata:
          input.metadata || {},
      });

    if (error) {
      console.error(
        "[ActivityLog] Не вдалося записати дію.",
        {
          action:
            input.action,
          entityType:
            input.entityType,
          entityId:
            input.entityId ??
            null,
          message:
            error.message,
          code:
            error.code,
        }
      );
    }
  } catch (error) {
    console.error(
      "[ActivityLog] Непередбачена помилка logger-а.",
      {
        action:
          input.action,
        entityType:
          input.entityType,
        entityId:
          input.entityId ??
          null,
        message:
          error instanceof Error
            ? error.message
            : "Невідома помилка",
      }
    );
  }
}

function normalizeText(
  value: string | undefined
) {
  return String(
    value ?? ""
  ).trim();
}

function getNextDate(
  date: string
) {
  const parsedDate =
    new Date(
      `${date}T00:00:00.000Z`
    );

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return null;
  }

  parsedDate.setUTCDate(
    parsedDate.getUTCDate() +
      1
  );

  return parsedDate
    .toISOString()
    .slice(0, 10);
}

export async function getActivityLogs(
  filters: ActivityLogFilters = {}
): Promise<ActivityLogPage> {
  const supabase =
    await createClient();

  const page =
    Number.isInteger(
      filters.page
    ) &&
    Number(filters.page) > 0
      ? Number(filters.page)
      : 1;

  const from =
    (page - 1) *
    ACTIVITY_PAGE_SIZE;

  const to =
    from +
    ACTIVITY_PAGE_SIZE -
    1;

  let query = supabase
    .from("activity_logs")
    .select("*", {
      count: "exact",
    })
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .range(
      from,
      to
    );

  const search =
    normalizeText(
      filters.search
    );

  const entityType =
    normalizeText(
      filters.entityType
    );

  const actorName =
    normalizeText(
      filters.actorName
    );

  const objectName =
    normalizeText(
      filters.objectName
    );

  const dateFrom =
    normalizeText(
      filters.dateFrom
    );

  const dateTo =
    normalizeText(
      filters.dateTo
    );

  if (search) {
    query = query.ilike(
      "description",
      `%${search}%`
    );
  }

  if (entityType) {
    query = query.eq(
      "entity_type",
      entityType
    );
  }

  if (actorName) {
    query = query.ilike(
      "actor_name",
      `%${actorName}%`
    );
  }

  if (objectName) {
    query = query.ilike(
      "object_name",
      `%${objectName}%`
    );
  }

  if (dateFrom) {
    query = query.gte(
      "created_at",
      `${dateFrom}T00:00:00.000Z`
    );
  }

  const nextDate =
    dateTo
      ? getNextDate(
          dateTo
        )
      : null;

  if (nextDate) {
    query = query.lt(
      "created_at",
      `${nextDate}T00:00:00.000Z`
    );
  }

  const {
    data,
    error,
    count,
  } = await query;

  if (error) {
    throw new Error(
      `Не вдалося завантажити журнал дій: ${error.message}`
    );
  }

  const logs =
    Array.isArray(data)
      ? (data as ActivityLog[])
      : [];

  const total =
    Number(count) || 0;

  return {
    logs,
    total,
    page,
    pageSize:
      ACTIVITY_PAGE_SIZE,
    hasPreviousPage:
      page > 1,
    hasNextPage:
      from + logs.length <
      total,
  };
}
