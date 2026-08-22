"use client";

import { useEffect } from "react";

// Registers /sw.js unconditionally on every visit — separate from the
// push-notification opt-in flow (lib/push/client.ts), which only ever
// runs once someone's signed in and explicitly clicks "Enable
// notifications" inside the messaging widget. Installability (Chrome's
// "Add to Home Screen" prompt, PWABuilder's Android/Play Store
// packaging) requires a service worker to actually be registered
// during a normal page load — a file just sitting at /sw.js unused
// doesn't count. Registering it twice (this, then push's own
// register() call later) is harmless: the browser reuses the existing
// registration for the same URL/scope instead of creating a second one.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort — a registration failure here shouldn't break the
      // page; push notifications just won't have anything to attach to.
    });
  }, []);

  return null;
}
