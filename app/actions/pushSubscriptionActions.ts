"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/services/profileService";
import {
  isDeadPushSubscriptionError,
  PushConfigurationError,
  PushDeliveryError,
  sendPushNotification,
} from "@/services/pushService";

import type {
  PushActionResult,
  PushSubscriptionInput,
  PushSubscriptionRecord,
} from "@/types/pushSubscription";

const MAX_ENDPOINT_LENGTH = 4096;
const MAX_KEY_LENGTH = 1024;
const MAX_USER_AGENT_LENGTH = 1024;
const TEST_PUSH_COOLDOWN_MS = 5_000;

async function requireAuthenticatedUser() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Для керування push-сповіщеннями потрібно увійти в систему."
    );
  }

  return profile;
}

function isValidEndpoint(endpoint: string) {
  if (
    !endpoint ||
    endpoint.length > MAX_ENDPOINT_LENGTH
  ) {
    return false;
  }

  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

function isValidSubscriptionKey(value: string) {
  return (
    value.length > 0 &&
    value.length <= MAX_KEY_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function validateSubscriptionInput(
  input: PushSubscriptionInput
) {
  if (!isValidEndpoint(input.endpoint)) {
    throw new Error(
      "Браузер повернув некоректну push-підписку."
    );
  }

  if (
    !isValidSubscriptionKey(input.keys.p256dh) ||
    !isValidSubscriptionKey(input.keys.auth)
  ) {
    throw new Error(
      "Браузер повернув некоректні ключі push-підписки."
    );
  }
}

function validateSubscriptionIdentity(
  subscriptionId: string
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      subscriptionId
    )
  ) {
    throw new Error(
      "Не вдалося визначити push-підписку цього пристрою."
    );
  }
}

export async function savePushSubscription(
  input: PushSubscriptionInput
): Promise<PushActionResult> {
  try {
    const profile =
      await requireAuthenticatedUser();

    validateSubscriptionInput(input);

    const supabase =
      await createClient();
    const now =
      new Date().toISOString();
    const userAgent =
      input.userAgent
        ?.trim()
        .slice(
          0,
          MAX_USER_AGENT_LENGTH
        ) || null;

    const { data, error } =
      await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: profile.id,
            endpoint: input.endpoint,
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
            user_agent: userAgent,
            updated_at: now,
          },
          {
            onConflict: "endpoint",
          }
        )
        .select("id, endpoint")
        .single();

    if (error || !data) {
      console.error(
        "Не вдалося зберегти push-підписку для поточного користувача.",
        error?.code ?? "unknown"
      );

      return {
        success: false,
        message:
          "Не вдалося зберегти сповіщення для цього пристрою.",
      };
    }

    return {
      success: true,
      message:
        "Сповіщення на цьому пристрої увімкнено.",
      subscription: {
        id: data.id,
        endpoint: data.endpoint,
      },
    };
  } catch (error) {
    console.error(
      "Помилка під час збереження push-підписки.",
      error instanceof Error
        ? error.message
        : "unknown"
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Не вдалося увімкнути push-сповіщення.",
    };
  }
}

export async function removePushSubscription(
  endpoint: string
): Promise<PushActionResult> {
  try {
    const profile =
      await requireAuthenticatedUser();

    if (!isValidEndpoint(endpoint)) {
      throw new Error(
        "Не вдалося визначити push-підписку цього пристрою."
      );
    }

    const supabase =
      await createClient();
    const { error } =
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", profile.id)
        .eq("endpoint", endpoint);

    if (error) {
      console.error(
        "Не вдалося видалити push-підписку поточного користувача.",
        error.code
      );

      return {
        success: false,
        message:
          "Браузер вимкнув сповіщення, але серверну підписку не вдалося видалити. Спробуйте ще раз.",
      };
    }

    return {
      success: true,
      message:
        "Сповіщення на цьому пристрої вимкнено.",
    };
  } catch (error) {
    console.error(
      "Помилка під час видалення push-підписки.",
      error instanceof Error
        ? error.message
        : "unknown"
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Не вдалося вимкнути push-сповіщення.",
    };
  }
}

export async function sendTestPush(
  subscriptionId: string
): Promise<PushActionResult> {
  try {
    const profile =
      await requireAuthenticatedUser();

    validateSubscriptionIdentity(
      subscriptionId
    );

    const supabase =
      await createClient();
    const { data, error } =
      await supabase
        .from("push_subscriptions")
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
        .eq("id", subscriptionId)
        .eq("user_id", profile.id)
        .maybeSingle();

    if (error) {
      console.error(
        "Не вдалося завантажити push-підписку для тесту.",
        error.code
      );

      return {
        success: false,
        message:
          "Не вдалося перевірити підписку цього пристрою.",
      };
    }

    if (!data) {
      return {
        success: false,
        message:
          "Підписку цього пристрою не знайдено. Увімкніть сповіщення ще раз.",
        subscriptionRemoved: true,
      };
    }

    const subscription =
      data as PushSubscriptionRecord;

    if (
      subscription.last_success_at &&
      Date.now() -
        new Date(
          subscription.last_success_at
        ).getTime() <
        TEST_PUSH_COOLDOWN_MS
    ) {
      return {
        success: false,
        message:
          "Зачекайте кілька секунд перед повторною перевіркою.",
      };
    }

    try {
      await sendPushNotification(
        subscription,
        {
          title: "ViCourt",
          body: "Push-сповіщення працюють 🎉",
          url: "/notifications",
          tag: "vicourt-test",
          icon: "/icons/vicourt-192.png",
        }
      );
    } catch (pushError) {
      if (
        isDeadPushSubscriptionError(
          pushError
        )
      ) {
        const { error: deleteError } =
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id)
            .eq("user_id", profile.id);

        if (deleteError) {
          console.error(
            "Push provider відхилив неактивну підписку, але її не вдалося видалити.",
            deleteError.code
          );
        }

        return {
          success: false,
          message:
            "Підписка цього пристрою більше не активна. Увімкніть сповіщення ще раз.",
          subscriptionRemoved: true,
        };
      }

      const now =
        new Date().toISOString();

      await supabase
        .from("push_subscriptions")
        .update({
          last_failure_at: now,
        })
        .eq("id", subscription.id)
        .eq("user_id", profile.id);

      if (
        pushError instanceof
        PushConfigurationError
      ) {
        return {
          success: false,
          message: pushError.message,
        };
      }

      console.error(
        "Не вдалося надіслати тестове push-повідомлення.",
        pushError instanceof PushDeliveryError
          ? `provider_status_${pushError.statusCode ?? "unknown"}`
          : pushError instanceof Error
          ? pushError.name
          : "unknown"
      );

      return {
        success: false,
        message:
          "Тестове повідомлення не надіслано. Спробуйте ще раз пізніше.",
      };
    }

    const now =
      new Date().toISOString();
    const { error: updateError } =
      await supabase
        .from("push_subscriptions")
        .update({
          last_success_at: now,
          last_failure_at: null,
        })
        .eq("id", subscription.id)
        .eq("user_id", profile.id);

    if (updateError) {
      console.error(
        "Push надіслано, але не вдалося оновити службовий timestamp.",
        updateError.code
      );
    }

    return {
      success: true,
      message:
        "Тестове push-повідомлення надіслано.",
    };
  } catch (error) {
    console.error(
      "Помилка тестової push-відправки.",
      error instanceof Error
        ? error.message
        : "unknown"
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Не вдалося надіслати тестове push-повідомлення.",
    };
  }
}
