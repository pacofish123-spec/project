"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const modes = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <span className="theme-toggle-placeholder" aria-hidden="true" />;

  const current = theme ?? "system";
  const next = modes[(modes.indexOf(current as (typeof modes)[number]) + 1) % modes.length];
  const Icon = current === "dark" || (current === "system" && resolvedTheme === "dark") ? Moon : current === "light" ? Sun : Monitor;
  return <button className="theme-toggle" onClick={() => setTheme(next)} aria-label={`Switch theme, currently ${current}`} title={`Theme: ${current}`}><Icon size={17} /></button>;
}
