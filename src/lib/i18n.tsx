"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supportedLanguages, type SupportedLanguage } from "@/lib/marketplace-config";
import { dictionaries, type TranslationKey } from "@/lib/translations";

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export const localeByLanguage: Record<SupportedLanguage, string> = {
  en: "en-US",
  es: "es-DO",
  fr: "fr-FR",
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "yorento-language";

// initialLanguage comes from the root layout's server-side
// Accept-Language detection (see detect-language.ts) — the first HTML
// already matches the visitor's language instead of always shipping
// English and switching after hydration. Defaults to "en" so this
// still works wherever it's mounted without that prop.
export function LanguageProvider({ children, initialLanguage = "en" }: { children: ReactNode; initialLanguage?: SupportedLanguage }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(initialLanguage);

  useEffect(() => {
    // An explicit pick from the language switcher always wins and
    // sticks; otherwise the server-detected initialLanguage above is
    // already correct, so there's nothing further to do here.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (supportedLanguages as readonly string[]).includes(stored)) {
      queueMicrotask(() => setLanguageState(stored as SupportedLanguage));
    }
  }, []);

  const setLanguage = useCallback((next: SupportedLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  // Stable identity across re-renders (keyed only on language, not on
  // every render) — consumers that memoize a fetch callback on [t] (e.g.
  // useCallback(load, [t])) would otherwise get a new t on every render
  // of the provider (language switch, mount hydration, etc.) and
  // re-fetch needlessly.
  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>): string => {
    let text = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}
