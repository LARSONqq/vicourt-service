import "server-only";

import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";
import {
  activityEventNames,
  getActivityActionsForCategory,
  getActivityEventsMatchingLabel,
  isActivityCategory,
  isActivityEventName,
} from "@/constants/activityLog";
import {
  buildSafeOrIlikeFilter,
  getSafeSearchCandidateToken,
} from "@/lib/globalSearch";
import {
  addDaysToDateValue,
  getKyivDateStartUtc,
  isValidDateValue,
} from "@/lib/kyivDate";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

import type {
  ActivityEntityType,
  ActivityLog,
  ActivityFilterOptions,
  ActivityLogFilters,
  ActivityLogPage,
  ActivityLogCursor,
  ActivityMetadata,
  ObjectActivityLogPage,
} from "@/types/activityLog";

const ACTIVITY_PAGE_SIZE =
  50;
const OBJECT_ACTIVITY_PAGE_SIZE =
  25;
const ACTOR_OPTIONS_SCAN_LIMIT =
  500;
const ACTIVITY_SEARCH_MAX_LENGTH =
  100;
const ACTIVITY_SEARCH_COLUMNS = [
  "description",
  "entity_name",
  "actor_name",
  "object_name",
  "action",
] as const;

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
  )
    .normalize("NFKC")
    .trim();
}

function normalizeSearch(
  value: string | undefined
) {
  return Array.from(
    normalizeText(value).replace(
      /\s+/g,
      " "
    )
  )
    .slice(
      0,
      ACTIVITY_SEARCH_MAX_LENGTH
    )
    .join("");
}

function isValidActorId(
  value: string
) {
  return (
    value === "system" ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value
    )
  );
}

function normalizePositiveId(
  value: number | undefined
) {
  return Number.isInteger(value) &&
    Number(value) > 0
    ? Number(value)
    : null;
}

