import "server-only";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  MANUAL_TASK_SOURCE,
} from "@/constants/taskSource";
import {
  canAccessSection,
} from "@/lib/auth/permissions";
import {
  getKyivDateValue,
  getKyivTimeValue,
} from "@/lib/kyivDate";
import {
  PERIODIC_SUPERVISION_STATUS,
} from "@/lib/objectSupervision";
import {
  createServiceRoleClient,
} from "@/lib/supabase/admin";
import {
  buildNotificationItems,
  getAutomaticPushStateToken,
  isAutomaticPushNotification,
} from "@/services/notificationService";
import {
  assertPushConfiguration,
  isDeadPushSubscriptionError,
  PushConfigurationError,
  PushDeliveryError,
  sendPushNotification,
} from "@/services/pushService";
import {
  isAutomaticPushCategoryEnabled,
  isWithinQuietHours,
  resolvePushNotificationPreferences,
} from "@/services/pushNotificationPreferenceService";

import type {
  AutomaticPushNotificationType,
  NotificationItem,
} from "@/types/notification";
import type {
  ObjectItem,
} from "@/types/object";
import type {
  PushSubscriptionRecord,
} from "@/types/pushSubscription";
import type {
  PushNotificationPreferenceRow,
} from "@/types/pushNotificationPreference";
import type {
  TaskWithObject,
} from "@/types/taskWithObject";
import type {
  UserProfile,
  UserRole,
} from "@/types/userProfile";
import type {
  WarehouseItem,
} from "@/types/warehouseItem";
import type {
  WarehousePurchase,
} from "@/types/warehousePurchase";
import type {
  Equipment,
} from "@/types/equipment";

const COMPLETED_TASK_STATUS =
  "Виконано";
const DATABASE_PAGE_SIZE = 500;
const CLAIM_BATCH_SIZE = 250;
const WRITE_BATCH_SIZE = 500;
const DELIVERY_CONCURRENCY = 4;
const CLAIM_TIMEOUT_SECONDS = 1_800;
const EVALUATOR_LEASE_SECONDS = 1_800;

type PushRecipientProfile = Pick<
  UserProfile,
  | "id"
  | "role"
  | "employee_id"
  | "is_active"
>;

type AutomaticPushItem =
  NotificationItem & {
    type: AutomaticPushNotificationType;
  };

type RecipientCandidate = {
  userId: string;
  notification: AutomaticPushItem;
  stateToken: string;
  deliveryEligible: boolean;
};

type ClaimInput = {
  user_id: string;
  notification_key: string;
  notification_type: AutomaticPushNotificationType;
  state_token: string;
  delivery_eligible: boolean;
};

type PushClaim = {
  state_id: string;
  user_id: string;
  notification_key: string;
  state_token: string;
  claim_token: string;
};

type DeliveryResult = {
  subscriptionId: string;
  status:
    | "sent"
    | "failed"
    | "dead";
  providerStatusCode: number | null;
};

type ClaimDeliveryResult = {
  claim: PushClaim;
  deliveries: DeliveryResult[];
  sent: boolean;
};

type DeliveryAttemptInsert = {
  user_id: string;
  subscription_id: string;
  notification_key: string;
  state_token: string;
  status:
    | "sent"
    | "failed"
    | "dead";
  provider_status_code: number | null;
};

type PageResult<T> = {
  data: T[] | null;
  error: {
    message: string;
    code?: string;
  } | null;
};

export type AutomaticPushRunStats = {
  evaluatedUsers: number;
  candidates: number;
  claimed: number;
  sentUsers: number;
  deliveriesSucceeded: number;
  deliveriesFailed: number;
  deadSubscriptionsRemoved: number;
  skippedByPreference: number;
  skippedByQuietHours: number;
  usersWithoutSubscriptions: number;
  skippedConcurrentRun: boolean;
};

function createEmptyStats(): AutomaticPushRunStats {
  return {
    evaluatedUsers: 0,
    candidates: 0,
    claimed: 0,
    sentUsers: 0,
    deliveriesSucceeded: 0,
    deliveriesFailed: 0,
    deadSubscriptionsRemoved: 0,
    skippedByPreference: 0,
    skippedByQuietHours: 0,
    usersWithoutSubscriptions: 0,
    skippedConcurrentRun: false,
  };
}

function isUserRole(
  value: string
): value is UserRole {
  return (
    value === "admin" ||
    value === "object_manager" ||
    value === "worker"
  );
}

