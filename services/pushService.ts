import "server-only";

import webPush from "web-push";

import type {
  PushPayload,
  PushSubscriptionRecord,
} from "@/types/pushSubscription";

type VapidConfiguration = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

export class PushConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushConfigurationError";
  }
}

export class PushDeliveryError extends Error {
  statusCode: number | null;

  constructor(
    message: string,
    statusCode: number | null
  ) {
    super(message);
    this.name = "PushDeliveryError";
    this.statusCode = statusCode;
  }
}

function getVapidConfiguration(): VapidConfiguration {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey =
    process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject =
    process.env.VAPID_SUBJECT?.trim() ?? "";

  if (!publicKey || !privateKey || !subject) {
    throw new PushConfigurationError(
      "Web Push ще не налаштовано на сервері. Додайте VAPID-змінні середовища."
    );
  }

  if (
    !subject.startsWith("mailto:") &&
    !subject.startsWith("https://")
  ) {
    throw new PushConfigurationError(
      "VAPID_SUBJECT повинен бути адресою mailto: або HTTPS URL."
    );
  }

  return {
    subject,
    publicKey,
    privateKey,
  };
}

export function assertPushConfiguration() {
  getVapidConfiguration();
}

function normalizeInternalUrl(value: string) {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/notifications";
  }

  return value;
}

export function isDeadPushSubscriptionError(
  error: unknown
) {
  return (
    error instanceof PushDeliveryError &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

export async function sendPushNotification(
  subscription: Pick<
    PushSubscriptionRecord,
    "endpoint" | "p256dh" | "auth"
  >,
  payload: PushPayload
) {
  const vapid = getVapidConfiguration();

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: normalizeInternalUrl(payload.url),
        tag: payload.tag,
        icon: payload.icon,
      }),
      {
        TTL: 60,
        urgency: "normal",
        topic: payload.tag,
        vapidDetails: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
      }
    );
  } catch (error) {
    if (error instanceof PushConfigurationError) {
      throw error;
    }

    const statusCode =
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;

    throw new PushDeliveryError(
      "Push provider не прийняв повідомлення.",
      statusCode
    );
  }
}
