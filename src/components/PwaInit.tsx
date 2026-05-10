"use client";

import { useEffect } from "react";

/** Registers the service worker and the Firebase messaging SW. No UI. */
export function PwaInit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register the main app SW (cache-first for static assets).
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => { /* ignore in dev or when blocked */ });

    // Register Firebase Messaging SW so background push works.
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js", { scope: "/" })
      .catch(() => { /* ignore — FCM SW registration is best-effort */ });
  }, []);

  return null;
}
