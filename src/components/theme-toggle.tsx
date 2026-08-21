"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <span className="theme-toggle-placeholder" aria-hidden="true" />;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      className="theme-toggle"
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Theme: ${isDark ? "dark" : "light"}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="theme-toggle-knob">{isDark ? <Moon size={12} /> : <Sun size={12} />}</span>
    </button>
  );
}
