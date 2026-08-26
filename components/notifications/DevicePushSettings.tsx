"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  Bell,
  BellOff,
  Send,
} from "lucide-react";

import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/app/actions/pushSubscriptionActions";

import type {
  CurrentPushSubscription,
  PushSubscriptionInput,
} from "@/types/pushSubscription";

type Props = {
  vapidPublicKey: string;
};

type PushStatus =
  | "checking"
  | "unsupported"
  | "ios-install-required"
  | "inactive"
  | "subscribed"
  | "denied"
  | "missing-configuration"
  | "cleanup-required";

function isPushSupported() {
  return (
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(
      navigator.userAgent
    ) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  );
}

function isStandaloneMode() {
  const displayModeStandalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
  const iosStandalone =
    "standalone" in navigator &&
    navigator.standalone === true;

  return (
    displayModeStandalone ||
    iosStandalone
  );
}

function urlBase64ToUint8Array(
  value: string
) {
  const padding = "=".repeat(
    (4 - (value.length % 4)) % 4
  );
  const base64 = (
    value + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData =
    window.atob(base64);
  const buffer =
    new ArrayBuffer(
      rawData.length
    );
  const output =
    new Uint8Array(buffer);

  for (
    let index = 0;
    index < rawData.length;
    index += 1
  ) {
    output[index] =
      rawData.charCodeAt(index);
  }

  return output;
}

function serializeSubscription(
  subscription: PushSubscription
): PushSubscriptionInput {
  const json =
    subscription.toJSON();
  const p256dh =
    json.keys?.p256dh ?? "";
  const auth =
    json.keys?.auth ?? "";

  if (
    !json.endpoint ||
    !p256dh ||
    !auth
  ) {
    throw new Error(
      "Браузер не повернув повні дані push-підписки."
    );
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh,
      auth,
    },
    userAgent:
      navigator.userAgent || null,
  };
}

async function getServiceWorkerRegistration() {
  const existingRegistration =
    await navigator.serviceWorker.getRegistration(
      "/"
    );

  if (existingRegistration) {
    return existingRegistration;
  }

  await navigator.serviceWorker.register(
    "/sw.js",
    {
      scope: "/",
      updateViaCache: "none",
    }
  );

  return navigator.serviceWorker.ready;
}

