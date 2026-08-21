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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (supportedLanguages as readonly string[]).includes(stored)) {
      queueMicrotask(() => setLanguageState(stored as SupportedLanguage));
      return;
    }
    // No explicit choice saved yet — infer from the browser's language
    // list (most-preferred first) rather than always opening in English.
    // Deliberately not persisted to storage: an explicit pick from the
    // language switcher always wins and sticks, but an unvisited browser
    // should keep re-detecting on every visit until the person actually
    // chooses one.
    const browserLanguages = window.navigator.languages ?? [window.navigator.language];
    const detected = browserLanguages
      .map((lang) => lang.slice(0, 2).toLowerCase())
      .find((lang) => (supportedLanguages as readonly string[]).includes(lang)) as SupportedLanguage | undefined;
    if (detected && detected !== "en") {
      queueMicrotask(() => setLanguageState(detected));
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
