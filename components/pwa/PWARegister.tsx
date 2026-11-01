"use client";

import {
  useEffect,
} from "react";

const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem('vicourt-theme');
    const theme = stored === 'light' || stored === 'dark' ? stored : 'system';
    const resolved = theme === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = resolved;
  } catch {}
})();`;

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

  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