function chunkValues<T>(
  values: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

async function loadAllPages<T>(
  label: string,
  loadPage: (
    from: number,
    to: number
  ) => Promise<PageResult<T>>
) {
  const values: T[] = [];

  for (
    let from = 0;
    ;
    from += DATABASE_PAGE_SIZE
  ) {
    const {
      data,
      error,
    } = await loadPage(
      from,
      from +
        DATABASE_PAGE_SIZE -
        1
    );

    if (error) {
      throw new Error(
        `${label}: ${error.message}`
      );
    }

    const page =
      Array.isArray(data)
        ? data
        : [];

    values.push(...page);

    if (
      page.length <
      DATABASE_PAGE_SIZE
    ) {
      break;
    }
  }

  return values;
}

async function mapWithConcurrency<
  T,
  R
>(
  values: T[],
  concurrency: number,
  mapper: (
    value: T,
    index: number
  ) => Promise<R>
) {
  const results =
    new Array<R>(
      values.length
    );
  let nextIndex = 0;

  const workers =
    Array.from(
      {
        length: Math.min(
          concurrency,
          values.length
        ),
      },
      async () => {
        while (
          nextIndex <
          values.length
        ) {
          const currentIndex =
            nextIndex;
          nextIndex += 1;
          results[currentIndex] =
            await mapper(
              values[
                currentIndex
              ],
              currentIndex
            );
        }
      }
    );

  await Promise.all(workers);

  return results;
}

function getCandidateIdentity(
  userId: string,
  notificationKey: string,
  stateToken: string
) {
  return `${userId}\u0000${notificationKey}\u0000${stateToken}`;
}

function getPushTag(
  notificationKey: string,
  stateToken: string
) {
  const digest =
    createHash("sha256")
      .update(
        `${notificationKey}\u0000${stateToken}`
      )
      .digest("hex")
      .slice(0, 24);

  return `vicourt-${digest}`;
}

function canReceiveNotification(
  profile: PushRecipientProfile,
  notification: AutomaticPushItem,
  tasksById: Map<
    number,
    TaskWithObject
  >,
  objectsById: Map<
    number,
    ObjectItem
  >
) {
  if (
    profile.role === "admin"
  ) {
    return true;
  }

  if (
    profile.role ===
    "object_manager"
  ) {
    if (
      notification.type ===
      "overdue_task"
    ) {
      return canAccessSection(
        profile.role,
        "tasks"
      );
    }

    if (
      notification.type ===
        "supervision_today" ||
      notification.type ===
        "supervision_overdue"
    ) {
      return canAccessSection(
        profile.role,
        "objects"
      );
    }

    if (
      notification.type ===
        "equipment_maintenance_today" ||
      notification.type ===
        "equipment_maintenance_overdue"
    ) {
      return canAccessSection(
        profile.role,
        "equipment"
      );
    }

    return canAccessSection(
      profile.role,
      "warehouse"
    );
  }

  if (
    profile.role !== "worker" ||
    profile.employee_id === null
  ) {
    return false;
  }

  if (
    notification.type ===
    "overdue_task"
  ) {
    const task =
      notification.taskId
        ? tasksById.get(
            notification.taskId
          )
        : null;

    return (
      task?.assigned_employee_id ===
      profile.employee_id
    );
  }

  if (
    notification.type ===
      "supervision_today" ||
    notification.type ===
      "supervision_overdue"
  ) {
    const object =
      notification.objectId
        ? objectsById.get(
            notification.objectId
          )
        : null;

    return (
      object?.responsible_employee_id ===
      profile.employee_id
    );
  }

  // Low-stock automatic push у 2.0 отримують лише admin/object_manager.
  return false;
}

function isPushClaim(
  value: unknown
): value is PushClaim {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  return (
    "state_id" in value &&
    typeof value.state_id ===
      "string" &&
    "user_id" in value &&
    typeof value.user_id ===
      "string" &&
    "notification_key" in value &&
    typeof value.notification_key ===
      "string" &&
    "state_token" in value &&
    typeof value.state_token ===
      "string" &&
    "claim_token" in value &&
    typeof value.claim_token ===
      "string"
  );
}

async function updateSubscriptionHealth(
  supabase: ReturnType<
    typeof createServiceRoleClient
  >,
  results: DeliveryResult[],
  now: string
) {
  let removedSubscriptions = 0;
  const deadIds =
    new Set(
      results
        .filter(
          (result) =>
            result.status ===
            "dead"
        )
        .map(
          (result) =>
            result.subscriptionId
        )
    );
  const succeededIds =
    new Set(
      results
        .filter(
          (result) =>
            result.status ===
            "sent"
        )
        .map(
          (result) =>
            result.subscriptionId
        )
        .filter(
          (id) =>
            !deadIds.has(id)
        )
    );
  const failedIds =
    new Set(
      results
        .filter(
          (result) =>
            result.status ===
            "failed"
        )
        .map(
          (result) =>
            result.subscriptionId
        )
        .filter(
          (id) =>
            !deadIds.has(id) &&
            !succeededIds.has(id)
        )
    );

  for (const ids of chunkValues(
    Array.from(succeededIds),
    WRITE_BATCH_SIZE
  )) {
    const { error } =
      await supabase
        .from("push_subscriptions")
        .update({
          last_success_at: now,
          last_failure_at: null,
        })
        .in("id", ids);

    if (error) {
      console.error(
        "[AutomaticPush] Не вдалося оновити successful subscription timestamps.",
        error.code
      );
    }
  }

  for (const ids of chunkValues(
    Array.from(failedIds),
    WRITE_BATCH_SIZE
  )) {
    const { error } =
      await supabase
        .from("push_subscriptions")
        .update({
          last_failure_at: now,
        })
        .in("id", ids);

    if (error) {
      console.error(
        "[AutomaticPush] Не вдалося оновити failed subscription timestamps.",
        error.code
      );
    }
  }

  for (const ids of chunkValues(
    Array.from(deadIds),
    WRITE_BATCH_SIZE
  )) {
    const {
      data,
      error,
    } =
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", ids)
        .select("id");

    if (error) {
      console.error(
        "[AutomaticPush] Не вдалося видалити dead subscriptions.",
        error.code
      );
    } else {
      removedSubscriptions +=
        Array.isArray(data)
          ? data.length
          : 0;
    }
  }

  return removedSubscriptions;
}

async function writeDeliveryAttempts(
  supabase: ReturnType<
    typeof createServiceRoleClient
  >,
  attempts: DeliveryAttemptInsert[]
) {
  for (const rows of chunkValues(
    attempts,
    WRITE_BATCH_SIZE
  )) {
    const { error } =
      await supabase
        .from(
          "push_delivery_attempts"
        )
        .insert(rows);

    if (error) {
      // Push уже міг бути доставлений, тому history failure не змінює
      // user-facing delivery semantics і залишається server-side diagnostic.
      console.error(
        "[AutomaticPush] Не вдалося записати delivery history.",
        error.code
      );
    }
  }
}

async function completeSuccessfulClaims(
  supabase: ReturnType<
    typeof createServiceRoleClient
  >,
  claims: PushClaim[]
) {
  if (claims.length === 0) {
    return;
  }

  const payload =
    claims.map((claim) => ({
      state_id: claim.state_id,
      claim_token:
        claim.claim_token,
    }));

  let lastError:
    | {
        message: string;
      }
    | null = null;

  // Один короткий retry зменшує ризик повторної доставки після того,
  // як provider уже прийняв push, але Supabase тимчасово не відповів.
  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    const { error } =
      await supabase.rpc(
        "complete_push_notification_claims",
        {
          p_claims: payload,
        }
      );

    if (!error) {
      return;
    }

    lastError = error;
  }

  throw new Error(
    `Push provider прийняв повідомлення, але dedupe state не вдалося завершити: ${lastError?.message ?? "unknown"}`
  );
}

