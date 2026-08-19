"use client";

import { useLanguage } from "@/lib/i18n";
import type { SupportedLanguage } from "@/lib/marketplace-config";

const options: Array<{ code: SupportedLanguage; label: string }> = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="lang-switcher" role="group" aria-label="Change language">
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          className={`lang-switch ${language === option.code ? "active" : ""}`}
          aria-pressed={language === option.code}
          onClick={() => setLanguage(option.code)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
