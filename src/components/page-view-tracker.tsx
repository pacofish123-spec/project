"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "yorento-analytics-session";

function getSessionId(): string {
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private browsing / storage blocked — fall back to a per-load id
    // rather than failing to track at all.
    return crypto.randomUUID();
  }
}

// First-party pageview logging for the admin traffic tab — no cookies,
// no third-party script, one small POST per route change. Query strings
// aren't tracked (keeps "top pages" meaningful without it splitting
// /search?location=X into a thousand distinct rows).
export function PageViewTracker() {
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionIdRef.current) sessionIdRef.current = getSessionId();
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, sessionId: sessionIdRef.current, referrer: document.referrer || null }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
