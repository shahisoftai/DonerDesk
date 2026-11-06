"use client";

import { useEffect } from "react";

/**
 * Registers the offline shell (phase 28.1-H). Does nothing where service workers are unavailable, and never fails the page.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
