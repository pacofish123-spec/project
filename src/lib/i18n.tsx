"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
    }
  }, []);

  function setLanguage(next: SupportedLanguage) {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let text = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}
