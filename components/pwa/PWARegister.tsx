"use client";

import {
  useEffect,
} from "react";

export default function PWARegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !==
        "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    function registerServiceWorker() {
      void navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .catch(() => undefined);
    }

    if (
      document.readyState ===
      "complete"
    ) {
      registerServiceWorker();

      return;
    }

    window.addEventListener(
      "load",
      registerServiceWorker,
      {
        once: true,
      }
    );

    return () => {
      window.removeEventListener(
        "load",
        registerServiceWorker
      );
    };
  }, []);

  return null;
}
