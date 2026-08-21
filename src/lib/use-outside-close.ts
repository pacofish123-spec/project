"use client";

import { useEffect, useRef } from "react";

// Closes an anchored dropdown/popover on an outside click or Escape —
// the shared interaction behind every small dropdown in the app (search
// fields, language/notification/account menus).
export function useOutsideClose<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);
  return ref;
}