async function getExistingObjectIds(
  objectIds: number[]
) {
  const uniqueIds = Array.from(
    new Set(
      objectIds.filter(
        (id) =>
          Number.isInteger(id) &&
          id > 0
      )
    )
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const supabase =
    await createClient();
  const { data, error } =
    await supabase
      .from("objects")
      .select("id")
      .in("id", uniqueIds);

  if (error) {
    throw new Error(
      `Не вдалося перевірити посилання на об’єкти: ${error.message}`
    );
  }

  return Array.isArray(data)
    ? data.map((item) =>
        Number(item.id)
      )
    : [];
}

function applySearchFilter<
  TQuery extends {
    or: (
      filters: string
    ) => TQuery;
  },
>(query: TQuery, search: string) {
  if (!search) {
    return query;
  }

  const labelMatches =
    getActivityEventsMatchingLabel(
      search
    );
  const candidateToken =
    getSafeSearchCandidateToken(
      search
    );
  const conditions: string[] = [];

  if (candidateToken) {
    conditions.push(
      buildSafeOrIlikeFilter(
        ACTIVITY_SEARCH_COLUMNS,
        candidateToken
      )
    );
  }

  if (labelMatches.length > 0) {
    conditions.push(
      `action.in.(${labelMatches.join(",")})`
    );
  }

  return conditions.length > 0
    ? query.or(
        conditions.join(",")
      )
    : query;
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
    .order("id", {
      ascending: false,
    })
    .range(
      from,
      to
    );

  const search =
    normalizeSearch(
      filters.search
    );

  const category =
    normalizeText(
      filters.category
    );

  const action =
    normalizeText(
      filters.action
    );

  const actorId =
    normalizeText(
      filters.actorId
    );

  const actorName =
    normalizeText(
      filters.actorName
    );

  const objectId =
    normalizePositiveId(
      filters.objectId
    );

  const dateFrom =
    normalizeText(
      filters.dateFrom
    );

  const dateTo =
    normalizeText(
      filters.dateTo
    );

  query = applySearchFilter(
    query,
    search
  );

  if (
    category &&
    isActivityCategory(category)
  ) {
    if (category === "other") {
      query = query.not(
        "action",
        "in",
        `(${activityEventNames.join(",")})`
      );
    } else {
      const categoryActions =
        getActivityActionsForCategory(
          category
        );

      query =
        categoryActions.length > 0
          ? query.in(
              "action",
              categoryActions
            )
          : query.eq(
              "action",
              "activity.__no_match__"
            );
    }
  }

  if (
    action &&
    isActivityEventName(action)
  ) {
    query = query.eq(
      "action",
      action
    );
  }

  if (
    actorId &&
    isValidActorId(actorId)
  ) {
    query =
      actorId === "system"
        ? query.is(
            "actor_id",
            null
          )
        : query.eq(
            "actor_id",
            actorId
          );
  }

  if (actorName) {
    query = query.ilike(
      "actor_name",
      `%${actorName}%`
    );
  }

  if (objectId !== null) {
    query = query.eq(
      "object_id",
      objectId
    );
  }

  if (
    dateFrom &&
    isValidDateValue(dateFrom)
  ) {
    const dateFromUtc =
      getKyivDateStartUtc(
        dateFrom
      );

    if (dateFromUtc) {
      query = query.gte(
        "created_at",
        dateFromUtc
      );
    }
  }

  if (
    dateTo &&
    isValidDateValue(dateTo)
  ) {
    const dayAfter =
      addDaysToDateValue(
        dateTo,
        1
      );
    const dateToUtc =
      getKyivDateStartUtc(
        dayAfter
      );

    if (dateToUtc) {
      query = query.lt(
        "created_at",
        dateToUtc
      );
    }
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
  const existingObjectIds =
    await getExistingObjectIds(
      logs.flatMap((log) =>
        log.object_id === null
          ? []
          : [log.object_id]
      )
    );
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
    existingObjectIds,
  };
}

export async function getActivityFilterOptions(): Promise<ActivityFilterOptions> {
  const supabase =
    await createClient();
  const [
    actorResult,
    objectResult,
  ] = await Promise.all([
    supabase
      .from("activity_logs")
      .select(`
        actor_id,
        actor_name,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(
        ACTOR_OPTIONS_SCAN_LIMIT
      ),
    supabase
      .from("objects")
      .select("id, name")
      .order("name", {
        ascending: true,
      }),
  ]);

  if (actorResult.error) {
    throw new Error(
      `Не вдалося завантажити список авторів дій: ${actorResult.error.message}`
    );
  }

  if (objectResult.error) {
    throw new Error(
      `Не вдалося завантажити список об’єктів: ${objectResult.error.message}`
    );
  }

  const actorsById = new Map<
    string,
    string
  >();

  for (const row of actorResult.data || []) {
    const id =
      typeof row.actor_id === "string"
        ? row.actor_id
        : "system";
    const name =
      typeof row.actor_name === "string" &&
      row.actor_name.trim()
        ? row.actor_name.trim()
        : id === "system"
          ? "Система"
          : "Невідомий користувач";

    if (!actorsById.has(id)) {
      actorsById.set(id, name);
    }
  }

  return {
    actors: Array.from(
      actorsById,
      ([id, name]) => ({
        id,
        name,
      })
    ).sort((first, second) =>
      first.name.localeCompare(
        second.name,
        "uk"
      )
    ),
    objects: (objectResult.data || [])
      .map((object) => ({
        id: Number(object.id),
        name: String(object.name),
      }))
      .filter(
        (object) =>
          Number.isInteger(
            object.id
          ) &&
          object.id > 0
      ),
  };
}

function normalizeCursor(
  cursor:
    | ActivityLogCursor
    | null
) {
  if (
    !cursor ||
    !Number.isInteger(cursor.id) ||
    cursor.id <= 0 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      cursor.createdAt
    )
  ) {
    return null;
  }

  const date = new Date(
    cursor.createdAt
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return {
    createdAt:
      cursor.createdAt,
    id: cursor.id,
  };
}

export async function getObjectActivityLogs(
  objectId: number,
  cursor: ActivityLogCursor | null = null
): Promise<ObjectActivityLogPage> {
  const normalizedObjectId =
    normalizePositiveId(objectId);

  if (normalizedObjectId === null) {
    throw new Error(
      "Не вдалося визначити об’єкт."
    );
  }

  const supabase =
    await createClient();
  let query = supabase
    .from("activity_logs")
    .select("*")
    .eq(
      "object_id",
      normalizedObjectId
    )
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    })
    .limit(
      OBJECT_ACTIVITY_PAGE_SIZE +
        1
    );
  const normalizedCursor =
    normalizeCursor(cursor);

  if (normalizedCursor) {
    query = query.or(
      `created_at.lt.${normalizedCursor.createdAt},and(created_at.eq.${normalizedCursor.createdAt},id.lt.${normalizedCursor.id})`
    );
  }

  const { data, error } =
    await query;

  if (error) {
    throw new Error(
      `Не вдалося завантажити історію об’єкта: ${error.message}`
    );
  }

  const allLogs =
    Array.isArray(data)
      ? (data as ActivityLog[])
      : [];
  const hasMore =
    allLogs.length >
    OBJECT_ACTIVITY_PAGE_SIZE;
  const logs = allLogs.slice(
    0,
    OBJECT_ACTIVITY_PAGE_SIZE
  );
  const lastLog =
    logs.at(-1) || null;

  return {
    logs,
    nextCursor:
      hasMore && lastLog
        ? {
            createdAt:
              lastLog.created_at,
            id: lastLog.id,
          }
        : null,
  };
}
