"use strict";

// PWA 1.0 intentionally has no fetch handler or Cache Storage usage.
// Authenticated ViCourt and Supabase responses must always come from the network.
self.addEventListener("install", () => {
  // Keep the standard update lifecycle; do not force an active session to reload.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function getInternalNotificationUrl(value) {
  const fallbackUrl = new URL(
    "/notifications",
    self.location.origin
  );

  if (typeof value !== "string") {
    return fallbackUrl.href;
  }

  try {
    const url = new URL(
      value,
      self.location.origin
    );

    if (
      url.origin !==
      self.location.origin
    ) {
      return fallbackUrl.href;
    }

    return url.href;
  } catch {
    return fallbackUrl.href;
  }
}

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      const parsedPayload =
        event.data.json();

      payload =
        parsedPayload &&
        typeof parsedPayload === "object"
          ? parsedPayload
          : {};
    } catch {
      payload = {
        body: event.data.text(),
      };
    }
  }

  const title =
    typeof payload.title === "string" &&
    payload.title.trim()
      ? payload.title
      : "ViCourt";
  const body =
    typeof payload.body === "string"
      ? payload.body
      : "У ViCourt є нове сповіщення.";
  const tag =
    typeof payload.tag === "string" &&
    payload.tag.trim()
      ? payload.tag
      : "vicourt-notification";
  const icon =
    typeof payload.icon === "string" &&
    payload.icon.startsWith("/") &&
    !payload.icon.startsWith("//")
      ? payload.icon
      : "/icons/vicourt-192.png";
  const url =
    getInternalNotificationUrl(
      payload.url
    );

  event.waitUntil(
    self.registration.showNotification(
      title,
      {
        body,
        icon,
        badge:
          "/icons/vicourt-192.png",
        tag,
        data: {
          url,
        },
      }
    )
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      getInternalNotificationUrl(
        event.notification.data?.url
      );

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(async (windowClients) => {
          const target =
            new URL(targetUrl);
          const exactClient =
            windowClients.find(
              (client) => {
                const clientUrl =
                  new URL(
                    client.url
                  );

                return (
                  clientUrl.origin ===
                    target.origin &&
                  clientUrl.pathname ===
                    target.pathname &&
                  clientUrl.search ===
                    target.search
                );
              }
            );

          if (exactClient) {
            return exactClient.focus();
          }

          const appClient =
            windowClients.find(
              (client) =>
                new URL(client.url)
                  .origin ===
                self.location.origin
            );

          if (appClient) {
            await appClient.navigate(
              targetUrl
            );

            return appClient.focus();
          }

          return self.clients.openWindow(
            targetUrl
          );
        })
    );
  }
);
