"use strict";

// PWA 1.0 intentionally has no fetch handler or Cache Storage usage.
// Authenticated ViCourt and Supabase responses must always come from the network.
self.addEventListener("install", () => {
  // Keep the standard update lifecycle; do not force an active session to reload.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Future Web Push handlers can be added here without changing the current
// installation lifecycle or introducing offline caching.