export default function DevicePushSettings({
  vapidPublicKey,
}: Props) {
  const [
    status,
    setStatus,
  ] =
    useState<PushStatus>(
      "checking"
    );
  const [
    currentSubscription,
    setCurrentSubscription,
  ] =
    useState<CurrentPushSubscription | null>(
      null
    );
  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);
  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");
  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadPushState() {
      if (
        isIosDevice() &&
        !isStandaloneMode()
      ) {
        if (!isCancelled) {
          setStatus(
            "ios-install-required"
          );
        }

        return;
      }

      if (!isPushSupported()) {
        if (!isCancelled) {
          setStatus(
            "unsupported"
          );
        }

        return;
      }

      if (
        Notification.permission ===
        "denied"
      ) {
        if (!isCancelled) {
          setStatus("denied");
        }

        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.getRegistration(
            "/"
          );
        const browserSubscription =
          registration
            ? await registration.pushManager.getSubscription()
            : null;

        if (browserSubscription) {
          const result =
            await savePushSubscription(
              serializeSubscription(
                browserSubscription
              )
            );

          if (isCancelled) {
            return;
          }

          if (
            result.success &&
            result.subscription
          ) {
            setCurrentSubscription(
              result.subscription
            );
            setStatus(
              "subscribed"
            );

            return;
          }

          setErrorMessage(
            result.message
          );
        }

        if (!vapidPublicKey) {
          setStatus(
            "missing-configuration"
          );

          return;
        }

        setStatus("inactive");
      } catch {
        if (!isCancelled) {
          setStatus("inactive");
          setErrorMessage(
            "Не вдалося перевірити стан push-сповіщень."
          );
        }
      }
    }

    void loadPushState();

    return () => {
      isCancelled = true;
    };
  }, [vapidPublicKey]);

  async function handleEnable() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    let newlyCreatedSubscription:
      | PushSubscription
      | null = null;

    try {
      if (
        isIosDevice() &&
        !isStandaloneMode()
      ) {
        setStatus(
          "ios-install-required"
        );

        return;
      }

      if (!isPushSupported()) {
        setStatus("unsupported");

        return;
      }

      if (!vapidPublicKey) {
        setStatus(
          "missing-configuration"
        );

        return;
      }

      const permission =
        Notification.permission ===
        "default"
          ? await Notification.requestPermission()
          : Notification.permission;

      if (permission === "denied") {
        setStatus("denied");

        return;
      }

      if (permission !== "granted") {
        setErrorMessage(
          "Дозвіл на сповіщення не надано."
        );

        return;
      }

      const registration =
        await getServiceWorkerRegistration();
      let browserSubscription =
        await registration.pushManager.getSubscription();

      if (!browserSubscription) {
        browserSubscription =
          await registration.pushManager.subscribe(
            {
              userVisibleOnly: true,
              applicationServerKey:
                urlBase64ToUint8Array(
                  vapidPublicKey
                ),
            }
          );
        newlyCreatedSubscription =
          browserSubscription;
      }

      const result =
        await savePushSubscription(
          serializeSubscription(
            browserSubscription
          )
        );

      if (
        !result.success ||
        !result.subscription
      ) {
        if (
          newlyCreatedSubscription
        ) {
          await newlyCreatedSubscription.unsubscribe();
        }

        setErrorMessage(
          result.message
        );

        return;
      }

      setCurrentSubscription(
        result.subscription
      );
      setStatus("subscribed");
      setSuccessMessage(
        result.message
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося увімкнути push-сповіщення."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisable() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration(
              "/"
            )
          : undefined;
      const browserSubscription =
        registration
          ? await registration.pushManager.getSubscription()
          : null;
      const endpoint =
        browserSubscription?.endpoint ??
        currentSubscription?.endpoint ??
        "";

      if (browserSubscription) {
        await browserSubscription.unsubscribe();
      }

      if (!endpoint) {
        setCurrentSubscription(
          null
        );
        setStatus("inactive");
        setSuccessMessage(
          "Сповіщення на цьому пристрої вимкнено."
        );

        return;
      }

      const result =
        await removePushSubscription(
          endpoint
        );

      if (!result.success) {
        setStatus(
          "cleanup-required"
        );
        setErrorMessage(
          result.message
        );

        return;
      }

      setCurrentSubscription(
        null
      );
      setStatus("inactive");
      setSuccessMessage(
        result.message
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося вимкнути push-сповіщення."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTestPush() {
    if (
      isSubmitting ||
      !currentSubscription
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result =
        await sendTestPush(
          currentSubscription.id
        );

      if (!result.success) {
        if (
          result.subscriptionRemoved
        ) {
          const registration =
            await navigator.serviceWorker.getRegistration(
              "/"
            );
          const browserSubscription =
            registration
              ? await registration.pushManager.getSubscription()
              : null;

          await browserSubscription?.unsubscribe();
          setCurrentSubscription(
            null
          );
          setStatus("inactive");
        }

        setErrorMessage(
          result.message
        );

        return;
      }

      setSuccessMessage(
        result.message
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не вдалося надіслати тестове push-повідомлення."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const canEnable =
    status === "inactive";
  const canManageActive =
    status === "subscribed";
  const needsCleanup =
    status ===
    "cleanup-required";

  return (
    <section className="min-w-0 rounded-xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
          {canManageActive ? (
            <Bell
              aria-hidden="true"
              className="h-5 w-5"
            />
          ) : (
            <BellOff
              aria-hidden="true"
              className="h-5 w-5"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-900">
            Сповіщення на пристрої
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-600">
            {status === "checking" &&
              "Перевіряємо підтримку push-сповіщень…"}

            {status ===
              "unsupported" &&
              "Цей браузер не підтримує push-сповіщення."}

            {status ===
              "ios-install-required" &&
              "Щоб отримувати push-сповіщення на iPhone, додайте ViCourt на початковий екран і відкрийте його з іконки."}

            {status === "denied" &&
              "Сповіщення заблоковані в налаштуваннях браузера."}

            {status ===
              "missing-configuration" &&
              "Push-сповіщення ще не налаштовані адміністратором."}

            {canEnable &&
              "Отримуйте важливі повідомлення ViCourt на цьому пристрої."}

            {canManageActive &&
              "Сповіщення на цьому пристрої увімкнено."}

            {needsCleanup &&
              "Сповіщення вимкнено в браузері, але серверну підписку потрібно видалити повторно."}
          </p>

          {errorMessage && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700"
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              role="status"
              className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm leading-5 text-green-700"
            >
              {successMessage}
            </p>
          )}

          {(canEnable ||
            canManageActive ||
            needsCleanup) && (
            <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canEnable && (
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={isSubmitting}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
                >
                  <Bell
                    aria-hidden="true"
                    className="h-4 w-4"
                  />

                  {isSubmitting
                    ? "Увімкнення…"
                    : "Увімкнути сповіщення"}
                </button>
              )}

              {canManageActive && (
                <>
                  <button
                    type="button"
                    onClick={handleTestPush}
                    disabled={isSubmitting}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
                  >
                    <Send
                      aria-hidden="true"
                      className="h-4 w-4"
                    />

                    {isSubmitting
                      ? "Надсилання…"
                      : "Надіслати тест"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDisable}
                    disabled={isSubmitting}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
                  >
                    <BellOff
                      aria-hidden="true"
                      className="h-4 w-4"
                    />

                    Вимкнути
                  </button>
                </>
              )}

              {needsCleanup && (
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={isSubmitting}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
                >
                  {isSubmitting
                    ? "Очищення…"
                    : "Повторити вимкнення"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