export async function runAutomaticPushDelivery(): Promise<AutomaticPushRunStats> {
  assertPushConfiguration();

  const supabase =
    createServiceRoleClient();
  const runId = randomUUID();
  const leaseToken =
    randomUUID();
  const stats =
    createEmptyStats();

  const {
    data: acquiredLease,
    error: leaseError,
  } = await supabase.rpc(
    "acquire_push_evaluator_lease",
    {
      p_lease_token:
        leaseToken,
      p_lease_seconds:
        EVALUATOR_LEASE_SECONDS,
    }
  );

  if (leaseError) {
    throw new Error(
      `Не вдалося отримати lock automatic push evaluator: ${leaseError.message}`
    );
  }

  if (acquiredLease !== true) {
    return {
      ...stats,
      skippedConcurrentRun:
        true,
    };
  }

  try {
    const today =
      getKyivDateValue();
    const kyivTime =
      getKyivTimeValue();

    const [
      subscriptions,
      rawProfiles,
      preferenceRows,
      tasks,
      objects,
      warehouseItems,
      purchases,
      equipment,
    ] = await Promise.all([
      loadAllPages<PushSubscriptionRecord>(
        "Не вдалося завантажити push subscriptions",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from(
                "push_subscriptions"
              )
              .select(`
                id,
                user_id,
                endpoint,
                p256dh,
                auth,
                user_agent,
                created_at,
                updated_at,
                last_success_at,
                last_failure_at
              `)
              .order("id")
              .range(from, to)
              .overrideTypes<
                PushSubscriptionRecord[]
              >();

          return {
            data,
            error,
          };
        }
      ),
      loadAllPages<PushRecipientProfile>(
        "Не вдалося завантажити active profiles",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from("profiles")
              .select(`
                id,
                role,
                employee_id,
                is_active
              `)
              .eq(
                "is_active",
                true
              )
              .order("id")
              .range(from, to)
              .overrideTypes<
                PushRecipientProfile[]
              >();

          return {
            data,
            error,
          };
        }
      ),
      loadAllPages<PushNotificationPreferenceRow>(
        "Не вдалося завантажити push preferences",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from(
                "push_notification_preferences"
              )
              .select(`
                user_id,
                overdue_tasks_enabled,
                supervision_enabled,
                low_stock_enabled,
                equipment_maintenance_enabled,
                quiet_hours_enabled,
                quiet_start,
                quiet_end,
                created_at,
                updated_at
              `)
              .order("user_id")
              .range(from, to)
              .overrideTypes<
                PushNotificationPreferenceRow[]
              >();

          return {
            data,
            error,
          };
        }
      ),
      loadAllPages<TaskWithObject>(
        "Не вдалося завантажити overdue manual tasks",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from("object_tasks")
              .select(`
                id,
                object_id,
                title,
                description,
                due_date,
                assignee,
                assigned_employee_id,
                priority,
                status,
                task_source,
                created_at,
                object:objects (
                  id,
                  name
                )
              `)
              .eq(
                "task_source",
                MANUAL_TASK_SOURCE
              )
              .neq(
                "status",
                COMPLETED_TASK_STATUS
              )
              .not(
                "due_date",
                "is",
                null
              )
              .lt(
                "due_date",
                today
              )
              .order("id")
              .range(from, to)
              .overrideTypes<
                TaskWithObject[]
              >();

          return {
            data,
            error,
          };
        }
      ),
      loadAllPages<ObjectItem>(
        "Не вдалося завантажити supervision objects",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from("objects")
              .select("*")
              .eq(
                "status",
                PERIODIC_SUPERVISION_STATUS
              )
              .not(
                "next_supervision_date",
                "is",
                null
              )
              .lte(
                "next_supervision_date",
                today
              )
              .order("id")
              .range(from, to)
              .overrideTypes<
                ObjectItem[]
              >();

          return {
            data,
            error,
          };
        }
      ),
      loadAllPages<WarehouseItem>(
        "Не вдалося завантажити warehouse items",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from("warehouse_items")
              .select("*")
              .order("id")
              .range(from, to)
              .overrideTypes<
                WarehouseItem[]
              >();

          return {
            data,
            error,
          };
        }
      ),
      loadAllPages<WarehousePurchase>(
        "Не вдалося завантажити активні заплановані закупівлі",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from(
                "warehouse_purchases"
              )
              .select(`
                id,
                item_id,
                quantity,
                purchase_price,
                supplier,
                note,
                status,
                created_at,
                purchased_at,
                item:warehouse_items (
                  id,
                  name,
                  unit,
                  quantity,
                  min_quantity
                )
              `)
              .eq(
                "status",
                "Заплановано"
              )
              .order("id")
              .range(from, to)
              .overrideTypes<
                WarehousePurchase[]
              >();

          return {
            data,
            error,
          };
        }
      ),
      loadAllPages<Equipment>(
        "Не вдалося завантажити техніку з актуальним плановим ТО",
        async (from, to) => {
          const { data, error } =
            await supabase
              .from("equipment")
              .select("*")
              .not(
                "maintenance_interval_days",
                "is",
                null
              )
              .not(
                "next_service_date",
                "is",
                null
              )
              .lte(
                "next_service_date",
                today
              )
              .order("id")
              .range(from, to)
              .overrideTypes<
                Equipment[]
              >();

          return {
            data,
            error,
          };
        }
      ),
    ]);

    const subscriptionsByUser =
      new Map<
        string,
        PushSubscriptionRecord[]
      >();

    for (const subscription of subscriptions) {
      const current =
        subscriptionsByUser.get(
          subscription.user_id
        ) || [];
      current.push(subscription);
      subscriptionsByUser.set(
        subscription.user_id,
        current
      );
    }

    const profiles =
      rawProfiles.filter(
        (profile) =>
          profile.is_active ===
            true &&
          isUserRole(
            profile.role
          )
      );

    stats.evaluatedUsers =
      profiles.length;

    const tasksById =
      new Map(
        tasks.map((task) => [
          task.id,
          task,
        ])
      );
    const objectsById =
      new Map(
        objects.map((object) => [
          object.id,
          object,
        ])
      );
    const preferencesByUser =
      new Map(
        preferenceRows.map(
          (row) => [
            row.user_id,
            row,
          ]
        )
      );
    const resolvedPreferencesByUser =
      new Map(
        profiles.map(
          (profile) => [
            profile.id,
            resolvePushNotificationPreferences(
              preferencesByUser.get(
                profile.id
              )
            ),
          ]
        )
      );
    const notificationItems =
      buildNotificationItems({
        today,
        currency: "UAH",
        tasks,
        objects,
        warehouseItems,
        purchases,
        equipment,
      }).filter(
        isAutomaticPushNotification
      );
    const candidatesByIdentity =
      new Map<
        string,
        RecipientCandidate
      >();
    const usersWithoutSubscriptions =
      new Set<string>();

    for (const notification of notificationItems) {
      const stateToken =
        getAutomaticPushStateToken(
          notification
        );

      if (!stateToken) {
        continue;
      }

      for (const profile of profiles) {
        if (
          !canReceiveNotification(
            profile,
            notification,
            tasksById,
            objectsById
          )
        ) {
          continue;
        }

        const identity =
          getCandidateIdentity(
            profile.id,
            notification.key,
            stateToken
          );
        const preferences =
          resolvedPreferencesByUser.get(
            profile.id
          );

        if (!preferences) {
          continue;
        }
        const categoryEnabled =
          isAutomaticPushCategoryEnabled(
            preferences,
            notification.type
          );
        const quietHoursActive =
          isWithinQuietHours(
            preferences,
            kyivTime
          );
        const hasSubscriptions =
          subscriptionsByUser.has(
            profile.id
          );

        // Notification occurrence лишається observed незалежно від delivery:
        // preferences, quiet hours і subscriptions не керують resolution state.

        if (!categoryEnabled) {
          stats.skippedByPreference +=
            1;
        } else if (
          quietHoursActive
        ) {
          stats.skippedByQuietHours +=
            1;
        }

        if (!hasSubscriptions) {
          usersWithoutSubscriptions.add(
            profile.id
          );
        }

        candidatesByIdentity.set(
          identity,
          {
            userId:
              profile.id,
            notification,
            stateToken,
            deliveryEligible:
              categoryEnabled &&
              !quietHoursActive &&
              hasSubscriptions,
          }
        );
      }
    }

    const candidates =
      Array.from(
        candidatesByIdentity.values()
      );
    stats.candidates =
      candidates.length;
    stats.usersWithoutSubscriptions =
      usersWithoutSubscriptions.size;

    const claims: PushClaim[] = [];

    for (const batch of chunkValues(
      candidates,
      CLAIM_BATCH_SIZE
    )) {
      const claimInputs: ClaimInput[] =
        batch.map(
          (candidate) => ({
            user_id:
              candidate.userId,
            notification_key:
              candidate.notification
                .key,
            notification_type:
              candidate.notification
                .type,
            state_token:
              candidate.stateToken,
            delivery_eligible:
              candidate.deliveryEligible,
          })
        );
      const {
        data,
        error,
      } = await supabase.rpc(
        "claim_push_notification_candidates",
        {
          p_run_id: runId,
          p_candidates:
            claimInputs,
          p_claim_timeout_seconds:
            CLAIM_TIMEOUT_SECONDS,
        }
      );

      if (error) {
        throw new Error(
          `Не вдалося claim-нути automatic push candidates: ${error.message}`
        );
      }

      if (!Array.isArray(data)) {
        throw new Error(
          "Automatic push claim RPC повернула некоректну відповідь."
        );
      }

      for (const row of data) {
        if (!isPushClaim(row)) {
          throw new Error(
            "Automatic push claim RPC повернула некоректний claim."
          );
        }

        claims.push(row);
      }
    }

    stats.claimed =
      claims.length;

    const deliveryResults =
      await mapWithConcurrency(
        claims,
        DELIVERY_CONCURRENCY,
        async (
          claim
        ): Promise<ClaimDeliveryResult> => {
          const candidate =
            candidatesByIdentity.get(
              getCandidateIdentity(
                claim.user_id,
                claim.notification_key,
                claim.state_token
              )
            );
          const userSubscriptions =
            subscriptionsByUser.get(
              claim.user_id
            ) || [];

          if (!candidate) {
            console.error(
              "[AutomaticPush] Claim не має відповідного in-memory candidate.",
              claim.state_id
            );

            return {
              claim,
              deliveries: [],
              sent: false,
            };
          }

          const deliveries =
            await mapWithConcurrency(
              userSubscriptions,
              DELIVERY_CONCURRENCY,
              async (
                subscription
              ): Promise<DeliveryResult> => {
                try {
                  await sendPushNotification(
                    subscription,
                    {
                      title:
                        candidate
                          .notification
                          .title,
                      body:
                        candidate
                          .notification
                          .message,
                      url:
                        candidate
                          .notification
                          .href,
                      tag: getPushTag(
                        candidate
                          .notification
                          .key,
                        candidate
                          .stateToken
                      ),
                      icon: "/icons/vicourt-192.png",
                    }
                  );

                  return {
                    subscriptionId:
                      subscription.id,
                    status: "sent",
                    providerStatusCode:
                      null,
                  };
                } catch (error) {
                  if (
                    error instanceof
                    PushConfigurationError
                  ) {
                    throw error;
                  }

                  const providerStatusCode =
                    error instanceof
                    PushDeliveryError
                      ? error.statusCode
                      : null;
                  const status =
                    isDeadPushSubscriptionError(
                      error
                    )
                      ? "dead"
                      : "failed";

                  console.error(
                    "[AutomaticPush] Push provider відхилив delivery.",
                    providerStatusCode ===
                      null
                      ? "provider_status_unknown"
                      : `provider_status_${providerStatusCode}`
                  );

                  return {
                    subscriptionId:
                      subscription.id,
                    status,
                    providerStatusCode,
                  };
                }
              }
            );

          return {
            claim,
            deliveries,
            sent: deliveries.some(
              (delivery) =>
                delivery.status ===
                "sent"
            ),
          };
        }
      );

    const successfulClaims =
      deliveryResults
        .filter(
          (result) =>
            result.sent
        )
        .map(
          (result) =>
            result.claim
        );

    await completeSuccessfulClaims(
      supabase,
      successfulClaims
    );

    const allDeliveries =
      deliveryResults.flatMap(
        (result) =>
          result.deliveries
      );
    const attempts =
      deliveryResults.flatMap(
        (result) =>
          result.deliveries.map(
            (
              delivery
            ): DeliveryAttemptInsert => ({
              user_id:
                result.claim
                  .user_id,
              subscription_id:
                delivery.subscriptionId,
              notification_key:
                result.claim
                  .notification_key,
              state_token:
                result.claim
                  .state_token,
              status:
                delivery.status,
              provider_status_code:
                delivery.providerStatusCode,
            })
          )
      );
    const now =
      new Date().toISOString();

    await writeDeliveryAttempts(
      supabase,
      attempts
    );
    const removedSubscriptions =
      await updateSubscriptionHealth(
      supabase,
      allDeliveries,
      now
      );

    const {
      error: resolveError,
    } = await supabase.rpc(
      "resolve_missing_push_notification_states",
      {
        p_run_id: runId,
      }
    );

    if (resolveError) {
      throw new Error(
        `Не вдалося resolve-нути відсутні notification states: ${resolveError.message}`
      );
    }

    stats.sentUsers =
      new Set(
        successfulClaims.map(
          (claim) =>
            claim.user_id
        )
      ).size;
    stats.deliveriesSucceeded =
      allDeliveries.filter(
        (delivery) =>
          delivery.status ===
          "sent"
      ).length;
    stats.deliveriesFailed =
      allDeliveries.filter(
        (delivery) =>
          delivery.status !==
          "sent"
      ).length;
    stats.deadSubscriptionsRemoved =
      removedSubscriptions;

    return stats;
  } finally {
    const { error } =
      await supabase.rpc(
        "release_push_evaluator_lease",
        {
          p_lease_token:
            leaseToken,
        }
      );

    if (error) {
      console.error(
        "[AutomaticPush] Не вдалося звільнити evaluator lease.",
        error.code
      );
    }
  }
}
